import type {
  AcceptanceAssertion,
  PermissionGrant,
  ScoreBreakdown,
  TaskContract,
  WorkflowEdge,
  WorkflowNodePlan,
  WorkflowPlan,
} from "./contracts";
import { validateWorkflowPlan } from "./contracts";

type DiagnoseInput = {
  goal: string;
  sources?: string[];
  audience?: string;
  frequency?: string;
  targetUser?: string;
};

const qualityAssertions: AcceptanceAssertion[] = [
  { id: "schema", label: "输出字段完整", kind: "schema", required: true },
  { id: "source", label: "关键结论保留来源", kind: "citation", required: true },
];

const noPermission: PermissionGrant[] = [];
const sampleScore: ScoreBreakdown = {
  taskFit: 23,
  inputOutputFit: 15,
  evaluatedSuccess: 0,
  safetyPermission: 14,
  platformConnector: 9,
  chineseDomain: 5,
  maintenance: 2,
  costLatency: 4,
};

function baseContract(input: DiagnoseInput, expectedOutput: string): TaskContract {
  return {
    goal: input.goal.trim(),
    targetUser: input.targetUser || "互联网产品 / 运营",
    trigger: input.frequency === "只做一次" ? "手动启动" : input.frequency || "每周",
    inputSources: input.sources?.length ? input.sources : ["用户提供的文档或表格"],
    expectedOutput,
    successCriteria: ["结果结构完整", "关键判断有来源", "外部动作前由用户确认"],
    frequency: input.frequency || "每周",
    audience: input.audience || "管理层",
    exclusions: ["不自动删除或覆盖原始内容", "不静默发送到外部渠道"],
    dataPolicy: "global_allowed",
  };
}

function edge(from: string, to: string, contract: string): WorkflowEdge {
  return { id: `${from}-${to}`, from, to, contract, failureRoute: "停止并保留已完成结果" };
}

function interviewPlan(input: DiagnoseInput): WorkflowPlan {
  const nodes: WorkflowNodePlan[] = [
    {
      id: "source",
      label: "导入访谈记录",
      purpose: "从用户明确选择的文件或飞书文档取得原始访谈材料。",
      kind: "connector_read",
      executionMode: "deterministic",
      aiFit: 12,
      autonomyRisk: "low",
      aiVerdict: "读取本身是确定性动作，不应该使用大模型。",
      humanResponsibility: "选择允许读取的文件或文档范围。",
      skillReleaseId: null,
      skillName: null,
      score: null,
      evidenceLevel: null,
      permissions: [{ capability: "document.read", resourceScope: "用户逐项选择", access: "read", approval: "once" }],
      inputs: ["DOCX", "PDF", "TXT", "飞书文档"],
      outputs: ["标准化访谈文本"],
      acceptance: [{ id: "source-loaded", label: "所有选择的资料均可读取", kind: "schema", required: true }],
      fallback: "允许粘贴文本或重新上传文件",
      locked: false,
    },
    {
      id: "evidence",
      label: "提取可追溯证据",
      purpose: "识别用户原话、问题、需求与上下文，并保留原始引用。",
      kind: "ai_cognitive",
      executionMode: "ai_with_exception",
      aiFit: 86,
      autonomyRisk: "medium",
      aiVerdict: "需要理解非结构化表达，适合 AI；引用缺失或低置信度证据转人工。",
      humanResponsibility: "检查关键引用是否断章取义。",
      skillReleaseId: "skillrel_evidence_extract_v1",
      skillName: "访谈证据提取",
      score: 72,
      scoreBreakdown: sampleScore,
      evidenceLevel: "E0",
      permissions: noPermission,
      inputs: ["标准化访谈文本"],
      outputs: ["带来源的证据条目"],
      acceptance: qualityAssertions,
      fallback: "标记无法判断的段落并转人工补充",
      locked: false,
    },
    {
      id: "cluster",
      label: "聚类痛点与机会",
      purpose: "把证据归并为可解释的主题，并区分频率与影响。",
      kind: "ai_cognitive",
      executionMode: "ai_draft_human_approve",
      aiFit: 78,
      autonomyRisk: "medium",
      aiVerdict: "AI 擅长提出聚类草案，但主题边界包含业务判断，需要产品经理确认。",
      humanResponsibility: "合并、拆分或锁定主题，确认机会是否成立。",
      skillReleaseId: "skillrel_insight_cluster_v1",
      skillName: "用户洞察聚类",
      score: 71,
      scoreBreakdown: { ...sampleScore, taskFit: 22 },
      evidenceLevel: "E0",
      permissions: noPermission,
      inputs: ["带来源的证据条目"],
      outputs: ["洞察主题", "机会假设"],
      acceptance: qualityAssertions,
      fallback: "保留证据列表，由用户手工归类",
      locked: false,
    },
    {
      id: "priority",
      label: "确认机会优先级",
      purpose: "结合战略、资源和证据确定哪些机会进入 PRD。",
      kind: "human_decision",
      executionMode: "human_only",
      aiFit: 44,
      autonomyRisk: "high",
      aiVerdict: "AI 可以整理依据，但无法完整获得组织战略与资源承诺，不应做最终决定。",
      humanResponsibility: "对优先级与取舍承担最终责任。",
      skillReleaseId: null,
      skillName: null,
      score: null,
      evidenceLevel: null,
      permissions: noPermission,
      inputs: ["洞察主题", "机会假设"],
      outputs: ["已确认机会清单"],
      acceptance: [{ id: "human-approved", label: "产品负责人已确认", kind: "human", required: true }],
      fallback: "暂停工作流，等待负责人确认",
      locked: true,
    },
    {
      id: "prd",
      label: "生成可评审 PRD",
      purpose: "根据确认的机会与证据生成结构化 PRD 初稿。",
      kind: "ai_cognitive",
      executionMode: "ai_draft_human_approve",
      aiFit: 91,
      autonomyRisk: "medium",
      aiVerdict: "内容生成高度适合 AI，但范围、指标与验收标准必须由产品经理批准。",
      humanResponsibility: "确认范围、指标、验收标准和不做事项。",
      skillReleaseId: "skillrel_prd_draft_v1",
      skillName: "证据驱动 PRD 生成器",
      score: 73,
      scoreBreakdown: { ...sampleScore, taskFit: 24 },
      evidenceLevel: "E0",
      permissions: noPermission,
      inputs: ["已确认机会清单", "带来源的证据条目"],
      outputs: ["结构化 PRD"],
      acceptance: [
        ...qualityAssertions,
        { id: "scope", label: "范围、非目标与验收标准完整", kind: "quality", required: true },
      ],
      fallback: "输出证据摘要和 PRD 空白骨架",
      locked: false,
    },
    {
      id: "publish",
      label: "新建飞书文档",
      purpose: "在用户确认最终预览后，新建一份飞书文档。",
      kind: "connector_write",
      executionMode: "ai_draft_human_approve",
      aiFit: 5,
      autonomyRisk: "high",
      aiVerdict: "写入是确定性外部动作，不需要 AI；必须在具体对象和内容可见时确认。",
      humanResponsibility: "确认目标位置与最终内容，主动触发新建。",
      skillReleaseId: null,
      skillName: null,
      score: null,
      evidenceLevel: null,
      permissions: [{ capability: "document.create", resourceScope: "用户选择的飞书位置", access: "create", approval: "every_action" }],
      inputs: ["结构化 PRD"],
      outputs: ["飞书文档链接", "写入回执"],
      acceptance: [{ id: "receipt", label: "飞书返回唯一文档回执", kind: "schema", required: true }],
      fallback: "保留平台内 Artifact，并提供 DOCX/Markdown 下载",
      locked: true,
    },
  ];

  const plan: WorkflowPlan = {
    id: `plan_${crypto.randomUUID()}`,
    templateId: "interview-to-prd-v1",
    title: "访谈证据到可评审 PRD",
    summary: "AI 负责提取、聚类和起草；产品经理负责机会优先级、范围与最终发布。",
    state: "plan_ready",
    recommendation: "workflow",
    taskContract: baseContract(input, "可评审 PRD"),
    nodes,
    edges: [
      edge("source", "evidence", "标准化访谈文本"),
      edge("evidence", "cluster", "带来源的证据条目"),
      edge("cluster", "priority", "洞察主题与机会假设"),
      edge("priority", "prd", "已确认机会清单"),
      edge("prd", "publish", "结构化 PRD"),
    ],
    unresolvedQuestions: [],
    version: 1,
    generatedAt: new Date().toISOString(),
  };

  const validation = validateWorkflowPlan(plan);
  if (!validation.valid) throw new Error(validation.errors.join("；"));
  return plan;
}

