import type { AbstractWorkflow, InterviewSnapshot } from "./gate-b-contracts";
import { confirmInterview } from "./gate-b-interview";
import {
  GATE_C_SCHEMA_VERSION,
  type BindingRole,
  type CompatibilityAssessment,
  type CompositionExecutionMode,
  type CompositionMutation,
  type CompositionNode,
  type CompositionRevision,
  type CompositionSource,
  type CompositionValidation,
  type PermissionRequirement,
  type ReleasePin,
  type SemanticChange,
  type SemanticDiff,
  type SkillBinding,
  type SkillFitAssessment,
} from "./gate-c-contracts";
import {
  canonicalJson,
  contentDigest,
  ReleaseResolutionError,
  resolveRelease,
} from "./gate-c-release-resolver";
import { ModelGatewayError } from "./openai-responses";

export class CompositionContractError extends Error {
  constructor(
    public readonly code:
      | "INVALID_INPUT"
      | "INVALID_GATE_B_HANDOFF"
      | "REVISION_INVALID"
      | "SESSION_EXPIRED"
      | "STALE_BASE_REVISION"
      | "NODE_NOT_FOUND"
      | "BINDING_NOT_FOUND"
      | "MUTATION_INVALID"
      | "NO_SEMANTIC_CHANGE"
      | "HIGH_RISK_AUTOMATION_DENIED"
      | "PERMISSION_REVIEW_STALE",
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "CompositionContractError";
  }
}

const MAX_COMPOSITION_BODY_BYTES = 384_000;

export async function readCompositionJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_COMPOSITION_BODY_BYTES) {
    throw new CompositionContractError("INVALID_INPUT", "请求体过大", 413);
  }
  const text = await request.text();
  if (!text || new TextEncoder().encode(text).byteLength > MAX_COMPOSITION_BODY_BYTES) {
    throw new CompositionContractError("INVALID_INPUT", text ? "请求体过大" : "请求体不能为空", text ? 413 : 400);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CompositionContractError("INVALID_INPUT", "请求体不是有效 JSON", 400);
  }
}

type GateBBootstrapInput = {
  source: { kind: "gate_b_diagnosis"; snapshot: InterviewSnapshot; workflow: AbstractWorkflow };
};

type RegistryBootstrapInput = {
  source: { kind: "registry_single"; source?: "openagentskill" | "skillflow_creator"; slug: string; releaseId?: string; expectedManifestDigest?: string; taskContext?: string };
};

type BootstrapInput = GateBBootstrapInput | RegistryBootstrapInput;

