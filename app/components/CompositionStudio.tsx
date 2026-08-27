"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AbstractWorkflow, InterviewSnapshot } from "@/lib/gate-b-contracts";
import type {
  BindingRole,
  CompositionExecutionMode,
  CompositionMutation,
  CompositionNode,
  CompositionRecommendation,
  CompositionRevision,
  CompositionValidation,
  NaturalLanguageProposal,
  PermissionRequirement,
  ReleasePin,
  SemanticDiff,
  SkillBinding,
} from "@/lib/gate-c-contracts";

export type CompositionStudioBootstrap =
  | { kind: "gate_b_diagnosis"; snapshot: InterviewSnapshot; workflow: AbstractWorkflow }
  | { kind: "registry_single"; source: "openagentskill" | "skillflow_creator"; slug: string; releaseId?: string; expectedManifestDigest?: string; taskContext?: string };

type CompositionStudioProps = {
  bootstrap: CompositionStudioBootstrap;
  onBack: () => void;
  onRun: (workflowVersionId: string) => void;
};

type Panel = "nodes" | "skills" | "changes";
type Candidate = NonNullable<CompositionRecommendation["primary"]>;
type ApplyIntent = {
  title: string;
  description: string;
  operations: CompositionMutation[];
  preview: { before: string; after: string }[];
  proposal?: NaturalLanguageProposal;
};
type UndoEntry = { revisionId: string; label: string; operations: CompositionMutation[] };
type ApiErrorPayload = { error?: { code?: string; message?: string } };

const EXECUTION_MODES: { value: CompositionExecutionMode; label: string; hint: string }[] = [
  { value: "human_only", label: "人工处理", hint: "该节点不使用 AI 或 Skill" },
  { value: "deterministic", label: "规则自动化", hint: "只执行确定性规则，不依赖生成式 AI" },
  { value: "ai_assist", label: "AI 辅助", hint: "AI 提供分析，人负责完成与判断" },
  { value: "ai_draft_human_approve", label: "AI 起草 · 人工确认", hint: "AI 先完成，人确认后才进入下一步" },
  { value: "ai_auto", label: "AI 优先", hint: "仅适合低风险且边界清楚的节点" },
  { value: "connector_action", label: "外部系统动作", hint: "涉及写入、发送或删除，必须审查权限" },
];

const ROLE_LABELS: Record<BindingRole, string> = {
  prepare: "准备",
  primary: "主处理",
  review: "复核",
  fallback: "兜底",
};

const STATUS_LABELS: Record<CompositionNode["status"], string> = {
  needs_execution_decision: "待决定怎么做",
  needs_skill_selection: "待选择 Skill",
  needs_compatibility_resolution: "兼容性待解决",
  needs_permission_review: "权限待确认",
  configured: "节点已配置",
};

const MODE_LABELS = Object.fromEntries(EXECUTION_MODES.map((item) => [item.value, item.label])) as Record<CompositionExecutionMode, string>;

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sourceSelector(release: ReleasePin) {
  return { source: release.source, slug: release.slug, releaseId: release.releaseId, expectedManifestDigest: release.manifestDigest } as const;
}

function apiMessage(payload: ApiErrorPayload, fallback: string) {
  if (payload.error?.code === "SESSION_EXPIRED") return "当前编排会话已过期。请从已确认的工作画像或 Skill 详情重新进入；页面不会把旧版本伪装成可继续修改。";
  if (payload.error?.code === "STALE_BASE_REVISION") return "当前版本已不是这个会话的最新 head。请重新进入编排，避免覆盖更新后的结构。";
  return payload.error?.message || fallback;
}

function compactDigest(value: string | null | undefined) {
  if (!value) return "未知";
  return value.length > 15 ? `${value.slice(0, 7)}…${value.slice(-6)}` : value;
}

function listText(values: string[], empty = "未声明") {
  return values.length ? values.join("、") : empty;
}

function fitWord(value: "match" | "partial" | "mismatch" | "unknown") {
  return { match: "匹配", partial: "部分匹配", mismatch: "不匹配", unknown: "未知" }[value];
}

function permissionWord(permission: PermissionRequirement) {
  const access = { read: "读取", create: "创建", write: "写入", delete: "删除", send: "发送", unknown: "未知动作" }[permission.access];
  return `${access} · ${permission.capability}`;
}

function getNode(revision: CompositionRevision | null, nodeId: string) {
  return revision?.nodes.find((node) => node.nodeId === nodeId) || null;
}

function candidateKey(candidate: Candidate) {
  return `${candidate.release.source}:${candidate.release.slug}:${candidate.release.manifestDigest}`;
}

function permissionSurfaceDigest(node: CompositionNode | null) {
  return node?.permissionSurfaceDigest || null;
}