function weeklyReportPlan(input: DiagnoseInput): WorkflowPlan {
  const skillNode: WorkflowNodePlan = {
    id: "weekly-report",
    label: "生成管理层周报",
    purpose: "从指定文档和表格提取进展、数字与风险，生成可编辑周报。",
    kind: "ai_cognitive",
    executionMode: "ai_draft_human_approve",
    aiFit: 89,
    autonomyRisk: "medium",
    aiVerdict: "任务重复、输入稳定、结果可检查，一个 Skill 即可完成，无需强行组合工作流。",
    humanResponsibility: "确认风险判断并决定是否发送。",
    skillReleaseId: "skillrel_weekly_report_v1",
    skillName: "管理层周报生成器",
    score: 72,
    scoreBreakdown: sampleScore,
    evidenceLevel: "E0",
    permissions: [{ capability: "document.read", resourceScope: "用户选择的文件", access: "read", approval: "once" }],
    inputs: ["飞书文档", "XLSX", "CSV"],
    outputs: ["管理层周报 Artifact"],
    acceptance: qualityAssertions,
    fallback: "生成结构化周报骨架并标出缺少的数据",
    locked: false,
  };
  return {
    id: `plan_${crypto.randomUUID()}`,
    templateId: "weekly-report-single-v1",
    title: "一个 Skill 就能完成这项工作",
    summary: "先试运行管理层周报生成器；需要自动收集和发送时，再扩展为完整工作流。",
    state: "plan_ready",
    recommendation: "single_skill",
    taskContract: baseContract(input, "管理层周报"),
    nodes: [skillNode],
    edges: [],
    unresolvedQuestions: [],
    version: 1,
    generatedAt: new Date().toISOString(),
  };
}

export function compileWorkflow(input: DiagnoseInput): WorkflowPlan {
  const goal = input.goal.trim();
  if (!goal) throw new Error("请先描述你希望完成的工作");
  if (/访谈|用户反馈|用户研究|PRD|需求洞察/i.test(goal)) return interviewPlan(input);
  return weeklyReportPlan(input);
}