const executionModes = new Set<CompositionExecutionMode>([
  "human_only",
  "deterministic",
  "ai_assist",
  "ai_draft_human_approve",
  "ai_auto",
  "connector_action",
]);
const bindingRoles = new Set<BindingRole>(["prepare", "primary", "review", "fallback"]);
const aiModes = new Set<CompositionExecutionMode>(["ai_assist", "ai_draft_human_approve", "ai_auto"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanText(value: unknown, label: string, max = 1_000): string {
  if (typeof value !== "string" || !value.trim()) throw new CompositionContractError("INVALID_INPUT", `${label}不能为空`, 400);
  const result = value.trim();
  if (result.length > max) throw new CompositionContractError("INVALID_INPUT", `${label}不能超过 ${max} 字符`, 400);
  return result;
}

function safeList(value: unknown, label: string, maxItems = 24, maxLength = 500): string[] {
  if (!Array.isArray(value) || value.length > maxItems) throw new CompositionContractError("INVALID_INPUT", `${label}格式无效`, 400);
  return value.map((item, index) => cleanText(item, `${label}.${index}`, maxLength));
}

function graphMaterial(source: CompositionSource, nodes: CompositionNode[]) {
  return { source, nodes };
}

function contentMaterial(revision: Omit<CompositionRevision, "contentDigest" | "revisionId">) {
  return revision;
}

type SessionRecord = {
  headRevisionId: string;
  headDigest: string;
  headToken: string;
  headSequence: number;
  revisions: Map<string, CompositionRevision>;
  mutations: Map<string, { requestDigest: string; baseRevisionId: string; revision: CompositionRevision; diff: SemanticDiff }>;
  expiresAt: number;
};

const compositionSessions = new Map<string, SessionRecord>();
const compositionSessionLocks = new Map<string, Promise<void>>();
const SESSION_TTL_MS = 30 * 60 * 1_000;
const MAX_COMPOSITION_SESSIONS = 128;
const MAX_SESSION_REVISIONS = 128;
const MAX_SESSION_MUTATIONS = 128;

function cleanupSessions(now = Date.now()): void {
  for (const [sessionId, session] of compositionSessions) {
    if (session.expiresAt <= now) compositionSessions.delete(sessionId);
  }
}

function sessionOrThrow(sessionId: string): SessionRecord {
  cleanupSessions();
  const session = compositionSessions.get(sessionId);
  if (!session) {
    throw new CompositionContractError("SESSION_EXPIRED", "当前组合会话已过期或不在本执行实例中，请从已确认合同重新创建组合", 409);
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return session;
}

function freshSession(sequence = 0): CompositionRevision["session"] {
  return {
    sessionId: `composition_session_${crypto.randomUUID()}`,
    headSequence: sequence,
    headToken: `head_${crypto.randomUUID()}`,
  };
}

function nextSession(previous: CompositionRevision["session"], sequence: number): CompositionRevision["session"] {
  return { sessionId: previous.sessionId, headSequence: sequence, headToken: `head_${crypto.randomUUID()}` };
}

function rememberInitialRevision(revision: CompositionRevision): void {
  cleanupSessions();
  while (compositionSessions.size >= MAX_COMPOSITION_SESSIONS) {
    const oldest = [...compositionSessions.entries()].sort((left, right) => left[1].expiresAt - right[1].expiresAt)[0];
    if (!oldest) break;
    compositionSessions.delete(oldest[0]);
  }
  compositionSessions.set(revision.session.sessionId, {
    headRevisionId: revision.revisionId,
    headDigest: revision.graphDigest,
    headToken: revision.session.headToken,
    headSequence: revision.session.headSequence,
    revisions: new Map([[revision.revisionId, revision]]),
    mutations: new Map(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
}

async function withSessionLock<T>(sessionId: string, action: () => Promise<T>): Promise<T> {
  const previous = compositionSessionLocks.get(sessionId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.then(() => current);
  compositionSessionLocks.set(sessionId, queued);
  await previous;
  try {
    return await action();
  } finally {
    release();
    if (compositionSessionLocks.get(sessionId) === queued) compositionSessionLocks.delete(sessionId);
  }
}

function initialNode(input: {
  nodeId: string;
  label: string;
  purpose: string;
  sourceFactIds: string[];
  aiSuitability: CompositionNode["aiSuitability"];
  riskLevel: CompositionNode["riskLevel"];
  humanResponsibility: string;
  aiResponsibility: string;
  bindings?: SkillBinding[];
}): CompositionNode {
  return {
    ...input,
    executionMode: null,
    executionDecisionSource: "unresolved",
    constraints: [],
    compositionMode: input.bindings?.length ? "single" : "none",
    skillBindings: input.bindings ?? [],
    compatibility: [],
    aggregatePermissions: [],
    aggregateLimitations: [],
    permissionSurfaceDigest: "sha256:empty",
    permissionReviewDigest: null,
    status: "needs_execution_decision",
  };
}

function normalizePermission(permission: PermissionRequirement): PermissionRequirement {
  return {
    capability: permission.capability,
    access: permission.access,
    risk: permission.risk,
    reason: permission.reason,
  };
}

function permissionUnion(bindings: SkillBinding[]): PermissionRequirement[] {
  const permissions = new Map<string, PermissionRequirement>();
  for (const binding of bindings) {
    for (const permission of binding.release.permissions) {
      const normalized = normalizePermission(permission);
      const key = `${normalized.capability}|${normalized.access}|${normalized.risk}`;
      if (!permissions.has(key)) permissions.set(key, normalized);
    }
  }
  return [...permissions.values()].sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
}

function comparableTerms(values: string[]): Set<string> {
  return new Set(values
    .flatMap((value) => value.toLocaleLowerCase("zh-CN").split(/[^\p{L}\p{N}]+/u))
    .filter((value) => value.length >= 2));
}

function explicitContractIds(values: string[]): Set<string> {
  return new Set(values
    .map((value) => value.trim().toLocaleLowerCase("en-US"))
    .filter((value) => /^(?:schema|mime|media-type|format):[a-z0-9][a-z0-9._/+-]*(?:@v?[0-9][a-z0-9._-]*)?$/i.test(value)));
}

function adjacentCompatibility(bindings: SkillBinding[]): CompatibilityAssessment[] {
  const result: CompatibilityAssessment[] = [];
  for (let index = 0; index < bindings.length - 1; index += 1) {
    const from = bindings[index];
    const to = bindings[index + 1];
    const outputContracts = explicitContractIds(from.release.outputs);
    const inputContracts = explicitContractIds(to.release.inputs);
    const contractOverlap = [...outputContracts].filter((item) => inputContracts.has(item));
    const lexicalOverlap = [...comparableTerms(from.release.outputs)]
      .filter((item) => comparableTerms(to.release.inputs).has(item));
    const bothExplicit = outputContracts.size > 0 && inputContracts.size > 0;
    result.push({
      fromBindingId: from.bindingId,
      toBindingId: to.bindingId,
      status: contractOverlap.length ? "compatible" : bothExplicit ? "incompatible" : "unknown",
      reason: contractOverlap.length
        ? `相邻能力声明使用同一显式合同：${contractOverlap.slice(0, 4).join("、")}`
        : bothExplicit
          ? `显式输出合同 ${[...outputContracts].join("、")} 与输入合同 ${[...inputContracts].join("、")} 不一致`
          : lexicalOverlap.length
            ? `只发现自然语言同词（${lexicalOverlap.slice(0, 4).join("、")}），不足以证明 Schema 兼容`
            : "缺少可证明相邻输出能直接满足下一能力输入的显式 Schema、MIME 或版本化格式合同",
    });
  }
  return result;
}

async function permissionDigest(permissions: PermissionRequirement[]): Promise<string> {
  return contentDigest(permissions);
}

async function deriveNode(node: CompositionNode): Promise<CompositionNode> {
  const bindings = [...node.skillBindings]
    .sort((left, right) => left.order - right.order)
    .map((binding, index) => ({ ...binding, order: index }));
  const permissions = permissionUnion(bindings);
  const limitations = [...new Set(bindings.flatMap((binding) => binding.release.limitations))];
  const compatibility = adjacentCompatibility(bindings);
  const currentPermissionDigest = await permissionDigest(permissions);
  const reviewed = !permissions.length || node.permissionReviewDigest === currentPermissionDigest;
  let status: CompositionNode["status"] = "configured";
  if (!node.executionMode) status = "needs_execution_decision";
  else if (aiModes.has(node.executionMode) && !bindings.length) status = "needs_skill_selection";
  else if (compatibility.some((assessment) => assessment.status !== "compatible")) status = "needs_compatibility_resolution";
  else if (!reviewed) status = "needs_permission_review";
  return {
    ...node,
    skillBindings: bindings,
    compositionMode: bindings.length === 0 ? "none" : bindings.length === 1 ? "single" : "sequence",
    compatibility,
    aggregatePermissions: permissions,
    aggregateLimitations: limitations,
    permissionSurfaceDigest: currentPermissionDigest,
    permissionReviewDigest: reviewed && permissions.length ? currentPermissionDigest : null,
    status,
  };
}

function highRisk(node: CompositionNode): boolean {
  return node.riskLevel === "high" || node.aggregatePermissions.some((permission) =>
    permission.risk === "high" || permission.access === "delete" || permission.access === "send");
}

export function validateCompositionNodes(nodes: CompositionNode[]): CompositionValidation {
  const errors: CompositionValidation["errors"] = [];
  const warnings: CompositionValidation["warnings"] = [];
  const nodeIds = new Set<string>();
  for (const node of nodes) {
    if (nodeIds.has(node.nodeId)) errors.push({ code: "DUPLICATE_NODE", nodeId: node.nodeId, message: "节点 ID 重复" });
    nodeIds.add(node.nodeId);
    if (!node.executionMode) errors.push({ code: "EXECUTION_MODE_REQUIRED", nodeId: node.nodeId, message: "尚未选择人机执行方式" });
    if (node.executionMode && aiModes.has(node.executionMode) && !node.skillBindings.length) {
      errors.push({ code: "AI_IMPLEMENTATION_REQUIRED", nodeId: node.nodeId, message: "AI 执行方式至少需要一个精确固定的 Skill Release" });
    }
    if (node.executionMode === "human_only" && node.skillBindings.length) {
      errors.push({ code: "HUMAN_MODE_HAS_SKILLS", nodeId: node.nodeId, message: "纯人工节点不能保留 Skill 绑定" });
    }
    if (node.executionMode === "ai_auto" && highRisk(node)) {
      errors.push({ code: "HIGH_RISK_AI_AUTO", nodeId: node.nodeId, message: "高风险或外部动作节点不能无人值守自动执行" });
    }
    const orders = node.skillBindings.map((binding) => binding.order);
    if (orders.some((order, index) => order !== index)) {
      errors.push({ code: "BINDING_ORDER_INVALID", nodeId: node.nodeId, message: "Skill 顺序必须连续且唯一" });
    }
    if (new Set(node.skillBindings.map((binding) => binding.release.releaseId)).size !== node.skillBindings.length) {
      errors.push({ code: "DUPLICATE_RELEASE", nodeId: node.nodeId, message: "同一节点不能重复绑定相同 Release" });
    }
    if (node.skillBindings.filter((binding) => binding.role === "primary").length > 1) {
      errors.push({ code: "MULTIPLE_PRIMARY", nodeId: node.nodeId, message: "一个顺序组合最多只能有一个 primary" });
    }
    const fallback = node.skillBindings.find((binding) => binding.role === "fallback");
    if (fallback && fallback.order !== node.skillBindings.length - 1) {
      errors.push({ code: "FALLBACK_NOT_LAST", nodeId: node.nodeId, message: "fallback 必须位于顺序组合最后" });
    }
    for (const compatibility of node.compatibility) {
      if (compatibility.status !== "compatible") {
        errors.push({ code: `COMPATIBILITY_${compatibility.status.toUpperCase()}`, nodeId: node.nodeId, message: compatibility.reason });
      }
    }
    if (node.aggregatePermissions.length && node.permissionReviewDigest !== node.permissionSurfaceDigest) {
      errors.push({ code: "PERMISSION_REVIEW_REQUIRED", nodeId: node.nodeId, message: "组合后的权限并集尚未确认" });
    }
    for (const binding of node.skillBindings) {
      if (binding.release.pinKind === "manifest_snapshot") {
        warnings.push({ code: "SNAPSHOT_ONLY_RELEASE", nodeId: node.nodeId, message: `${binding.release.canonicalName} 只固定了上游 Manifest 快照，作者版本未知` });
      }
      if (binding.release.hostedExecution === "install_handoff_only") {
        warnings.push({ code: "NOT_HOSTED", nodeId: node.nodeId, message: `${binding.release.canonicalName} 未由 Skillflow 托管运行` });
      }
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}

async function buildRevision(input: {
  source: CompositionSource;
  nodes: CompositionNode[];
  revisionNumber: number;
  parentRevisionId: string | null;
  parentDigest: string | null;
  diff: SemanticDiff | null;
  appliedMutationIds: string[];
  session: CompositionRevision["session"];
}): Promise<CompositionRevision> {
  const nodes = await Promise.all(input.nodes.map(deriveNode));
  const validation = validateCompositionNodes(nodes);
  const graphDigest = await contentDigest(graphMaterial(input.source, nodes));
  const state: CompositionRevision["state"] = validation.valid
    ? "composition_ready"
    : validation.errors.some((error) => error.code === "PERMISSION_REVIEW_REQUIRED")
      ? "needs_permission_review"
      : input.revisionNumber === 0
        ? "composition_draft"
        : "needs_configuration";
  const base = {
    schemaVersion: GATE_C_SCHEMA_VERSION,
    revisionNumber: input.revisionNumber,
    parentRevisionId: input.parentRevisionId,
    parentDigest: input.parentDigest,
    source: input.source,
    graphDigest,
    session: input.session,
    state,
    nodes,
    diffFromParent: input.diff,
    appliedMutationIds: input.appliedMutationIds,
    validation,
    persistence: "session_only" as const,
    saved: false as const,
    runnable: false as const,
    createdAt: new Date().toISOString(),
  };
  const contentDigestValue = await contentDigest(contentMaterial(base));
  return {
    ...base,
    revisionId: `session_revision_${contentDigestValue.slice(7, 23)}`,
    contentDigest: contentDigestValue,
  };
}

function validateGateBHandoff(snapshot: InterviewSnapshot, workflow: AbstractWorkflow): void {
  if (snapshot.schemaVersion !== "gate-b-v1"
    || snapshot.state !== "confirmed"
    || snapshot.taskContract.status !== "confirmed"
    || !snapshot.confirmation
    || snapshot.confirmation.factDigest !== snapshot.taskContract.factDigest
    || workflow.status !== "abstract_confirmed"
    || workflow.sourceFactDigest !== snapshot.taskContract.factDigest
    || workflow.gateCRequired !== true) {
    throw new CompositionContractError("INVALID_GATE_B_HANDOFF", "Gate B 任务合同尚未形成一致的显式确认", 422);
  }
  let audited: ReturnType<typeof confirmInterview>;
  try {
    audited = confirmInterview({
      snapshot,
      requestSeq: snapshot.requestSeq + 1,
      message: { id: `gate_c_audit_${snapshot.requestSeq + 1}`, content: "确认" },
      accept: true,
    });
  } catch {
    throw new CompositionContractError("INVALID_GATE_B_HANDOFF", "Gate B 快照未通过事实、证据、依赖或充分性复核", 422);
  }
  const expectedWorkflow = audited.workflow;
  const workflowProjection = (value: AbstractWorkflow) => ({
    status: value.status,
    title: value.title,
    sourceFactDigest: value.sourceFactDigest,
    nodes: value.nodes,
    boundaries: value.boundaries,
    gateCRequired: value.gateCRequired,
  });
  if (canonicalJson(snapshot.taskContract) !== canonicalJson(audited.snapshot.taskContract)
    || canonicalJson(workflowProjection(workflow)) !== canonicalJson(workflowProjection(expectedWorkflow))) {
    throw new CompositionContractError("INVALID_GATE_B_HANDOFF", "AbstractWorkflow 与已确认事实模型不匹配", 422);
  }
  const factIds = new Set(snapshot.facts.map((fact) => fact.factId));
  if (!workflow.nodes.length || workflow.nodes.some((node) => !node.sourceFactIds.length || node.sourceFactIds.some((id) => !factIds.has(id)))) {
    throw new CompositionContractError("INVALID_GATE_B_HANDOFF", "抽象节点引用了不存在的任务事实", 422);
  }
}

function manualAssessment(release: ReleasePin): SkillFitAssessment {
  return {
    verdict: "candidate",
    structureFit: {
      task: "unknown",
      input: release.inputs.length ? "partial" : "unknown",
      output: release.outputs.length ? "partial" : "unknown",
      matchedTerms: [],
      reasons: ["这是用户直接选择的真实 Registry 候选，尚未完成当前任务适配评测"],
      evidencePaths: [],
    },
    registrySignals: release.registrySignals,
    limitations: release.limitations,
    unknowns: ["当前任务上下文不完整", "尚未运行", "未验证输入输出兼容性"],
    source: "deterministic",
  };
}

async function bindingFor(release: ReleasePin, nodeId: string, role: BindingRole, order: number): Promise<SkillBinding> {
  const idDigest = await contentDigest({ nodeId, releaseId: release.releaseId, role });
  return {
    bindingId: `binding_${idDigest.slice(7, 23)}`,
    order,
    role,
    release,
    fitAssessment: manualAssessment(release),
  };
}

export async function bootstrapComposition(value: unknown): Promise<CompositionRevision> {
  if (!isRecord(value) || !isRecord(value.source)) throw new CompositionContractError("INVALID_INPUT", "bootstrap 请求格式无效", 400);
  const sourceInput = value.source as BootstrapInput["source"];
  if (sourceInput.kind === "gate_b_diagnosis") {
    validateGateBHandoff(sourceInput.snapshot, sourceInput.workflow);
    const abstractWorkflowDigest = await contentDigest(sourceInput.workflow);
    const sourceDigest = await contentDigest({
      taskContractDigest: sourceInput.snapshot.taskContract.factDigest,
      abstractWorkflowDigest,
    });
    const source: CompositionSource = {
      kind: "gate_b_diagnosis",
      sourceDigest,
      taskContractDigest: sourceInput.snapshot.taskContract.factDigest,
      abstractWorkflowDigest,
      title: sourceInput.workflow.title,
      taskContext: sourceInput.snapshot.taskContract.goal.map((goal) => goal.value).join("；") || sourceInput.workflow.title,
      taskContextStatus: "confirmed",
      confirmedContractSnapshot: structuredClone(sourceInput.snapshot.taskContract) as Extract<CompositionSource, { kind: "gate_b_diagnosis" }>["confirmedContractSnapshot"],
      boundaries: [...sourceInput.workflow.boundaries],
    };
    const nodes = sourceInput.workflow.nodes.map((node) => initialNode({
      nodeId: node.nodeId,
      label: node.label,
      purpose: node.purpose,
      sourceFactIds: [...node.sourceFactIds],
      aiSuitability: node.aiSuitability,
      riskLevel: node.riskLevel,
      humanResponsibility: node.humanResponsibility,
      aiResponsibility: node.aiResponsibility,
    }));
    const revision = await buildRevision({
      source,
      nodes,
      revisionNumber: 0,
      parentRevisionId: null,
      parentDigest: null,
      diff: null,
      appliedMutationIds: [],
      session: freshSession(),
    });
    rememberInitialRevision(revision);
    return revision;
  }
  if (sourceInput.kind === "registry_single") {
    const slug = cleanText(sourceInput.slug, "source.slug", 120);
    const releaseSource = sourceInput.source === "skillflow_creator" ? "skillflow_creator" : "openagentskill";
    const release = await resolveRelease({ source: releaseSource, slug, releaseId: sourceInput.releaseId, expectedManifestDigest: sourceInput.expectedManifestDigest });
    const taskContext = typeof sourceInput.taskContext === "string" && sourceInput.taskContext.trim()
      ? sourceInput.taskContext.trim().slice(0, 1_000)
      : `评估并配置 ${release.canonicalName}；具体输入、输出和验收仍待用户补充。`;
    const sourceDigest = await contentDigest({ kind: "registry_single", release: release.manifestDigest, taskContext });
    const source: CompositionSource = {
      kind: "registry_single",
      sourceDigest,
      taskContractDigest: null,
      abstractWorkflowDigest: null,
      title: release.canonicalName,
      taskContext,
      taskContextStatus: "minimal_unconfirmed",
      confirmedContractSnapshot: null,
      boundaries: ["当前仅配置 Skill；尚未运行、保存或授权连接器。"],
    };
    const binding = await bindingFor(release, `registry_node_${release.slug}`, "primary", 0);
    const nodes = [initialNode({
      nodeId: `registry_node_${release.slug}`,
      label: release.canonicalName,
      purpose: taskContext,
      sourceFactIds: [],
      aiSuitability: "needs_analysis",
      riskLevel: "medium",
      humanResponsibility: "核验当前任务、权限、限制和最终输出。",
      aiResponsibility: "尚未确定；当前只保留真实 Release 候选。",
      bindings: [binding],
    })];
    const revision = await buildRevision({
      source,
      nodes,
      revisionNumber: 0,
      parentRevisionId: null,
      parentDigest: null,
      diff: null,
      appliedMutationIds: [],
      session: freshSession(),
    });
    rememberInitialRevision(revision);
    return revision;
  }
  throw new CompositionContractError("INVALID_INPUT", "不支持的 composition source", 400);
}

async function validateRevisionEnvelope(revision: CompositionRevision, requireSession = true): Promise<CompositionRevision> {
  if (!revision || revision.schemaVersion !== GATE_C_SCHEMA_VERSION || revision.saved !== false || revision.runnable !== false || revision.persistence !== "session_only") {
    throw new CompositionContractError("REVISION_INVALID", "Gate C revision 边界或版本无效", 422);
  }
  if (!revision.session?.sessionId || !revision.session.headToken || !Number.isSafeInteger(revision.session.headSequence)) {
    throw new CompositionContractError("REVISION_INVALID", "Revision session envelope 无效", 422);
  }
  const normalizedNodes = await Promise.all(revision.nodes.map(deriveNode));
  if (canonicalJson(normalizedNodes) !== canonicalJson(revision.nodes)) {
    throw new CompositionContractError("REVISION_INVALID", "Revision 节点派生字段或顺序被修改", 422);
  }
  const expectedGraphDigest = await contentDigest(graphMaterial(revision.source, normalizedNodes));
  if (expectedGraphDigest !== revision.graphDigest) throw new CompositionContractError("REVISION_INVALID", "Revision graph digest 不一致", 422);
  const base = {
    schemaVersion: revision.schemaVersion,
    revisionNumber: revision.revisionNumber,
    parentRevisionId: revision.parentRevisionId,
    parentDigest: revision.parentDigest,
    source: revision.source,
    graphDigest: revision.graphDigest,
    session: revision.session,
    state: revision.state,
    nodes: revision.nodes,
    diffFromParent: revision.diffFromParent,
    appliedMutationIds: revision.appliedMutationIds,
    validation: revision.validation,
    persistence: revision.persistence,
    saved: revision.saved,
    runnable: revision.runnable,
    createdAt: revision.createdAt,
  };
  const expectedContentDigest = await contentDigest(contentMaterial(base));
  if (expectedContentDigest !== revision.contentDigest || revision.revisionId !== `session_revision_${expectedContentDigest.slice(7, 23)}`) {
    throw new CompositionContractError("REVISION_INVALID", "Revision content digest 不一致", 422);
  }
  if (requireSession) {
    const session = sessionOrThrow(revision.session.sessionId);
    const stored = session?.revisions.get(revision.revisionId);
    if (!stored || canonicalJson(stored) !== canonicalJson(revision)) {
      throw new CompositionContractError("REVISION_INVALID", "Revision 不属于当前有效会话，或内容已被修改", 422);
    }
  }
  return revision;
}

function nodeOrThrow(nodes: CompositionNode[], nodeId: string): CompositionNode {
  const node = nodes.find((candidate) => candidate.nodeId === nodeId);
  if (!node) throw new CompositionContractError("NODE_NOT_FOUND", `没有找到节点 ${nodeId}`, 404);
  return node;
}

function operationReason(operation: CompositionMutation): string {
  return operation.reason?.trim().slice(0, 300) || "用户直接调整当前会话组合";
}

function change(kind: SemanticChange["kind"], nodeId: string, path: string, before: unknown, after: unknown, reason: string): SemanticChange {
  return { kind, nodeId, path, before, after, reason };
}

function refreshOrders(node: CompositionNode): void {
  node.skillBindings = node.skillBindings.map((binding, order) => ({ ...binding, order }));
}

async function applyOperation(nodes: CompositionNode[], operation: CompositionMutation, changes: SemanticChange[]): Promise<void> {
  const node = nodeOrThrow(nodes, cleanText(operation.nodeId, "operation.nodeId", 100));
  const reason = operationReason(operation);
  if (operation.type === "set_execution_mode") {
    if (!executionModes.has(operation.mode)) throw new CompositionContractError("MUTATION_INVALID", "execution mode 无效", 400);
    const before = node.executionMode;
    node.executionMode = operation.mode;
    node.executionDecisionSource = "user_override";
    if (operation.mode === "human_only" && node.skillBindings.length) {
      const removed = node.skillBindings.map((binding) => binding.release.releaseId);
      node.skillBindings = [];
      node.permissionReviewDigest = null;
      changes.push(change("skill_unbound", node.nodeId, "skillBindings", removed, [], "切换纯人工后清除全部 Skill 绑定"));
    }
    changes.push(change("execution_mode_changed", node.nodeId, "executionMode", before, operation.mode, reason));
    return;
  }
  if (operation.type === "clear_execution_mode") {
    const before = node.executionMode;
    node.executionMode = null;
    node.executionDecisionSource = "unresolved";
    changes.push(change("execution_mode_changed", node.nodeId, "executionMode", before, null, reason));
    return;
  }
  if (operation.type === "set_constraints") {
    const constraints = safeList(operation.constraints, "operation.constraints", 16, 300);
    const before = node.constraints;
    node.constraints = [...new Set(constraints)];
    changes.push(change("constraints_changed", node.nodeId, "constraints", before, node.constraints, reason));
    return;
  }
  if (operation.type === "bind_release") {
    if (!bindingRoles.has(operation.role)) throw new CompositionContractError("MUTATION_INVALID", "binding role 无效", 400);
    const release = await resolveRelease(operation.selector);
    if (node.skillBindings.some((binding) => binding.release.releaseId === release.releaseId
      || (binding.release.source === release.source && binding.release.sourceSkillKey === release.sourceSkillKey))) {
      throw new CompositionContractError("MUTATION_INVALID", "同一节点不能重复绑定同一 Skill 或相同 Release", 409);
    }
    const order = operation.order === undefined ? node.skillBindings.length : operation.order;
    if (!Number.isSafeInteger(order) || order < 0 || order > node.skillBindings.length) {
      throw new CompositionContractError("MUTATION_INVALID", "binding order 无效", 400);
    }
    const binding = await bindingFor(release, node.nodeId, operation.role, order);
    node.skillBindings.splice(order, 0, binding);
    refreshOrders(node);
    node.permissionReviewDigest = null;
    changes.push(change("skill_bound", node.nodeId, `skillBindings.${order}`, null, release.releaseId, reason));
    return;
  }
  if (operation.type === "unbind_release") {
    const index = node.skillBindings.findIndex((binding) => binding.bindingId === operation.bindingId);
    if (index < 0) throw new CompositionContractError("BINDING_NOT_FOUND", "没有找到要移除的 Skill binding", 404);
    const [removed] = node.skillBindings.splice(index, 1);
    refreshOrders(node);
    node.permissionReviewDigest = null;
    changes.push(change("skill_unbound", node.nodeId, `skillBindings.${index}`, removed.release.releaseId, null, reason));
    return;
  }
  if (operation.type === "replace_release") {
    const index = node.skillBindings.findIndex((binding) => binding.bindingId === operation.bindingId);
    if (index < 0) throw new CompositionContractError("BINDING_NOT_FOUND", "没有找到要替换的 Skill binding", 404);
    const previous = node.skillBindings[index];
    const release = await resolveRelease(operation.selector);
    if (node.skillBindings.some((binding, bindingIndex) => bindingIndex !== index
      && (binding.release.releaseId === release.releaseId
        || (binding.release.source === release.source && binding.release.sourceSkillKey === release.sourceSkillKey)))) {
      throw new CompositionContractError("MUTATION_INVALID", "替换会造成同一 Skill 或相同 Release 重复", 409);
    }
    node.skillBindings[index] = await bindingFor(release, node.nodeId, operation.role ?? previous.role, index);
    node.permissionReviewDigest = null;
    changes.push(change("skill_replaced", node.nodeId, `skillBindings.${index}`, previous.release.releaseId, release.releaseId, reason));
    return;
  }
  if (operation.type === "reorder_releases") {
    if (operation.bindingIds.length !== node.skillBindings.length
      || new Set(operation.bindingIds).size !== operation.bindingIds.length
      || operation.bindingIds.some((id) => !node.skillBindings.some((binding) => binding.bindingId === id))) {
      throw new CompositionContractError("MUTATION_INVALID", "重排必须完整且只包含当前 binding", 400);
    }
    const before = node.skillBindings.map((binding) => binding.bindingId);
    if (canonicalJson(before) === canonicalJson(operation.bindingIds)) return;
    node.skillBindings = operation.bindingIds.map((id, order) => ({
      ...node.skillBindings.find((binding) => binding.bindingId === id)!,
      order,
    }));
    node.permissionReviewDigest = null;
    changes.push(change("skill_reordered", node.nodeId, "skillBindings.order", before, operation.bindingIds, reason));
    return;
  }
  const expected = await permissionDigest(permissionUnion(node.skillBindings));
  if (expected !== node.permissionSurfaceDigest) {
    throw new CompositionContractError("REVISION_INVALID", "节点权限表面摘要与绑定不一致", 422);
  }
  if (operation.permissionDigest !== expected) {
    throw new CompositionContractError("PERMISSION_REVIEW_STALE", "权限表面已经变化，请重新核验", 409);
  }
  const before = node.permissionReviewDigest;
  node.permissionReviewDigest = expected;
  changes.push(change("permissions_reviewed", node.nodeId, "permissionReviewDigest", before, expected, reason));
}

function summarize(changes: SemanticChange[]): string {
  if (!changes.length) return "本次操作没有产生结构变化。";
  const labels: Record<SemanticChange["kind"], string> = {
    execution_mode_changed: "调整执行方式",
    constraints_changed: "修改节点约束",
    skill_bound: "绑定 Skill Release",
    skill_unbound: "移除 Skill Release",
    skill_replaced: "替换 Skill Release",
    skill_reordered: "调整 Skill 顺序",
    permissions_reviewed: "确认权限表面",
    permission_surface_changed: "权限表面变化",
    node_readiness_changed: "节点就绪状态变化",
  };
  return [...new Set(changes.map((item) => labels[item.kind]))].join("；") + "。";
}

async function calculateOperations(
  base: CompositionRevision,
  operations: CompositionMutation[],
  mutationId: string,
  actor: SemanticDiff["actor"],
): Promise<{ nodes: CompositionNode[]; diff: SemanticDiff }> {
  const nodes = structuredClone(base.nodes);
  const beforeNodes = structuredClone(base.nodes);
  const changes: SemanticChange[] = [];
  for (const raw of operations) {
    if (!isRecord(raw) || typeof raw.type !== "string") throw new CompositionContractError("MUTATION_INVALID", "mutation 格式无效", 400);
    await applyOperation(nodes, raw as CompositionMutation, changes);
  }
  const derivedNodes = await Promise.all(nodes.map(deriveNode));
  for (const node of derivedNodes) {
    const before = beforeNodes.find((candidate) => candidate.nodeId === node.nodeId)!;
    if (canonicalJson(before.aggregatePermissions) !== canonicalJson(node.aggregatePermissions)) {
      changes.push(change("permission_surface_changed", node.nodeId, "aggregatePermissions", before.aggregatePermissions, node.aggregatePermissions, "Skill 组合改变了权限并集"));
    }
    if (before.status !== node.status) {
      changes.push(change("node_readiness_changed", node.nodeId, "status", before.status, node.status, "结构校验重新计算节点状态"));
    }
    if (node.executionMode === "ai_auto" && highRisk(node)) {
      throw new CompositionContractError("HIGH_RISK_AUTOMATION_DENIED", "高风险或外部动作节点不能设置为 ai_auto", 422);
    }
  }
  if (canonicalJson(beforeNodes) === canonicalJson(derivedNodes)) {
    throw new CompositionContractError("NO_SEMANTIC_CHANGE", "这次操作没有改变当前组合，因此不会生成新的会话版本", 409);
  }
  const meaningfulChanges = changes.filter((item) => canonicalJson(item.before) !== canonicalJson(item.after));
  return { nodes: derivedNodes, diff: { mutationId, actor, changes: meaningfulChanges, summaryZh: summarize(meaningfulChanges) } };
}

export async function previewCompositionOperations(
  base: CompositionRevision,
  operations: CompositionMutation[],
  mutationId: string,
): Promise<SemanticDiff> {
  const calculated = await calculateOperations(base, operations, mutationId, "ai_proposal_accepted");
  return calculated.diff;
}

export async function reviseComposition(value: unknown): Promise<{ revision: CompositionRevision; diff: SemanticDiff }> {
  if (!isRecord(value) || value.mode !== "apply" || !isRecord(value.baseRevision)) {
    throw new CompositionContractError("INVALID_INPUT", "revise apply 请求格式无效", 400);
  }
  const untrustedBase = value.baseRevision as CompositionRevision;
  const sessionId = cleanText(untrustedBase.session?.sessionId, "baseRevision.session.sessionId", 120);
  return withSessionLock(sessionId, async () => {
    const base = await validateRevisionEnvelope(untrustedBase);
    const expectedBaseDigest = cleanText(value.expectedBaseDigest, "expectedBaseDigest", 100);
    const expectedHeadToken = cleanText(value.expectedHeadToken, "expectedHeadToken", 120);
    const requestSeq = value.requestSeq;
    if (!Number.isSafeInteger(requestSeq) || (requestSeq as number) < 1) {
      throw new CompositionContractError("INVALID_INPUT", "requestSeq 必须是正整数", 400);
    }
    const mutationId = cleanText(value.mutationId, "mutationId", 100);
    if (!Array.isArray(value.operations) || !value.operations.length || value.operations.length > 16) {
      throw new CompositionContractError("INVALID_INPUT", "operations 必须包含 1–16 项修改", 400);
    }
    const actor: SemanticDiff["actor"] = value.actor === "ai_proposal_accepted" ? "ai_proposal_accepted" : "user";
    const operations = value.operations as CompositionMutation[];
    const requestDigest = await contentDigest({ baseRevisionId: base.revisionId, operations, actor, requestSeq });
    const session = sessionOrThrow(sessionId);
    const prior = session.mutations.get(mutationId);
    if (prior) {
      if (prior.baseRevisionId !== base.revisionId || prior.requestDigest !== requestDigest) {
        throw new CompositionContractError("MUTATION_INVALID", "mutationId 已用于不同请求", 409);
      }
      return { revision: prior.revision, diff: prior.diff };
    }
    if (expectedBaseDigest !== base.graphDigest
      || expectedHeadToken !== base.session.headToken
      || session.headRevisionId !== base.revisionId
      || session.headDigest !== base.graphDigest
      || session.headToken !== expectedHeadToken
      || requestSeq !== session.headSequence + 1) {
      throw new CompositionContractError("STALE_BASE_REVISION", "基础 Revision 已不是当前会话 head", 409);
    }
    const { nodes, diff } = await calculateOperations(base, operations, mutationId, actor);
    const revision = await buildRevision({
      source: base.source,
      nodes,
      revisionNumber: base.revisionNumber + 1,
      parentRevisionId: base.revisionId,
      parentDigest: base.contentDigest,
      diff,
      appliedMutationIds: [...base.appliedMutationIds, mutationId].slice(-128),
      session: nextSession(base.session, requestSeq as number),
    });
    session.revisions.set(revision.revisionId, revision);
    session.mutations.set(mutationId, { requestDigest, baseRevisionId: base.revisionId, revision, diff });
    while (session.revisions.size > MAX_SESSION_REVISIONS) session.revisions.delete(session.revisions.keys().next().value!);
    while (session.mutations.size > MAX_SESSION_MUTATIONS) session.mutations.delete(session.mutations.keys().next().value!);
    session.headRevisionId = revision.revisionId;
    session.headDigest = revision.graphDigest;
    session.headToken = revision.session.headToken;
    session.headSequence = revision.session.headSequence;
    session.expiresAt = Date.now() + SESSION_TTL_MS;
    return { revision, diff };
  });
}

async function validateResolvedRevision(revision: CompositionRevision): Promise<{ revision: CompositionRevision; validation: CompositionValidation }> {
  const nodes = await Promise.all(revision.nodes.map(deriveNode));
  const validation = validateCompositionNodes(nodes);
  for (const binding of revision.nodes.flatMap((node) => node.skillBindings.map((item) => ({ node, binding: item })))) {
    try {
      await resolveRelease({
        source: binding.binding.release.source,
        slug: binding.binding.release.slug,
        releaseId: binding.binding.release.releaseId,
        expectedManifestDigest: binding.binding.release.manifestDigest,
      });
    } catch (error) {
      if (error instanceof ReleaseResolutionError && error.code === "REGISTRY_UNAVAILABLE") {
        validation.warnings.push({ code: "RELEASE_SOURCE_UNAVAILABLE", nodeId: binding.node.nodeId, message: `${binding.binding.release.canonicalName} 暂时无法向上游复核；当前固定 Revision 未改变` });
      } else {
        validation.errors.push({ code: error instanceof ReleaseResolutionError ? error.code : "RELEASE_VALIDATION_FAILED", nodeId: binding.node.nodeId, message: error instanceof Error ? error.message : "Release 复核失败" });
      }
    }
  }
  validation.valid = validation.errors.length === 0;
  return { revision, validation };
}

export async function validateCompositionRevision(value: unknown): Promise<{ revision: CompositionRevision; validation: CompositionValidation }> {
  const candidate = isRecord(value) && isRecord(value.revision) ? value.revision as CompositionRevision : value as CompositionRevision;
  return validateResolvedRevision(await validateRevisionEnvelope(candidate));
}

// Gate C mutations remain bound to their short-lived in-memory session. Gate D
// persistence must survive Worker isolate changes, so it revalidates the complete
// self-contained envelope, every derived node and every authoritative Release,
// then applies its much narrower fixed-Pack execution compiler.
export async function validatePortableCompositionRevision(value: unknown): Promise<{ revision: CompositionRevision; validation: CompositionValidation }> {
  const candidate = isRecord(value) && isRecord(value.revision) ? value.revision as CompositionRevision : value as CompositionRevision;
  return validateResolvedRevision(await validateRevisionEnvelope(candidate, false));
}

export async function revisionForRecommendation(value: unknown): Promise<{ revision: CompositionRevision; nodeId: string; limit: number }> {
  if (!isRecord(value) || !isRecord(value.revision)) throw new CompositionContractError("INVALID_INPUT", "recommend 请求格式无效", 400);
  const revision = await validateRevisionEnvelope(value.revision as CompositionRevision);
  const nodeId = cleanText(value.nodeId, "nodeId", 100);
  nodeOrThrow(revision.nodes, nodeId);
  const requestedLimit = typeof value.limit === "number" && Number.isFinite(value.limit) ? Math.round(value.limit) : 8;
  return { revision, nodeId, limit: Math.max(1, Math.min(requestedLimit, 12)) };
}

export async function revisionForProposal(value: unknown): Promise<{ revision: CompositionRevision; instruction: string }> {
  if (!isRecord(value) || value.mode !== "propose" || !isRecord(value.baseRevision)) {
    throw new CompositionContractError("INVALID_INPUT", "revise propose 请求格式无效", 400);
  }
  const revision = await validateRevisionEnvelope(value.baseRevision as CompositionRevision);
  const expectedBaseDigest = cleanText(value.expectedBaseDigest, "expectedBaseDigest", 100);
  const expectedHeadToken = cleanText(value.expectedHeadToken, "expectedHeadToken", 120);
  const session = sessionOrThrow(revision.session.sessionId);
  if (expectedBaseDigest !== revision.graphDigest
    || expectedHeadToken !== revision.session.headToken
    || session.headRevisionId !== revision.revisionId
    || session.headToken !== expectedHeadToken) {
    throw new CompositionContractError("STALE_BASE_REVISION", "基础 Revision 已不是当前会话 head", 409);
  }
  return { revision, instruction: cleanText(value.instruction, "instruction", 4_000) };
}

export function compositionErrorResponse(error: unknown): Response {
  if (error instanceof CompositionContractError || error instanceof ReleaseResolutionError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.httpStatus });
  }
  if (error instanceof ModelGatewayError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.httpStatus });
  }
  if (error instanceof Error && error.message.startsWith("MODEL_")) {
    return Response.json({ error: { code: "MODEL_OUTPUT_INVALID", message: "模型修改提案引用了不存在的节点或绑定" } }, { status: 502 });
  }
  return Response.json({ error: { code: "COMPOSITION_FAILED", message: "无法完成当前组合操作，请重试" } }, { status: 500 });
}