function buildInverseOperations(before: CompositionRevision, after: CompositionRevision, operations: CompositionMutation[]) {
  const inverses: CompositionMutation[] = [];
  for (const operation of [...operations].reverse()) {
    const oldNode = getNode(before, operation.nodeId);
    const newNode = getNode(after, operation.nodeId);
    if (!oldNode || !newNode) return [];
    if (operation.type === "set_execution_mode") {
      inverses.push(oldNode.executionMode
        ? { type: "set_execution_mode", nodeId: operation.nodeId, mode: oldNode.executionMode, reason: "撤销上一项执行方式修改" }
        : { type: "clear_execution_mode", nodeId: operation.nodeId, reason: "撤销上一项执行方式修改" });
      if (operation.mode === "human_only" && oldNode.skillBindings.length) {
        for (const binding of [...oldNode.skillBindings].sort((a, b) => a.order - b.order)) {
          inverses.push({
            type: "bind_release",
            nodeId: operation.nodeId,
            selector: sourceSelector(binding.release),
            role: binding.role,
            order: binding.order,
            reason: "撤销纯人工模式并恢复原 Skill 绑定",
          });
        }
      }
    } else if (operation.type === "clear_execution_mode") {
      if (!oldNode.executionMode) return [];
      inverses.push({ type: "set_execution_mode", nodeId: operation.nodeId, mode: oldNode.executionMode, reason: "撤销执行方式清除" });
    } else if (operation.type === "set_constraints") {
      inverses.push({ type: "set_constraints", nodeId: operation.nodeId, constraints: oldNode.constraints, reason: "撤销上一项节点约束修改" });
    } else if (operation.type === "bind_release") {
      const oldIds = new Set(oldNode.skillBindings.map((binding) => binding.bindingId));
      const added = newNode.skillBindings.find((binding) => !oldIds.has(binding.bindingId));
      if (!added) return [];
      inverses.push({ type: "unbind_release", nodeId: operation.nodeId, bindingId: added.bindingId, reason: "撤销上一项 Skill 添加" });
    } else if (operation.type === "unbind_release") {
      const removed = oldNode.skillBindings.find((binding) => binding.bindingId === operation.bindingId);
      if (!removed) return [];
      inverses.push({
        type: "bind_release",
        nodeId: operation.nodeId,
        selector: sourceSelector(removed.release),
        role: removed.role,
        order: removed.order,
        reason: "撤销上一项 Skill 移除",
      });
    } else if (operation.type === "replace_release") {
      const replaced = oldNode.skillBindings.find((binding) => binding.bindingId === operation.bindingId);
      const current = newNode.skillBindings.find((binding) => binding.bindingId === operation.bindingId)
        || newNode.skillBindings.find((binding) => binding.order === replaced?.order);
      if (!replaced || !current) return [];
      inverses.push({
        type: "replace_release",
        nodeId: operation.nodeId,
        bindingId: current.bindingId,
        selector: sourceSelector(replaced.release),
        role: replaced.role,
        reason: "撤销上一项 Skill 替换",
      });
    } else if (operation.type === "reorder_releases") {
      inverses.push({
        type: "reorder_releases",
        nodeId: operation.nodeId,
        bindingIds: [...oldNode.skillBindings].sort((a, b) => a.order - b.order).map((binding) => binding.bindingId),
        reason: "撤销上一项顺序修改",
      });
    } else {
      return [];
    }
  }
  return inverses;
}

function Glyph({ children }: { children: string }) {
  return <span className="gc-glyph" aria-hidden="true">{children}</span>;
}

function ReleaseIdentity({ release }: { release: ReleasePin }) {
  return (
    <div className="gc-release-identity">
      <span>{release.canonicalName.slice(0, 2).toUpperCase()}</span>
      <div>
        <strong>{release.canonicalName}</strong>
        <small>{release.author.name} · {release.version ? `v${release.version}` : "清单快照"}</small>
      </div>
    </div>
  );
}

function DiffPreview({ intent }: { intent: ApplyIntent }) {
  return (
    <div className="gc-diff-list">
      {intent.preview.map((change, index) => (
        <article key={`${change.before}-${index}`}>
          <small>变更 {String(index + 1).padStart(2, "0")}</small>
          <div><del>{change.before}</del><span aria-hidden="true">→</span><ins>{change.after}</ins></div>
        </article>
      ))}
      {intent.proposal?.unresolvedVariantRequirements.map((requirement) => (
        <p className="gc-unresolved" key={requirement}>仍需确认：{requirement}</p>
      ))}
    </div>
  );
}

