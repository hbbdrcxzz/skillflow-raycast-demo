export const nodeKinds = [
  "trigger",
  "connector_read",
  "deterministic",
  "ai_cognitive",
  "validation",
  "human_decision",
  "connector_write",
] as const;

export type NodeKind = (typeof nodeKinds)[number];

export const executionModes = [
  "deterministic",
  "ai_auto",
  "ai_with_exception",
  "ai_draft_human_approve",
  "human_only",
] as const;

export type ExecutionMode = (typeof executionModes)[number];
export type RiskLevel = "low" | "medium" | "high";
export type EvidenceLevel = "E0" | "E1" | "E2" | "E3" | "E4";
export type WorkflowState =
  | "draft"
  | "clarifying"
  | "generating_plan"
  | "plan_ready"
  | "needs_configuration"
  | "needs_permission"
  | "ready"
  | "running"
  | "paused"
  | "partially_succeeded"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "outcome_unknown"
  | "outdated";

export type PermissionGrant = {
  capability: string;
  resourceScope: string;
  access: "read" | "create" | "write" | "destructive";
  approval: "none" | "once" | "every_run" | "every_action";
};

export type AcceptanceAssertion = {
  id: string;
  label: string;
  kind: "schema" | "citation" | "quality" | "human";
  required: boolean;
};

export type ScoreBreakdown = {
  taskFit: number;
  inputOutputFit: number;
  evaluatedSuccess: number;
  safetyPermission: number;
  platformConnector: number;
  chineseDomain: number;
  maintenance: number;
  costLatency: number;
};

export type WorkflowNodePlan = {
  id: string;
  label: string;
  purpose: string;
  kind: NodeKind;
  executionMode: ExecutionMode;
  aiFit: number;
  autonomyRisk: RiskLevel;
  aiVerdict: string;
  humanResponsibility: string;
  skillReleaseId: string | null;
  skillName: string | null;
  score: number | null;
  scoreBreakdown?: ScoreBreakdown;
  evidenceLevel: EvidenceLevel | null;
  permissions: PermissionGrant[];
  inputs: string[];
  outputs: string[];
  acceptance: AcceptanceAssertion[];
  fallback: string;
  locked: boolean;
};

export type WorkflowEdge = {
  id: string;
  from: string;
  to: string;
  contract: string;
  failureRoute: string;
};

export type TaskContract = {
  goal: string;
  targetUser: string;
  trigger: string;
  inputSources: string[];
  expectedOutput: string;
  successCriteria: string[];
  frequency: string;
  audience: string;
  exclusions: string[];
  dataPolicy: "global_allowed";
};

export type WorkflowPlan = {
  id: string;
  templateId: string;
  title: string;
  summary: string;
  state: WorkflowState;
  recommendation: "single_skill" | "workflow";
  taskContract: TaskContract;
  nodes: WorkflowNodePlan[];
  edges: WorkflowEdge[];
  unresolvedQuestions: string[];
  version: number;
  generatedAt: string;
};

export type WorkflowValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export function validateWorkflowPlan(plan: WorkflowPlan): WorkflowValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const ids = new Set(plan.nodes.map((node) => node.id));

  if (!plan.nodes.length) errors.push("工作流至少需要一个节点");
  if (!plan.taskContract.goal.trim()) errors.push("任务目标不能为空");
  if (ids.size !== plan.nodes.length) errors.push("节点 ID 必须唯一");

  for (const edge of plan.edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) {
      errors.push(`连线 ${edge.id} 引用了不存在的节点`);
    }
    if (!edge.contract.trim()) errors.push(`连线 ${edge.id} 缺少数据合同`);
  }

  for (const node of plan.nodes) {
    if (!node.inputs.length && node.kind !== "trigger") {
      warnings.push(`${node.label} 尚未声明输入`);
    }
    if (!node.outputs.length && node.kind !== "human_decision") {
      warnings.push(`${node.label} 尚未声明输出`);
    }
    if (node.kind === "ai_cognitive" && !node.skillReleaseId) {
      errors.push(`${node.label} 是 AI 节点，但未绑定已注册 SkillRelease`);
    }
    const highRiskAction = node.permissions.some(
      (permission) => permission.access === "destructive" || permission.approval === "every_action",
    );
    if (highRiskAction && node.executionMode === "ai_auto") {
      errors.push(`${node.label} 包含高风险权限，不能完全自动执行`);
    }
    if (!node.acceptance.length) warnings.push(`${node.label} 尚未定义验收标准`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

