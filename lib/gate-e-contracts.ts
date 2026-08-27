import type { ModelRunReceipt } from "./model-gateway";

export const GATE_E_DRAFT_SCHEMA = "gate-e-draft-v1";
export const GATE_E_E1_POLICY = "gate-e-e1-v1";
export const GATE_E_E2_POLICY = "gate-e-e2-v1";
export const GATE_E_PARSER_VERSION = "skill-md-safe-v1";

const MAX_SOURCE_BYTES = 100_000;
const MAX_FIELD = 8_000;
const MAX_INSTRUCTIONS = 80_000;
const RESERVED_SLUGS = new Set(["api", "admin", "creator", "registry", "skillflow", "openagentskill", "system", "runtime"]);
const COMMON_LICENSES = new Set([
  "MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "MPL-2.0",
  "GPL-2.0-only", "GPL-3.0-only", "LGPL-2.1-only", "LGPL-3.0-only", "AGPL-3.0-only",
  "CC-BY-4.0", "CC-BY-SA-4.0", "Unlicense",
]);

export type GateEWorkspace = {
  workspaceId: string;
  accountId: string;
  workspaceName: string;
  dataRegion: string;
};

export type GateEPermission = {
  action: "read" | "create" | "update" | "delete" | "send" | "network" | "execute";
  object: string;
  scope: string;
  purpose: string;
  risk: "low" | "medium" | "high" | "critical";
};

export type GateEDraft = {
  schemaVersion: typeof GATE_E_DRAFT_SCHEMA;
  canonicalName: string;
  briefZh: string;
  description: string;
  instructions: string;
  tags: string[];
  inputs: string[];
  outputs: string[];
  permissions: GateEPermission[];
  limitations: string[];
  attribution: {
    sourceKind: "creator_original" | "open_source_attribution" | "fork";
    sourceRegistry: "openagentskill" | "skillflow_creator" | null;
    sourceUrl: string | null;
    sourceCommit: string | null;
    originalAuthor: string | null;
    publisherRole: "creator" | "derivative_creator" | "indexer";
    rightsStatus: "missing" | "creator_attested" | "upstream_evidence" | "operator_verified" | "conflicted";
    licenseSpdx: string | null;
    licenseEvidenceStatus: "missing" | "creator_declared" | "upstream_declared" | "operator_verified" | "conflicted";
    derivedFromReleaseId: string | null;
    derivedFromDigest: string | null;
  };
  presentationProvenance: Record<string, "creator" | "model_inferred" | "parser_inferred" | "upstream">;
  execution: {
    containsExecutableScripts: boolean;
    hostedExecutionPolicy: "deny";
    directoryMode: "directory_only";
  };
};

export type GateEIssue = {
  code: string;
  severity: "blocker" | "manual_review" | "warning";
  field: string;
  message: string;
};

export type GateEE1Result = {
  policyVersion: typeof GATE_E_E1_POLICY;
  status: "blocked" | "manual_review_required" | "passed_with_warnings" | "passed";
  publishEligible: boolean;
  evidenceLabel: "E1 · 结构、来源与风险检查";
  issues: GateEIssue[];
  hostedExecution: "directory_only";
  checkedAt: string;
};

export type GateEE2Result = {
  policyVersion: typeof GATE_E_E2_POLICY;
  status: "passed" | "failed" | "blocked";
  evidenceLabel: "E2 · 固定样例无工具模型运行";
  verdict: string;
  output: string;
  criteria: { criterion: string; passed: boolean; evidence: string }[];
  receipt: ModelRunReceipt | null;
  checkedAt: string;
};

export type GateEStructuredDiff = {
  changed: { field: string; before: unknown; after: unknown }[];
  protectedFieldChanges: string[];
};

export class GateEContractError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "GateEContractError";
  }
}

function text(value: unknown, max = MAX_FIELD) {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim().slice(0, max) : "";
}

function uniqueStrings(value: unknown, max = 20) {
  const input = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,，\n]/) : [];
  return [...new Set(input.map((item) => text(item, 160)).filter(Boolean))].slice(0, max);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, stableValue(child)]));
}

export function stableJson(value: unknown) {
  return JSON.stringify(stableValue(value));
}