export default function CompositionStudio({ bootstrap, onBack, onRun }: CompositionStudioProps) {
  const [revision, setRevision] = useState<CompositionRevision | null>(null);
  const [history, setHistory] = useState<CompositionRevision[]>([]);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [mobilePanel, setMobilePanel] = useState<Panel>("nodes");
  const [recommendation, setRecommendation] = useState<CompositionRecommendation | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [replaceBindingId, setReplaceBindingId] = useState<string | null>(null);
  const [bindingRole, setBindingRole] = useState<BindingRole>("primary");
  const [intent, setIntent] = useState<ApplyIntent | null>(null);
  const [instruction, setInstruction] = useState("");
  const [constraintsDraft, setConstraintsDraft] = useState("");
  const [pending, setPending] = useState<"bootstrap" | "recommend" | "revise" | "propose" | "validate" | "save" | null>("bootstrap");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [validation, setValidation] = useState<CompositionValidation | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const composingRef = useRef(false);
  const requestControllerRef = useRef<AbortController | null>(null);
  const intentHeadingRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const intentTriggerRef = useRef<HTMLElement | null>(null);
  const instructionRef = useRef<HTMLTextAreaElement>(null);
  const recommendationKeyRef = useRef("");

  const selectedNode = useMemo(() => getNode(revision, selectedNodeId), [revision, selectedNodeId]);
  const candidates = useMemo(() => {
    if (!recommendation) return [];
    return [recommendation.primary, ...recommendation.alternatives.slice(0, 2)].filter((candidate): candidate is Candidate => Boolean(candidate));
  }, [recommendation]);

  const abortRequest = useCallback(() => {
    requestControllerRef.current?.abort();
  }, []);

  const post = useCallback(async <T,>(path: "bootstrap" | "recommend" | "revise" | "validate", body: unknown, kind: typeof pending) => {
    abortRequest();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setPending(kind);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/workflows/composition/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const payload = await response.json() as T & ApiErrorPayload;
      if (!response.ok) throw new Error(apiMessage(payload, "请求没有完成，当前会话版本保持不变。"));
      return payload;
    } catch (caught) {
      if (requestControllerRef.current !== controller) return null;
      if (caught instanceof Error && caught.name === "AbortError") {
        setNotice("已取消请求，当前会话版本没有改变。");
      } else {
        setError(caught instanceof Error ? caught.message : "连接失败，当前会话版本保持不变。");
      }
      return null;
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
        setPending(null);
      }
    }
  }, [abortRequest]);

  useEffect(() => {
    let active = true;
    async function start() {
      const source = bootstrap.kind === "gate_b_diagnosis"
        ? { kind: "gate_b_diagnosis" as const, snapshot: bootstrap.snapshot, workflow: bootstrap.workflow }
        : { kind: "registry_single" as const, source: bootstrap.source, slug: bootstrap.slug, releaseId: bootstrap.releaseId, expectedManifestDigest: bootstrap.expectedManifestDigest, taskContext: bootstrap.taskContext };
      const payload = await post<{ revision?: CompositionRevision }>("bootstrap", { source }, "bootstrap");
      if (!active || !payload?.revision) return;
      setRevision(payload.revision);
      setHistory([payload.revision]);
      setValidation(payload.revision.validation);
      setSelectedNodeId(payload.revision.nodes[0]?.nodeId || "");
      setConstraintsDraft(payload.revision.nodes[0]?.constraints.join("\n") || "");
    }
    void start();
    return () => { active = false; abortRequest(); };
  }, [abortRequest, bootstrap, bootstrapAttempt, post]);

  useEffect(() => {
    if (!intent) return;
    intentHeadingRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && pending !== "revise") {
        event.preventDefault();
        setIntent(null);
        window.requestAnimationFrame(() => intentTriggerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), [href], textarea, select, [tabindex]:not([tabindex='-1'])") || []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [intent, pending]);

  function selectNode(nodeId: string) {
    setSelectedNodeId(nodeId);
    setConstraintsDraft(getNode(revision, nodeId)?.constraints.join("\n") || "");
    setRecommendation(null);
    setSelectedCandidate(null);
    setReplaceBindingId(null);
    setBindingRole(getNode(revision, nodeId)?.skillBindings.length ? "review" : "primary");
    recommendationKeyRef.current = "";
    setMobilePanel("skills");
  }

  function openIntent(next: ApplyIntent, trigger?: HTMLElement | null) {
    intentTriggerRef.current = trigger || document.activeElement as HTMLElement | null;
    setIntent(next);
  }

  async function loadRecommendation() {
    if (!revision || !selectedNode || pending) return;
    const key = `${revision.graphDigest}:${selectedNode.nodeId}`;
    recommendationKeyRef.current = key;
    const payload = await post<{ recommendation?: CompositionRecommendation }>(
      "recommend",
      { revision, nodeId: selectedNode.nodeId, limit: 3 },
      "recommend",
    );
    if (!payload?.recommendation || recommendationKeyRef.current !== key) return;
    setRecommendation({ ...payload.recommendation, alternatives: payload.recommendation.alternatives.slice(0, 2) });
    const first = payload.recommendation.primary || payload.recommendation.alternatives[0] || null;
    setSelectedCandidate(first);
    setBindingRole(selectedNode.skillBindings.length ? "review" : "primary");
    setMobilePanel("skills");
  }

  async function applyOperations(operations: CompositionMutation[], label: string, isUndo = false, actor: SemanticDiff["actor"] = "user", mutationId = uid("mutation")) {
    if (!revision || pending || !operations.length) return false;
    const before = revision;
    const payload = await post<{ revision?: CompositionRevision; diff?: SemanticDiff }>(
      "revise",
      {
        mode: "apply",
        baseRevision: revision,
        expectedBaseDigest: revision.graphDigest,
        expectedHeadToken: revision.session.headToken,
        requestSeq: revision.session.headSequence + 1,
        mutationId,
        actor,
        operations,
      },
      "revise",
    );
    if (!payload?.revision) return false;
    const next = payload.revision;
    setRevision(next);
    setHistory((current) => [...current, next]);
    setValidation(next.validation);
    setConstraintsDraft(getNode(next, selectedNodeId)?.constraints.join("\n") || "");
    setIntent(null);
    setRecommendation(null);
    setSelectedCandidate(null);
    recommendationKeyRef.current = "";
    if (!isUndo) {
      const inverse = buildInverseOperations(before, next, operations);
      if (inverse.length) setUndoStack((current) => [...current, { revisionId: next.revisionId, label, operations: inverse }]);
    }
    setNotice(`已生成会话版本 R${next.revisionNumber}。这项修改尚未保存，也没有运行。`);
    setMobilePanel("changes");
    window.requestAnimationFrame(() => intentTriggerRef.current?.focus());
    return true;
  }

  async function proposeInstruction() {
    const clean = instruction.trim();
    if (!revision || !clean || pending) return;
    const payload = await post<{ proposal?: NaturalLanguageProposal }>(
      "revise",
      { mode: "propose", baseRevision: revision, expectedBaseDigest: revision.graphDigest, expectedHeadToken: revision.session.headToken, instruction: clean },
      "propose",
    );
    if (!payload?.proposal) {
      if (!error) setError("自然语言的结构化提案接口尚未配置。当前文字已保留，你仍可使用页面上的明确控件修改。");
      return;
    }
    const proposal = payload.proposal;
    setIntent({
      title: "检查 AI 理解后的修改",
      description: "这只是结构化提案。确认后才会生成新的当前会话版本。",
      operations: proposal.operations,
      proposal,
      preview: proposal.previewDiff.changes.map((change) => ({ before: String(change.before ?? "无"), after: String(change.after ?? "无") })),
    });
  }

  async function validateRevision() {
    if (!revision || pending) return;
    const payload = await post<{ validation?: CompositionValidation }>("validate", { revision }, "validate");
    if (!payload?.validation) return;
    setValidation(payload.validation);
    setNotice(payload.validation.valid ? "当前结构校验通过；仍然只是未保存、未运行的会话版本。" : "发现需要处理的配置问题，当前版本未被改动。");
  }

  async function saveAndRun() {
    if (!revision || pending) return;
    if (!validation?.valid || revision.state !== "composition_ready") {
      setError("当前编排还有未解决的节点、权限或兼容性问题，不能保存为可运行版本。");
      return;
    }
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setPending("save");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/workflows/composition/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ revision }),
        signal: controller.signal,
      });
      const payload = await response.json() as { workflowVersionId?: string; error?: { code?: string; message?: string } };
      if (!response.ok || !payload.workflowVersionId) {
        throw new Error(payload.error?.message || "无法保存为可运行版本");
      }
      setNotice("服务器已保存不可变 WorkflowVersion，并完成访谈沙箱预编译。");
      onRun(payload.workflowVersionId);
    } catch (reason) {
      if ((reason as Error).name !== "AbortError") setError(reason instanceof Error ? reason.message : "无法保存为可运行版本");
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
      setPending(null);
    }
  }

  async function undoLatest() {
    const latest = undoStack.at(-1);
    if (!latest || !revision || pending) return;
    const applied = await applyOperations(latest.operations, `撤销：${latest.label}`, true);
    if (applied) setUndoStack((current) => current.slice(0, -1));
  }

  function previewMode(mode: CompositionExecutionMode, event: React.MouseEvent<HTMLButtonElement>) {
    if (!selectedNode || selectedNode.executionMode === mode) return;
    openIntent({
      title: "确认节点执行方式",
      description: "执行方式和 Skill 绑定相互独立。选择人工处理时，此节点可以保持零 Skill。",
      operations: [{ type: "set_execution_mode", nodeId: selectedNode.nodeId, mode, reason: "用户调整节点执行方式" }],
      preview: [
        { before: selectedNode.executionMode ? MODE_LABELS[selectedNode.executionMode] : "尚未决定", after: MODE_LABELS[mode] },
        ...(mode === "human_only" && selectedNode.skillBindings.length ? [{ before: `${selectedNode.skillBindings.length} 个 Skill 绑定`, after: "切换纯人工后全部移除" }] : []),
      ],
    }, event.currentTarget);
  }

  function previewConstraints(event: React.MouseEvent<HTMLButtonElement>) {
    if (!selectedNode) return;
    const constraints = constraintsDraft.split("\n").map((value) => value.trim()).filter(Boolean);
    if (JSON.stringify(constraints) === JSON.stringify(selectedNode.constraints)) return;
    openIntent({
      title: "确认节点边界",
      description: "这些边界会参与后续推荐和校验，不会改写 Skill 作者声明。",
      operations: [{ type: "set_constraints", nodeId: selectedNode.nodeId, constraints, reason: "用户修订节点边界" }],
      preview: [{ before: listText(selectedNode.constraints, "尚未设置"), after: listText(constraints, "清空边界") }],
    }, event.currentTarget);
  }

  function previewBind(candidate: Candidate, event: React.MouseEvent<HTMLButtonElement>) {
    if (!selectedNode) return;
    const replace = replaceBindingId ? selectedNode.skillBindings.find((binding) => binding.bindingId === replaceBindingId) : null;
    const operation: CompositionMutation = replace
      ? { type: "replace_release", nodeId: selectedNode.nodeId, bindingId: replace.bindingId, selector: sourceSelector(candidate.release), role: replace.role, reason: "用户替换节点 Skill" }
      : { type: "bind_release", nodeId: selectedNode.nodeId, selector: sourceSelector(candidate.release), role: bindingRole, reason: "用户添加节点 Skill" };
    openIntent({
      title: replace ? "确认替换 Skill" : "确认添加 Skill",
      description: "确认的是固定版本或清单快照。适配度不等于来源质量，权限与未知项仍需单独处理。",
      operations: [operation],
      preview: [
        { before: replace?.release.canonicalName || "此节点不绑定 Skill", after: candidate.release.canonicalName },
        { before: "当前权限与兼容状态", after: "按服务端固定 Release 重新计算并等待复核" },
      ],
    }, event.currentTarget);
  }

  function previewRemove(binding: SkillBinding, event: React.MouseEvent<HTMLButtonElement>) {
    if (!selectedNode) return;
    openIntent({
      title: "确认移除 Skill",
      description: "移除不会删除市场中的 Skill，只会创建一个新的当前会话版本。",
      operations: [{ type: "unbind_release", nodeId: selectedNode.nodeId, bindingId: binding.bindingId, reason: "用户移除节点 Skill" }],
      preview: [{ before: binding.release.canonicalName, after: "此绑定已移除" }, { before: "当前权限与兼容状态", after: "按剩余组合重新计算并等待复核" }],
    }, event.currentTarget);
  }

  function previewReorder(binding: SkillBinding, direction: -1 | 1, event: React.MouseEvent<HTMLButtonElement>) {
    if (!selectedNode) return;
    const bindings = [...selectedNode.skillBindings].sort((a, b) => a.order - b.order);
    const from = bindings.findIndex((item) => item.bindingId === binding.bindingId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= bindings.length) return;
    [bindings[from], bindings[to]] = [bindings[to], bindings[from]];
    openIntent({
      title: "确认调整 Skill 顺序",
      description: "多 Skill 只表示节点内的线性先后关系，不创建分支、循环或并行图。",
      operations: [{ type: "reorder_releases", nodeId: selectedNode.nodeId, bindingIds: bindings.map((item) => item.bindingId), reason: "用户调整节点内 Skill 顺序" }],
      preview: [{ before: selectedNode.skillBindings.map((item) => item.release.canonicalName).join(" → "), after: bindings.map((item) => item.release.canonicalName).join(" → ") }, { before: "原顺序兼容性", after: "按新相邻关系重新校验" }],
    }, event.currentTarget);
  }

  function previewPermissionReview(event: React.MouseEvent<HTMLButtonElement>) {
    const surfaceDigest = permissionSurfaceDigest(selectedNode);
    if (!selectedNode || !surfaceDigest) return;
    openIntent({
      title: "确认已阅读权限范围",
      description: "这里只记录你已审阅当前权限清单，不会连接账号，也不会授予权限。权限清单变化后需要重新审阅。",
      operations: [{ type: "acknowledge_permissions", nodeId: selectedNode.nodeId, permissionDigest: surfaceDigest, reason: "用户已阅读当前权限范围" }],
      preview: [{ before: selectedNode.permissionReviewDigest === surfaceDigest ? "当前权限范围已阅读" : "权限范围待阅读", after: `已阅读 ${compactDigest(surfaceDigest)}` }],
    }, event.currentTarget);
  }

  if (!revision) {
    return (
      <main className="gc-studio gc-loading-shell" aria-busy={pending === "bootstrap"}>
        <div className="gc-loading-orb" aria-hidden="true"><i /><i /><i /></div>
        <h1>正在建立节点编排上下文</h1>
        <p>{error || "只读取已确认的工作流与 Skill 目录信息，不连接账号、不保存、不运行。"}</p>
        {error ? <div className="gc-loading-actions"><button className="gc-button" type="button" onClick={() => { setError(""); setPending("bootstrap"); setBootstrapAttempt((value) => value + 1); }}>重试建立</button><button className="gc-button" type="button" onClick={onBack}>返回上一页</button></div> : null}
      </main>
    );
  }

  return (
    <main className="gc-studio">
      <header className="gc-head">
        <div className="gc-head-leading">
          <button className="gc-icon-button" type="button" onClick={onBack} aria-label="返回上一页">←</button>
          <div>
            <span className="gc-kicker">WORKFLOW COMPOSITION · GATE C</span>
            <h1>{revision.source.title}</h1>
            <p>逐节点决定人和 AI 如何协作，再挑选有证据、可追溯的 Skill 或组合。</p>
          </div>
        </div>
        <div className="gc-session-state" aria-label="当前版本状态">
          <span>R{revision.revisionNumber}</span>
          <div><strong>当前会话修订</strong><small>未保存 · 未运行</small></div>
        </div>
      </header>

      <nav className="gc-mobile-tabs" aria-label="编排工作区">
        {(["nodes", "skills", "changes"] as const).map((panel) => (
          <button key={panel} type="button" className={mobilePanel === panel ? "active" : ""} onClick={() => setMobilePanel(panel)}>
            {{ nodes: "节点", skills: "Skill", changes: "变更" }[panel]}
          </button>
        ))}
      </nav>

      <div className="gc-grid">
        <aside className={`gc-panel gc-outline ${mobilePanel === "nodes" ? "gc-mobile-active" : ""}`} aria-label="工作流节点">
          <div className="gc-panel-head">
            <div><span>01</span><strong>工作流节点</strong></div>
            <small>{revision.nodes.length} 个真实节点</small>
          </div>
          <div className="gc-source-note">
            <Glyph>⌁</Glyph>
            <div><strong>{revision.source.kind === "gate_b_diagnosis" ? "来自已确认的工作画像" : "来自单 Skill 入口"}</strong><p>{revision.source.taskContext}</p></div>
          </div>
          <ol className="gc-node-list">
            {revision.nodes.map((node, index) => (
              <li key={node.nodeId}>
                <button type="button" className={selectedNodeId === node.nodeId ? "active" : ""} onClick={() => selectNode(node.nodeId)} aria-current={selectedNodeId === node.nodeId ? "step" : undefined}>
                  <span className="gc-node-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="gc-node-copy"><strong>{node.label}</strong><small>{STATUS_LABELS[node.status]}</small></span>
                  <i className={`gc-status-dot ${node.status}`} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
          <div className="gc-boundaries">
            <span>全局边界</span>
            {revision.source.boundaries.length ? revision.source.boundaries.map((boundary) => <p key={boundary}>— {boundary}</p>) : <p>尚未声明额外边界</p>}
          </div>
        </aside>

        <section className={`gc-panel gc-canvas ${mobilePanel === "skills" ? "gc-mobile-active" : ""}`} aria-label="节点配置">
          {selectedNode ? (
            <>
              <div className="gc-node-head">
                <div>
                  <span className="gc-kicker">SELECTED NODE · {selectedNode.riskLevel.toUpperCase()} RISK</span>
                  <h2>{selectedNode.label}</h2>
                  <p>{selectedNode.purpose}</p>
                </div>
                <span className={`gc-node-state ${selectedNode.status}`}>{STATUS_LABELS[selectedNode.status]}</span>
              </div>

              <section className="gc-section">
                <div className="gc-section-title">
                  <div><span>1</span><h3>这个节点应该怎么做</h3></div>
                  <small>执行方式 ≠ Skill 绑定</small>
                </div>
                <div className="gc-mode-grid" role="radiogroup" aria-label="节点执行方式">
                  {EXECUTION_MODES.map((mode) => (
                    <button key={mode.value} type="button" role="radio" aria-checked={selectedNode.executionMode === mode.value} className={selectedNode.executionMode === mode.value ? "active" : ""} onClick={(event) => previewMode(mode.value, event)}>
                      <i aria-hidden="true" /><span><strong>{mode.label}</strong><small>{mode.hint}</small></span>
                    </button>
                  ))}
                </div>
                <div className="gc-responsibility-grid">
                  <article><span>AI 的责任</span><p>{selectedNode.aiResponsibility || "尚未定义"}</p></article>
                  <article><span>人的责任</span><p>{selectedNode.humanResponsibility || "尚未定义"}</p></article>
                </div>
              </section>

              <section className="gc-section">
                <div className="gc-section-title">
                  <div><span>2</span><h3>此节点的 Skill 组合</h3></div>
                  <small>零个、一个或有序多个都可以</small>
                </div>
                {selectedNode.skillBindings.length ? (
                  <ol className="gc-binding-list">
                    {[...selectedNode.skillBindings].sort((a, b) => a.order - b.order).map((binding, index, bindings) => (
                      <li key={binding.bindingId}>
                        <span className="gc-sequence-number">{String(index + 1).padStart(2, "0")}</span>
                        <ReleaseIdentity release={binding.release} />
                        <span className="gc-role">{ROLE_LABELS[binding.role]}</span>
                        <div className="gc-binding-actions">
                          <button type="button" onClick={() => { setRecommendation(null); setSelectedCandidate({ release: binding.release, assessment: binding.fitAssessment }); setMobilePanel("changes"); }}>证据</button>
                          <button type="button" onClick={(event) => previewReorder(binding, -1, event)} disabled={index === 0} aria-label={`上移 ${binding.release.canonicalName}`}>↑</button>
                          <button type="button" onClick={(event) => previewReorder(binding, 1, event)} disabled={index === bindings.length - 1} aria-label={`下移 ${binding.release.canonicalName}`}>↓</button>
                          <button type="button" onClick={() => { setReplaceBindingId(binding.bindingId); void loadRecommendation(); }}>替换</button>
                          <button type="button" onClick={(event) => previewRemove(binding, event)}>移除</button>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="gc-zero-state">
                    <Glyph>○</Glyph><div><strong>当前是零 Skill 节点</strong><p>这不是错误。人工处理或规则自动化可以不绑定 Skill；需要 AI 时再查找。</p></div>
                  </div>
                )}
                {selectedNode.compatibility.length ? (
                  <div className="gc-compatibility" aria-label="节点内 Skill 兼容性">
                    <span>顺序兼容性</span>
                    {selectedNode.compatibility.map((item) => (
                      <p className={item.status} key={`${item.fromBindingId}-${item.toBindingId}`}><strong>{item.status === "compatible" ? "兼容" : item.status === "adapter_required" ? "需要适配" : item.status === "incompatible" ? "不兼容" : "未知"}</strong>{item.reason}</p>
                    ))}
                  </div>
                ) : null}
                {selectedNode.aggregateLimitations.length ? <div className="gc-node-limitations"><span>组合限制</span>{selectedNode.aggregateLimitations.map((item) => <p key={item}>— {item}</p>)}</div> : null}
                <button className="gc-find-button" type="button" onClick={() => { setReplaceBindingId(null); void loadRecommendation(); }} disabled={Boolean(pending)}>
                  <span>{pending === "recommend" ? "正在核对目录证据…" : "+ 为此节点查找 Skill"}</span><small>最多展示 1 个主推荐和 2 个备选</small>
                </button>
              </section>

              <section className="gc-section gc-constraints">
                <div className="gc-section-title"><div><span>3</span><h3>节点边界与例外</h3></div><small>一行一条</small></div>
                <textarea value={constraintsDraft} onChange={(event) => setConstraintsDraft(event.target.value)} rows={3} aria-label="节点边界与例外" placeholder="例如：对外发送前必须由负责人确认" />
                <button type="button" onClick={previewConstraints}>预览边界修改</button>
              </section>
            </>
          ) : <div className="gc-empty"><Glyph>⌁</Glyph><strong>没有可配置节点</strong><p>服务端没有返回工作流节点，当前不会自行编造。</p></div>}
        </section>

        <aside className={`gc-panel gc-inspector ${mobilePanel === "changes" ? "gc-mobile-active" : ""}`} aria-label="推荐证据与版本变更">
          <div className="gc-panel-head"><div><span>03</span><strong>证据与变更</strong></div><small>当前节点</small></div>

          {recommendation ? (
            <section className="gc-recommendations">
              <div className="gc-inspector-title"><div><span>NODE-SCOPED MATCH</span><h3>只为「{selectedNode?.label}」推荐</h3></div><button type="button" onClick={() => { setRecommendation(null); setSelectedCandidate(null); }}>关闭</button></div>
              <p className="gc-notice">{recommendation.notice}</p>
              {recommendation.status === "no_match" ? (
                <div className="gc-honest-empty"><strong>没有达到门槛的 Skill</strong><p>可以保留零 Skill、调整节点边界，或稍后扩充目录。系统不会为了填满卡片而推荐。</p></div>
              ) : (
                <>
                  <div className="gc-candidate-tabs" role="tablist" aria-label="推荐候选">
                    {candidates.map((candidate, index) => (
                      <button type="button" role="tab" aria-selected={Boolean(selectedCandidate && candidateKey(selectedCandidate) === candidateKey(candidate))} key={candidateKey(candidate)} className={selectedCandidate && candidateKey(selectedCandidate) === candidateKey(candidate) ? "active" : ""} onClick={() => setSelectedCandidate(candidate)}>
                        <span>{index === 0 && recommendation.primary ? "主推荐" : `备选 ${recommendation.primary ? index : index + 1}`}</span>
                        <strong>{candidate.release.canonicalName}</strong>
                        <em>任务{fitWord(candidate.assessment.structureFit.task)} · 质量{candidate.release.registrySignals.quality.value ?? "?"}</em>
                      </button>
                    ))}
                  </div>
                  {!replaceBindingId ? (
                    <label className="gc-role-picker">添加到节点时的职责
                      <select value={bindingRole} onChange={(event) => setBindingRole(event.target.value as BindingRole)}>
                        {(Object.keys(ROLE_LABELS) as BindingRole[]).map((role) => <option value={role} key={role}>{ROLE_LABELS[role]}</option>)}
                      </select>
                    </label>
                  ) : null}
                  {selectedCandidate ? <CandidateEvidence candidate={selectedCandidate} onBind={previewBind} replacing={Boolean(replaceBindingId)} /> : null}
                </>
              )}
              {recommendation.sourceStatus.registry === "unavailable" ? <p className="gc-source-warning">外部目录当前不可用：{recommendation.sourceStatus.registryMessage || "原因未知"}。已展示的结果可能不完整。</p> : null}
            </section>
          ) : selectedCandidate ? (
            <section className="gc-recommendations">
              <div className="gc-inspector-title"><div><span>BOUND RELEASE EVIDENCE</span><h3>已绑定 Skill 的证据</h3></div><button type="button" onClick={() => setSelectedCandidate(null)}>关闭</button></div>
              <p className="gc-notice">这是该节点当前会话版本中固定的 Release 证据，不是一次新的推荐。</p>
              <CandidateEvidence candidate={selectedCandidate} replacing={false} />
            </section>
          ) : (
            <section className="gc-evidence-empty">
              <div className="gc-radar" aria-hidden="true"><i /><i /><span /></div>
              <strong>证据随节点出现</strong>
              <p>先选择一个真实工作流节点，再查找 Skill。这里会同时展示适配证据、来源质量、版本锁定、许可、权限和未知项。</p>
            </section>
          )}

          {selectedNode?.aggregatePermissions.length ? (
            <section className="gc-permission-summary">
              <div className="gc-inspector-title"><div><span>PERMISSION SURFACE</span><h3>组合权限总面</h3></div>{permissionSurfaceDigest(selectedNode) && selectedNode.permissionReviewDigest === permissionSurfaceDigest(selectedNode) ? <small className="gc-reviewed">本版已阅读</small> : null}</div>
              {selectedNode.aggregatePermissions.map((permission, index) => <PermissionRow permission={permission} key={`${permission.capability}-${index}`} />)}
              {permissionSurfaceDigest(selectedNode) ? <button type="button" onClick={previewPermissionReview}>{selectedNode.permissionReviewDigest === permissionSurfaceDigest(selectedNode) ? "重新阅读当前权限范围" : "阅读后记录本次确认"}</button> : <p>权限范围摘要尚未形成，不能确认。</p>}
            </section>
          ) : null}

          <section className="gc-change-panel">
            <div className="gc-inspector-title">
              <div><span>SESSION REVISION</span><h3>当前会话变更</h3></div>
              <button type="button" onClick={() => void undoLatest()} disabled={!undoStack.length || Boolean(pending)}>撤销上一项</button>
            </div>
            <div className="gc-validation-summary">
              <span className={validation?.valid ? "valid" : "invalid"}>{validation?.valid ? "结构通过" : "仍需处理"}</span>
              <button type="button" onClick={() => void validateRevision()} disabled={Boolean(pending)}>重新校验</button>
            </div>
            {validation?.errors.slice(0, 3).map((item) => <p className="gc-validation-item error" key={`${item.code}-${item.nodeId}`}>{item.message}</p>)}
            {validation?.warnings.slice(0, 2).map((item) => <p className="gc-validation-item warning" key={`${item.code}-${item.nodeId}`}>{item.message}</p>)}
            <ol className="gc-history">
              {[...history].reverse().slice(0, 6).map((item) => (
                <li key={item.revisionId}><span>R{item.revisionNumber}</span><div><strong>{item.diffFromParent?.summaryZh || "建立编排基线"}</strong><small>{new Date(item.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} · {compactDigest(item.graphDigest)}</small></div></li>
              ))}
            </ol>
          </section>

          <section className="gc-language-edit">
            <label htmlFor="gc-instruction">用自然语言纠正组合</label>
            <p>例如：“第 2 步改成人工确认，把复核 Skill 放到最后。”AI 只生成结构化提案，先看 Diff 再决定。</p>
            <textarea id="gc-instruction" ref={instructionRef} value={instruction} onChange={(event) => setInstruction(event.target.value)} onCompositionStart={() => { composingRef.current = true; }} onCompositionEnd={() => { composingRef.current = false; }} onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !composingRef.current && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void proposeInstruction();
              }
            }} rows={3} placeholder="描述你想改哪里…" />
            <div><small>Enter 提交 · Shift + Enter 换行</small><button type="button" onClick={() => void proposeInstruction()} disabled={!instruction.trim() || Boolean(pending)}>{pending === "propose" ? "正在生成提案…" : "生成修改提案"}</button></div>
          </section>
        </aside>
      </div>

      <footer className="gc-footer"><div><span>{revision.state === "composition_ready" && validation?.valid ? "结构已通过 · 可保存为真实版本" : "当前会话修订 · 尚未满足运行条件"}</span><p>保存时服务器会重新核验 Release、权限、版本摘要和访谈适配器；上游安装型 Skill 不会被偷偷执行。</p></div><button className="gc-run-button" type="button" onClick={() => void saveAndRun()} disabled={Boolean(pending) || !validation?.valid || revision.state !== "composition_ready"}>{pending === "save" ? "正在保存与预编译…" : "保存 WorkflowVersion 并试运行 ↗"}</button></footer>

      {(error || notice || (pending && pending !== "bootstrap")) ? (
        <div className={`gc-toast ${error ? "error" : ""}`} role={error ? "alert" : "status"} aria-live={error ? "assertive" : "polite"}>
          <p>{error || notice || ({ recommend: "正在核对节点推荐证据…", revise: "正在生成新的会话版本…", propose: "正在把你的话转成结构化提案…", validate: "正在重新校验当前结构…", save: "正在把当前编排保存为不可变 WorkflowVersion…" }[pending as Exclude<typeof pending, "bootstrap" | "turn" | null>] || "请求处理中…")}</p>
          {pending ? <button type="button" onClick={abortRequest}>取消请求</button> : <button type="button" onClick={() => { setError(""); setNotice(""); }}>关闭</button>}
        </div>
      ) : null}

      {intent ? (
        <div className="gc-dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && pending !== "revise") setIntent(null);
        }}>
          <section className="gc-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="gc-intent-title">
            <div className="gc-dialog-head"><div><span>SEMANTIC DIFF</span><h2 id="gc-intent-title" ref={intentHeadingRef} tabIndex={-1}>{intent.title}</h2></div><button type="button" onClick={() => setIntent(null)} disabled={pending === "revise"} aria-label="关闭变更预览">×</button></div>
            <p>{intent.description}</p>
            <DiffPreview intent={intent} />
            <div className="gc-dialog-note"><Glyph>i</Glyph><p>确认后会生成新的不可变会话版本；不会保存到个人资产，也不会运行任何 Skill。</p></div>
            <div className="gc-dialog-actions"><button type="button" onClick={() => setIntent(null)} disabled={pending === "revise"}>{intent.operations.length ? "返回修改" : "知道了"}</button><button type="button" onClick={() => void applyOperations(intent.operations, intent.title, false, intent.proposal ? "ai_proposal_accepted" : "user", intent.proposal?.proposalId)} disabled={pending === "revise" || !intent.operations.length}>{pending === "revise" ? "正在提交…" : intent.operations.length ? "确认并生成新版本" : "没有可安全应用的修改"}</button></div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function PermissionRow({ permission }: { permission: PermissionRequirement }) {
  return (
    <article className={`gc-permission ${permission.risk}`}>
      <span>{permission.risk === "high" ? "高" : permission.risk === "medium" ? "中" : permission.risk === "low" ? "低" : "?"}</span>
      <div><strong>{permissionWord(permission)}</strong><p>{permission.reason}</p></div>
    </article>
  );
}

function CandidateEvidence({ candidate, onBind, replacing }: { candidate: Candidate; onBind?: (candidate: Candidate, event: React.MouseEvent<HTMLButtonElement>) => void; replacing: boolean }) {
  const { release, assessment } = candidate;
  return (
    <article className="gc-candidate-detail">
      <ReleaseIdentity release={release} />
      <div className="gc-evidence-split">
        <section>
          <span>当前节点适配度</span>
          <strong>{assessment.verdict === "recommended" ? "推荐" : assessment.verdict === "candidate" ? "可选" : assessment.verdict === "not_recommended" ? "不推荐" : "证据不足"}</strong>
          <div className="gc-fit-rows"><p>任务 <b>{fitWord(assessment.structureFit.task)}</b></p><p>输入 <b>{fitWord(assessment.structureFit.input)}</b></p><p>输出 <b>{fitWord(assessment.structureFit.output)}</b></p></div>
        </section>
        <section>
          <span>市场侧信号 · 不等于适配度</span>
          <div className="gc-signal-grid">
            {(["quality", "trust", "safety"] as const).map((key) => <p key={key}><small>{{ quality: "质量", trust: "可信", safety: "安全" }[key]}</small><strong>{release.registrySignals[key].value ?? "?"}</strong><em>{release.registrySignals[key].label}</em></p>)}
          </div>
        </section>
      </div>
      <dl className="gc-release-facts">
        <div><dt>固定方式</dt><dd>{release.pinKind === "manifest_snapshot" ? "清单快照" : "不可变发布"}</dd></div>
        <div><dt>Release / Snapshot</dt><dd>{release.version || compactDigest(release.manifestDigest)}</dd></div>
        <div><dt>作者</dt><dd>{release.author.name}{release.author.verified === true ? " · 已验证" : release.author.verified === false ? " · 未验证" : " · 验证未知"}</dd></div>
        <div><dt>来源</dt><dd>{release.source === "openagentskill" ? "OpenAgentSkill 目录" : release.source === "skillflow_creator" ? "Skillflow 创作者 Release" : "SkillFlow 原生目录"}{release.sourceUrl ? " · 有源地址" : " · 源地址未知"}</dd></div>
        <div><dt>许可</dt><dd>{release.license.name || release.license.id || "未知，需自行核对"}</dd></div>
        <div><dt>执行边界</dt><dd>{release.hostedExecution === "built_in" ? "内置能力" : release.hostedExecution === "allowlisted" ? "白名单能力" : "仅提供安装交接信息"}</dd></div>
        <div><dt>证据等级</dt><dd>{release.evidenceLevel}</dd></div>
      </dl>
      {(release.sourceUrl || release.author.url || release.license.url) ? (
        <div className="gc-source-links" aria-label="外部核验地址">
          {release.sourceUrl ? <a href={release.sourceUrl} target="_blank" rel="noreferrer">核验 Skill 来源 ↗</a> : null}
          {release.author.url ? <a href={release.author.url} target="_blank" rel="noreferrer">查看作者来源 ↗</a> : null}
          {release.license.url ? <a href={release.license.url} target="_blank" rel="noreferrer">核验许可原文 ↗</a> : null}
        </div>
      ) : null}
      <section className="gc-io"><div><span>输入</span><p>{listText(release.inputs)}</p></div><div><span>输出</span><p>{listText(release.outputs)}</p></div></section>
      {assessment.structureFit.reasons.length ? <section className="gc-fit-reasons"><span>为什么适配</span>{assessment.structureFit.reasons.map((reason) => <p key={reason}>— {reason}</p>)}</section> : null}
      {assessment.structureFit.evidencePaths.length ? (
        <details className="gc-evidence-paths"><summary>查看适配证据路径</summary>{assessment.structureFit.evidencePaths.map((path, index) => <p key={`${path.dimension}-${index}`}><strong>{{ task: "任务", input: "输入", output: "输出" }[path.dimension]}</strong>{path.querySource} → {path.releaseSource}{path.matchedTerms.length ? ` · 命中 ${path.matchedTerms.join("、")}` : ""}</p>)}</details>
      ) : null}
      {release.permissions.length ? <section className="gc-candidate-permissions"><span>所需权限</span>{release.permissions.map((permission, index) => <PermissionRow key={`${permission.capability}-${index}`} permission={permission} />)}</section> : <p className="gc-quiet">没有可验证的权限声明，不代表不需要权限。</p>}
      {(assessment.limitations.length || assessment.unknowns.length || release.limitations.length) ? (
        <section className="gc-limitations"><span>限制与未知</span>{[...assessment.limitations, ...assessment.unknowns, ...release.limitations].map((item, index) => <p key={`${item}-${index}`}>— {item}</p>)}</section>
      ) : null}
      {onBind ? <button className="gc-bind-button" type="button" onClick={(event) => onBind(candidate, event)}>{replacing ? "预览替换" : "预览添加到节点"}</button> : null}
    </article>
  );
}