export async function gateEDigest(value: unknown) {
  const bytes = new TextEncoder().encode(typeof value === "string" ? value : stableJson(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function sourceBytes(value: string) {
  const bytes = new TextEncoder().encode(value);
  if (!value.trim()) throw new GateEContractError("EMPTY_SOURCE", "Skill 内容不能为空");
  if (bytes.byteLength > MAX_SOURCE_BYTES) throw new GateEContractError("SOURCE_TOO_LARGE", "Skill 文本不能超过 100 KB", 413);
  if (value.includes("\0")) throw new GateEContractError("SOURCE_NUL", "Skill 文本不能包含 NUL 字节");
  return bytes;
}

export function safeCreatorSourceUrl(value: unknown): string | null {
  const candidate = text(value, 1_000);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function creatorSlug(value: unknown) {
  const normalized = text(value, 100).toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 64)
    .replace(/-+$/g, "");
  if (normalized.length < 2 || RESERVED_SLUGS.has(normalized) || normalized.startsWith("skillflow-") || normalized.startsWith("openagentskill-")) {
    throw new GateEContractError("SLUG_INVALID", "请输入 2–64 位的英文 Skill 标识，且不要使用平台保留名称");
  }
  return normalized;
}

function simpleFrontmatter(source: string) {
  if (!source.startsWith("---\n")) return { meta: {} as Record<string, string>, body: source };
  const end = source.indexOf("\n---", 4);
  if (end < 0 || end > 20_000) return { meta: {} as Record<string, string>, body: source };
  const meta: Record<string, string> = {};
  for (const line of source.slice(4, end).split("\n")) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]{0,60}):\s*(.*)$/);
    if (!match) continue;
    meta[match[1].toLowerCase()] = match[2].replace(/^['"]|['"]$/g, "").trim();
  }
  return { meta, body: source.slice(end + 4).trim() };
}

function defaultPermission(label: string): GateEPermission {
  const normalized = label.toLowerCase();
  const action: GateEPermission["action"] = normalized.includes("delete") || label.includes("删除")
    ? "delete"
    : normalized.includes("send") || label.includes("发送")
      ? "send"
      : normalized.includes("write") || normalized.includes("create") || label.includes("创建")
        ? "create"
        : normalized.includes("network") || label.includes("联网")
          ? "network"
          : normalized.includes("execute") || label.includes("脚本")
            ? "execute"
            : "read";
  return {
    action,
    object: label,
    scope: "待创作者补充",
    purpose: "待创作者说明",
    risk: action === "delete" || action === "send" || action === "execute" ? "high" : action === "create" || action === "network" ? "medium" : "low",
  };
}

export function parseSkillText(source: string, overrides: Partial<GateEDraft> = {}): GateEDraft {
  sourceBytes(source);
  const { meta, body } = simpleFrontmatter(source);
  const heading = body.match(/^#\s+(.+)$/m)?.[1] || "";
  const canonicalName = text(overrides.canonicalName || meta.name || heading || "Untitled Skill", 80);
  const description = text(overrides.description || meta.description || body.split(/\n\n+/)[0], 2_000);
  const licenseSpdx = text(overrides.attribution?.licenseSpdx || meta.license, 80) || null;
  const permissionLabels = uniqueStrings(meta.permissions || meta.allowed_tools || meta["allowed-tools"], 20);
  const containsExecutableScripts = /```\s*(?:sh|bash|zsh|powershell|python|javascript|typescript)|\b(?:npm|pnpm|yarn|pip|uv|npx)\s+(?:install|run|exec)|\bcurl\b[^\n|]*\|\s*(?:sh|bash)/i.test(source);
  const base: GateEDraft = {
    schemaVersion: GATE_E_DRAFT_SCHEMA,
    canonicalName,
    briefZh: text(overrides.briefZh || meta.brief_zh || meta.briefzh, 500),
    description,
    instructions: text(overrides.instructions || body, MAX_INSTRUCTIONS),
    tags: uniqueStrings(overrides.tags || meta.tags, 12),
    inputs: uniqueStrings(overrides.inputs || meta.inputs, 12),
    outputs: uniqueStrings(overrides.outputs || meta.outputs, 12),
    permissions: overrides.permissions || permissionLabels.map(defaultPermission),
    limitations: uniqueStrings(overrides.limitations || meta.limitations, 12),
    attribution: {
      sourceKind: overrides.attribution?.sourceKind || "creator_original",
      sourceRegistry: overrides.attribution?.sourceRegistry || null,
      sourceUrl: safeCreatorSourceUrl(overrides.attribution?.sourceUrl || meta.source_url || meta.repository),
      sourceCommit: text(overrides.attribution?.sourceCommit || meta.source_commit, 120) || null,
      originalAuthor: text(overrides.attribution?.originalAuthor || meta.author, 160) || null,
      publisherRole: overrides.attribution?.publisherRole || "creator",
      rightsStatus: overrides.attribution?.rightsStatus || "missing",
      licenseSpdx,
      licenseEvidenceStatus: overrides.attribution?.licenseEvidenceStatus || (licenseSpdx ? "creator_declared" : "missing"),
      derivedFromReleaseId: overrides.attribution?.derivedFromReleaseId || null,
      derivedFromDigest: overrides.attribution?.derivedFromDigest || null,
    },
    presentationProvenance: {
      canonicalName: meta.name ? "upstream" : "parser_inferred",
      description: meta.description ? "upstream" : "parser_inferred",
      briefZh: overrides.briefZh ? "creator" : "parser_inferred",
      ...(overrides.presentationProvenance || {}),
    },
    execution: {
      containsExecutableScripts,
      hostedExecutionPolicy: "deny",
      directoryMode: "directory_only",
    },
  };
  return canonicalizeDraft({ ...base, ...overrides, attribution: { ...base.attribution, ...(overrides.attribution || {}) }, execution: base.execution });
}

export function canonicalizeDraft(value: unknown): GateEDraft {
  const input = value && typeof value === "object" ? value as Partial<GateEDraft> : {};
  const attribution = input.attribution || {} as GateEDraft["attribution"];
  const permissions = Array.isArray(input.permissions) ? input.permissions.slice(0, 20).map((item) => {
    const permission = item && typeof item === "object" ? item as Partial<GateEPermission> : {};
    const action = ["read", "create", "update", "delete", "send", "network", "execute"].includes(String(permission.action))
      ? permission.action as GateEPermission["action"] : "read";
    const risk = ["low", "medium", "high", "critical"].includes(String(permission.risk))
      ? permission.risk as GateEPermission["risk"] : "medium";
    return { action, object: text(permission.object, 200), scope: text(permission.scope, 300), purpose: text(permission.purpose, 500), risk };
  }) : [];
  return {
    schemaVersion: GATE_E_DRAFT_SCHEMA,
    canonicalName: text(input.canonicalName, 80),
    briefZh: text(input.briefZh, 500),
    description: text(input.description, 2_000),
    instructions: text(input.instructions, MAX_INSTRUCTIONS),
    tags: uniqueStrings(input.tags, 12),
    inputs: uniqueStrings(input.inputs, 12),
    outputs: uniqueStrings(input.outputs, 12),
    permissions,
    limitations: uniqueStrings(input.limitations, 12),
    attribution: {
      sourceKind: ["creator_original", "open_source_attribution", "fork"].includes(String(attribution.sourceKind)) ? attribution.sourceKind : "creator_original",
      sourceRegistry: attribution.sourceRegistry === "openagentskill" || attribution.sourceRegistry === "skillflow_creator" ? attribution.sourceRegistry : null,
      sourceUrl: safeCreatorSourceUrl(attribution.sourceUrl),
      sourceCommit: text(attribution.sourceCommit, 120) || null,
      originalAuthor: text(attribution.originalAuthor, 160) || null,
      publisherRole: ["creator", "derivative_creator", "indexer"].includes(String(attribution.publisherRole)) ? attribution.publisherRole : "creator",
      rightsStatus: ["missing", "creator_attested", "upstream_evidence", "operator_verified", "conflicted"].includes(String(attribution.rightsStatus)) ? attribution.rightsStatus : "missing",
      licenseSpdx: text(attribution.licenseSpdx, 80) || null,
      licenseEvidenceStatus: ["missing", "creator_declared", "upstream_declared", "operator_verified", "conflicted"].includes(String(attribution.licenseEvidenceStatus)) ? attribution.licenseEvidenceStatus : "missing",
      derivedFromReleaseId: text(attribution.derivedFromReleaseId, 240) || null,
      derivedFromDigest: /^sha256:[a-f0-9]{64}$/.test(String(attribution.derivedFromDigest || "")) ? attribution.derivedFromDigest! : null,
    },
    presentationProvenance: input.presentationProvenance && typeof input.presentationProvenance === "object" ? input.presentationProvenance : {},
    execution: {
      containsExecutableScripts: Boolean(input.execution?.containsExecutableScripts),
      hostedExecutionPolicy: "deny",
      directoryMode: "directory_only",
    },
  };
}

function issue(code: string, severity: GateEIssue["severity"], field: string, message: string): GateEIssue {
  return { code, severity, field, message };
}

export function evaluateE1(draft: GateEDraft, checkedAt = new Date().toISOString()): GateEE1Result {
  const issues: GateEIssue[] = [];
  const completeText = stableJson(draft);
  if (draft.canonicalName.length < 2) issues.push(issue("NAME_REQUIRED", "blocker", "canonicalName", "Canonical Name 至少需要 2 个字符"));
  if (draft.description.length < 20) issues.push(issue("DESCRIPTION_INCOMPLETE", "blocker", "description", "原始功能说明至少需要 20 个字符"));
  if (draft.instructions.length < 80) issues.push(issue("INSTRUCTIONS_INCOMPLETE", "blocker", "instructions", "Skill 指令至少需要 80 个字符"));
  if (!/[\u3400-\u9fff]/.test(draft.briefZh) || draft.briefZh.length < 12) issues.push(issue("BRIEF_ZH_REQUIRED", "blocker", "briefZh", "目录 Brief 需要至少 12 个字符的中文说明"));
  if (!draft.inputs.length) issues.push(issue("INPUTS_MISSING", "warning", "inputs", "尚未声明输入，用户难以判断适配条件"));
  if (!draft.outputs.length) issues.push(issue("OUTPUTS_MISSING", "warning", "outputs", "尚未声明输出，结果验收边界不清晰"));
  if (draft.attribution.rightsStatus === "missing" || draft.attribution.rightsStatus === "conflicted") {
    issues.push(issue("RIGHTS_REVIEW_REQUIRED", "manual_review", "attribution.rightsStatus", "需要确认你有权发布该原始或派生内容"));
  }
  if (!draft.attribution.licenseSpdx || !COMMON_LICENSES.has(draft.attribution.licenseSpdx)) {
    issues.push(issue("LICENSE_REVIEW_REQUIRED", "manual_review", "attribution.licenseSpdx", "许可证缺失或未进入当前 SPDX 允许列表，只能保留私有草稿"));
  }
  if (draft.attribution.licenseEvidenceStatus === "missing" || draft.attribution.licenseEvidenceStatus === "conflicted") {
    issues.push(issue("LICENSE_EVIDENCE_REQUIRED", "manual_review", "attribution.licenseEvidenceStatus", "许可证证据缺失或冲突"));
  }
  if (/[\u202A-\u202E\u2066-\u2069]/.test(completeText)) issues.push(issue("BIDI_CONTROL", "blocker", "instructions", "内容包含会混淆显示顺序的控制字符"));
  if (/(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bsk-[A-Za-z0-9_-]{20,}|\bAKIA[0-9A-Z]{16}\b)/.test(completeText)) {
    issues.push(issue("SECRET_DETECTED", "blocker", "instructions", "内容疑似包含密钥或私钥，请先删除"));
  }
  if (/<script\b|on(?:load|error|click)\s*=|javascript\s*:|data\s*:\s*text\/html/i.test(completeText)) {
    issues.push(issue("ACTIVE_CONTENT", "blocker", "instructions", "内容包含主动脚本或危险 URL"));
  }
  if (/ignore (?:all |the )?(?:previous|prior|system) instructions|忽略(?:以上|之前|系统)指令|reveal (?:the )?system prompt|读取.*(?:环境变量|密钥)|(?:exfiltrate|外传).*(?:secret|数据)/i.test(completeText)) {
    issues.push(issue("PROMPT_INJECTION", "blocker", "instructions", "内容包含覆盖系统边界或外传数据的危险指令"));
  }
  if (/\bcurl\b[^\n|]*\|\s*(?:sh|bash)|\bwget\b[^\n|]*\|\s*(?:sh|bash)/i.test(completeText)) {
    issues.push(issue("PIPE_TO_SHELL", "blocker", "instructions", "内容要求下载后直接执行脚本"));
  } else if (draft.execution.containsExecutableScripts || /\b(?:npm|pnpm|yarn|pip|uv|npx)\s+(?:install|run|exec)/i.test(completeText)) {
    issues.push(issue("EXECUTABLE_REFERENCES", "warning", "execution", "检测到脚本或安装指令；该 Release 只能目录展示，Skillflow 不托管执行"));
  }
  if (/(?:100%|百分之百|保证|guaranteed|zero[- ]?error|零错误)/i.test(completeText)) {
    issues.push(issue("UNVERIFIED_CLAIM", "warning", "description", "检测到可能无法验证的绝对效果声明"));
  }
  for (const permission of draft.permissions) {
    if (!permission.object || !permission.scope || !permission.purpose) issues.push(issue("PERMISSION_INCOMPLETE", "blocker", "permissions", "权限必须说明动作、对象、范围和目的"));
    if (["delete", "send", "execute"].includes(permission.action)) issues.push(issue("HIGH_RISK_PERMISSION", "warning", "permissions", `${permission.action} 权限需要使用者逐次人工确认`));
  }
  const hasBlocker = issues.some((item) => item.severity === "blocker");
  const needsManual = issues.some((item) => item.severity === "manual_review");
  const hasWarning = issues.some((item) => item.severity === "warning");
  const status = hasBlocker ? "blocked" : needsManual ? "manual_review_required" : hasWarning ? "passed_with_warnings" : "passed";
  return {
    policyVersion: GATE_E_E1_POLICY,
    status,
    publishEligible: status === "passed" || status === "passed_with_warnings",
    evidenceLabel: "E1 · 结构、来源与风险检查",
    issues,
    hostedExecution: "directory_only",
    checkedAt,
  };
}

export function structuredDraftDiff(before: GateEDraft, after: GateEDraft): GateEStructuredDiff {
  const fields: (keyof GateEDraft)[] = ["canonicalName", "briefZh", "description", "instructions", "tags", "inputs", "outputs", "permissions", "limitations", "attribution", "execution"];
  const changed = fields.flatMap((field) => stableJson(before[field]) === stableJson(after[field]) ? [] : [{ field: String(field), before: before[field], after: after[field] }]);
  const protectedFieldChanges: string[] = [];
  for (const field of [
    "sourceKind", "sourceRegistry", "sourceUrl", "sourceCommit", "originalAuthor", "publisherRole",
    "rightsStatus", "licenseSpdx", "licenseEvidenceStatus", "derivedFromReleaseId", "derivedFromDigest",
  ] as const) {
    if (stableJson(before.attribution[field]) !== stableJson(after.attribution[field])) protectedFieldChanges.push(`attribution.${field}`);
  }
  if (stableJson(before.execution) !== stableJson(after.execution) || after.execution.hostedExecutionPolicy !== "deny" || after.execution.directoryMode !== "directory_only") protectedFieldChanges.push("execution");
  return { changed, protectedFieldChanges };
}

export function assertNoProtectedDraftMutation(before: GateEDraft, after: GateEDraft) {
  const diff = structuredDraftDiff(before, after);
  if (diff.protectedFieldChanges.length) {
    throw new GateEContractError("PROTECTED_SOURCE_CHANGE", "来源、作者、发布角色、权利/许可证证据和托管执行边界不能通过普通编辑修改", 409, { fields: diff.protectedFieldChanges });
  }
  return diff;
}

export function publicReleaseArtifact(draft: GateEDraft, evidence: { e1: GateEE1Result; e2: GateEE2Result | null }) {
  return stableJson({
    schemaVersion: "skillflow-release-v1",
    draft,
    evidence: {
      e1: { policyVersion: evidence.e1.policyVersion, status: evidence.e1.status, evidenceLabel: evidence.e1.evidenceLabel, issues: evidence.e1.issues },
      e2: evidence.e2 ? { policyVersion: evidence.e2.policyVersion, status: evidence.e2.status, evidenceLabel: evidence.e2.evidenceLabel, verdict: evidence.e2.verdict } : null,
    },
  });
}
