import type {
  EvaluationFixture,
  JsonSchema,
  RuntimeSkillDefinition,
  WorkflowStage,
} from "./types";

export type NormalizedSegment = {
  segment_id: string;
  source_id: string;
  speaker_id: string | null;
  text: string;
  locator: string;
  quality_flags: string[];
};

export type NormalizeInterviewInput = {
  project_id: string;
  research_goal: string;
  source_id: string;
  raw_text: string;
  participant_label: string | null;
};

export type NormalizeInterviewOutput = {
  project_id: string;
  normalized_segments: NormalizedSegment[];
  coverage: {
    source_count: number;
    processed_count: number;
    warnings: string[];
  };
};

export type EvidenceCategory =
  | "need"
  | "behavior"
  | "pain_point"
  | "motivation"
  | "workaround"
  | "expectation"
  | "objection"
  | "counterexample";

export type EvidenceItem = {
  evidence_id: string;
  segment_id: string;
  source_id: string;
  category: EvidenceCategory;
  quote: string;
  interpretation: string;
  confidence: number;
  needs_review: boolean;
  review_reason: string | null;
};

export type EvidenceExtractionInput = {
  research_goal: string;
  research_questions: string[];
  normalized_segments: NormalizedSegment[];
};

export type EvidenceExtractionOutput = {
  evidence_items: EvidenceItem[];
  review_queue: {
    evidence_id: string;
    reason: string;
  }[];
  coverage_note: string;
};

export type InsightTheme = {
  theme_id: string;
  title: string;
  statement: string;
  supporting_evidence_ids: string[];
  counter_evidence_ids: string[];
  independent_source_count: number;
  strength: "single_case" | "emerging" | "repeated" | "contested";
  product_implication: string;
  uncertainty: string;
};

export type InsightClusteringInput = {
  research_goal: string;
  evidence_items: EvidenceItem[];
  max_theme_count: number;
};

export type InsightClusteringOutput = {
  themes: InsightTheme[];
  unclustered_evidence_ids: string[];
  limitations: string[];
};

export type AiUseDecision =
  | "do_not_use_ai"
  | "assistive_ai"
  | "ai_first";

export type WorkflowAiAssessment = {
  node_id: string;
  work_step: string;
  current_method: string;
  ai_decision: AiUseDecision;
  decision_reason: string;
  ai_role: string;
  human_role: string;
  recommended_skill_slugs: string[];
  skill_combination_logic: string;
  risk_level: "low" | "medium" | "high";
  evidence_ids: string[];
  success_check: string;
};

export type WorkflowAiAssessmentInput = {
  research_goal: string;
  themes: InsightTheme[];
  evidence_items: EvidenceItem[];
  allowed_skill_slugs: string[];
};

export type WorkflowAiAssessmentOutput = {
  workflow_nodes: WorkflowAiAssessment[];
  system_summary: string;
  manual_only_work: string[];
};

export type ThemeDecision = {
  theme_id: string;
  decision: "approved" | "rejected" | "needs_revision";
  edited_title: string | null;
  edited_statement: string | null;
  human_note: string | null;
};

export type ThemeApprovalInput = {
  themes: InsightTheme[];
  decisions: ThemeDecision[];
  approved_by: string;
};

export type ApprovedTheme = InsightTheme & {
  approved_title: string;
  approved_statement: string;
  approval_note: string | null;
};

export type ThemeApprovalOutput = {
  approved_themes: ApprovedTheme[];
  rejected_theme_ids: string[];
  revision_required_theme_ids: string[];
  approved_by: string;
  can_generate_prd: boolean;
};

export type PrdRequirement = {
  requirement_id: string;
  statement: string;
  rationale: string;
  priority: "must" | "should" | "could";
  acceptance_criteria: string[];
  evidence_ids: string[];
};

export type PrdDraft = {
  title: string;
  background: string;
  problem_statement: string;
  goal: string;
  non_goals: string[];
  target_users: string[];
  user_scenarios: string[];
  requirements: PrdRequirement[];
  success_metrics: {
    metric: string;
    definition: string;
    target: string | null;
    timeframe: string | null;
  }[];
  risks: {
    risk: string;
    mitigation: string;
  }[];
  rollout_plan: string[];
};

export type PrdGenerationInput = {
  product_name: string;
  research_goal: string;
  approved_themes: ApprovedTheme[];
  evidence_items: EvidenceItem[];
  constraints: string[];
  known_metrics: string[];
  requested_detail: "brief" | "review_ready";
};

export type PrdGenerationOutput = {
  prd: PrdDraft;
  traceability: {
    requirement_id: string;
    theme_ids: string[];
    evidence_ids: string[];
  }[];
  open_questions: string[];
  assumptions_to_validate: string[];
};

export type QualityIssue = {
  issue_id: string;
  severity: "blocker" | "important" | "suggestion";
  location: string;
  rule: string;
  reason: string;
  suggested_fix: string;
};

export type PrdQualityOutput = {
  decision: "pass_with_notes" | "needs_revision" | "blocked";
  score: number;
  issues: QualityIssue[];
  checks: {
    check: string;
    status: "pass" | "fail";
  }[];
};

const objectSchema = (
  required: string[],
  properties: Record<string, unknown>,
): JsonSchema => ({
  type: "object",
  additionalProperties: false,
  required,
  properties,
});

const stringArraySchema = (): JsonSchema => ({
  type: "array",
  items: { type: "string" },
});

export const normalizedSegmentSchema = objectSchema(
  [
    "segment_id",
    "source_id",
    "speaker_id",
    "text",
    "locator",
    "quality_flags",
  ],
  {
    segment_id: { type: "string" },
    source_id: { type: "string" },
    speaker_id: { type: ["string", "null"] },
    text: { type: "string", minLength: 1 },
    locator: { type: "string" },
    quality_flags: stringArraySchema(),
  },
);

export const evidenceItemSchema = objectSchema(
  [
    "evidence_id",
    "segment_id",
    "source_id",
    "category",
    "quote",
    "interpretation",
    "confidence",
    "needs_review",
    "review_reason",
  ],
  {
    evidence_id: { type: "string", pattern: "^ev-[0-9]{3}$" },
    segment_id: { type: "string" },
    source_id: { type: "string" },
    category: {
      type: "string",
      enum: [
        "need",
        "behavior",
        "pain_point",
        "motivation",
        "workaround",
        "expectation",
        "objection",
        "counterexample",
      ],
    },
    quote: { type: "string", minLength: 1 },
    interpretation: { type: "string", minLength: 1 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    needs_review: { type: "boolean" },
    review_reason: { type: ["string", "null"] },
  },
);

export const insightThemeSchema = objectSchema(
  [
    "theme_id",
    "title",
    "statement",
    "supporting_evidence_ids",
    "counter_evidence_ids",
    "independent_source_count",
    "strength",
    "product_implication",
    "uncertainty",
  ],
  {
    theme_id: { type: "string", pattern: "^theme-[0-9]{2}$" },
    title: { type: "string" },
    statement: { type: "string" },
    supporting_evidence_ids: stringArraySchema(),
    counter_evidence_ids: stringArraySchema(),
    independent_source_count: { type: "integer", minimum: 1 },
    strength: {
      type: "string",
      enum: ["single_case", "emerging", "repeated", "contested"],
    },
    product_implication: { type: "string" },
    uncertainty: { type: "string" },
  },
);

export const workflowAiAssessmentSchema = objectSchema(
  [
    "node_id",
    "work_step",
    "current_method",
    "ai_decision",
    "decision_reason",
    "ai_role",
    "human_role",
    "recommended_skill_slugs",
    "skill_combination_logic",
    "risk_level",
    "evidence_ids",
    "success_check",
  ],
  {
    node_id: { type: "string", pattern: "^work-[0-9]{2}$" },
    work_step: { type: "string" },
    current_method: { type: "string" },
    ai_decision: {
      type: "string",
      enum: ["do_not_use_ai", "assistive_ai", "ai_first"],
    },
    decision_reason: { type: "string" },
    ai_role: { type: "string" },
    human_role: { type: "string" },
    recommended_skill_slugs: stringArraySchema(),
    skill_combination_logic: { type: "string" },
    risk_level: { type: "string", enum: ["low", "medium", "high"] },
    evidence_ids: stringArraySchema(),
    success_check: { type: "string" },
  },
);

const approvedThemeSchema = objectSchema(
  [
    "theme_id",
    "title",
    "statement",
    "supporting_evidence_ids",
    "counter_evidence_ids",
    "independent_source_count",
    "strength",
    "product_implication",
    "uncertainty",
    "approved_title",
    "approved_statement",
    "approval_note",
  ],
  {
    ...(insightThemeSchema.properties as Record<string, unknown>),
    approved_title: { type: "string" },
    approved_statement: { type: "string" },
    approval_note: { type: ["string", "null"] },
  },
);

const approvalOutputSchema = objectSchema(
  [
    "approved_themes",
    "rejected_theme_ids",
    "revision_required_theme_ids",
    "approved_by",
    "can_generate_prd",
  ],
  {
    approved_themes: {
      type: "array",
      items: approvedThemeSchema,
    },
    rejected_theme_ids: stringArraySchema(),
    revision_required_theme_ids: stringArraySchema(),
    approved_by: { type: "string" },
    can_generate_prd: { type: "boolean" },
  },
);

const prdOutputSchema = objectSchema(
  ["prd", "traceability", "open_questions", "assumptions_to_validate"],
  {
    prd: objectSchema(
      [
        "title",
        "background",
        "problem_statement",
        "goal",
        "non_goals",
        "target_users",
        "user_scenarios",
        "requirements",
        "success_metrics",
        "risks",
        "rollout_plan",
      ],
      {
        title: { type: "string" },
        background: { type: "string" },
        problem_statement: { type: "string" },
        goal: { type: "string" },
        non_goals: stringArraySchema(),
        target_users: stringArraySchema(),
        user_scenarios: stringArraySchema(),
        requirements: {
          type: "array",
          minItems: 1,
          items: objectSchema(
            [
              "requirement_id",
              "statement",
              "rationale",
              "priority",
              "acceptance_criteria",
              "evidence_ids",
            ],
            {
              requirement_id: {
                type: "string",
                pattern: "^REQ-[0-9]{3}$",
              },
              statement: { type: "string" },
              rationale: { type: "string" },
              priority: {
                type: "string",
                enum: ["must", "should", "could"],
              },
              acceptance_criteria: stringArraySchema(),
              evidence_ids: stringArraySchema(),
            },
          ),
        },
        success_metrics: {
          type: "array",
          items: objectSchema(
            ["metric", "definition", "target", "timeframe"],
            {
              metric: { type: "string" },
              definition: { type: "string" },
              target: { type: ["string", "null"] },
              timeframe: { type: ["string", "null"] },
            },
          ),
        },
        risks: {
          type: "array",
          items: objectSchema(["risk", "mitigation"], {
            risk: { type: "string" },
            mitigation: { type: "string" },
          }),
        },
        rollout_plan: stringArraySchema(),
      },
    ),
    traceability: {
      type: "array",
      items: objectSchema(
        ["requirement_id", "theme_ids", "evidence_ids"],
        {
          requirement_id: { type: "string" },
          theme_ids: stringArraySchema(),
          evidence_ids: stringArraySchema(),
        },
      ),
    },
    open_questions: stringArraySchema(),
    assumptions_to_validate: stringArraySchema(),
  },
);

export const interviewProductManagerSkills = {
  normalize: {
    id: "runtime_interview_material_normalizer",
    slug: "interview-material-normalizer",
    version: "1.0.0",
    nameZh: "访谈材料标准化",
    descriptionZh: "把粘贴或上传后解析的访谈文本切成可追溯片段。",
    control: "deterministic",
    systemInstruction: null,
    inputSchema: objectSchema(
      [
        "project_id",
        "research_goal",
        "source_id",
        "raw_text",
        "participant_label",
      ],
      {
        project_id: { type: "string" },
        research_goal: { type: "string", minLength: 1 },
        source_id: { type: "string" },
        raw_text: { type: "string", minLength: 50 },
        participant_label: { type: ["string", "null"] },
      },
    ),
    outputSchema: objectSchema(
      ["project_id", "normalized_segments", "coverage"],
      {
        project_id: { type: "string" },
        normalized_segments: {
          type: "array",
          items: normalizedSegmentSchema,
        },
        coverage: objectSchema(
          ["source_count", "processed_count", "warnings"],
          {
            source_count: { type: "integer" },
            processed_count: { type: "integer" },
            warnings: stringArraySchema(),
          },
        ),
      },
    ),
    limitationsZh: [
      "MVP 只把纯文本、TXT 和 Markdown 当作已解析文本，不在此步骤执行 OCR 或音视频转写。",
      "说话人只根据明确的“角色：内容”前缀识别，不根据语气猜测身份。",
      "不会修正原文事实、补全残句或合并语义冲突的段落。",
    ],
    qualityRulesZh: [
      "原文非空字符必须被片段覆盖，空白折叠除外。",
      "每个片段必须有稳定 segment_id、source_id 和行号定位。",
      "单段过长时只在句末或换行处切分，不改写内容。",
    ],
  } satisfies RuntimeSkillDefinition<
    NormalizeInterviewInput,
    NormalizeInterviewOutput
  >,

  extractEvidence: {
    id: "runtime_interview_evidence_extractor",
    slug: "interview-evidence-extractor",
    version: "1.0.0",
    nameZh: "访谈证据抽取",
    descriptionZh: "从原文中抽取可逐字回溯的需求、行为、痛点、动机、绕行方案与反例。",
    control: "model",
    systemInstruction: `你是严谨的用户研究证据分析员。你的唯一任务是从给定的标准化访谈片段中抽取证据，不做产品方案设计。

必须遵守：
1. quote 必须逐字复制自一个 segment 的 text，禁止改写、跨片段拼接或补充上下文；segment_id 与 source_id 必须和该片段一致。
2. interpretation 只能解释该原话对 research_goal 的含义。不得把用户态度写成客观事实，不得把单人意见写成普遍规律。
3. 同时寻找支持、反对、无需求和已有替代方案的材料。不要为了数量重复抽取同一意思。
4. evidence_id 按出现顺序写为 ev-001、ev-002……。
5. confidence 表示“该引用是否支持该解释”，不是用户观点正确的概率。原话含糊、身份不明、上下文不足时 confidence 不得高于 0.69，并设置 needs_review=true。
6. 不推断健康、收入、政治、民族等敏感属性；相关暗示只可进入 review_queue。
7. 仅输出符合 JSON Schema 的 JSON，不输出 Markdown、解释或额外字段。`,
    inputSchema: objectSchema(
      ["research_goal", "research_questions", "normalized_segments"],
      {
        research_goal: { type: "string", minLength: 1 },
        research_questions: stringArraySchema(),
        normalized_segments: {
          type: "array",
          minItems: 1,
          items: normalizedSegmentSchema,
        },
      },
    ),
    outputSchema: objectSchema(
      ["evidence_items", "review_queue", "coverage_note"],
      {
        evidence_items: { type: "array", items: evidenceItemSchema },
        review_queue: {
          type: "array",
          items: objectSchema(["evidence_id", "reason"], {
            evidence_id: { type: "string" },
            reason: { type: "string" },
          }),
        },
        coverage_note: { type: "string" },
      },
    ),
    limitationsZh: [
      "只能判断输入材料里出现了什么，不能证明用户群体总体比例。",
      "不能代替研究员判断访谈提问偏差、招募偏差和样本充分性。",
      "对含蓄表达和跨多轮语境的理解可能不稳定，必须保留复核队列。",
    ],
    qualityRulesZh: [
      "每个 quote 必须是对应 segment.text 的精确子串。",
      "所有 segment_id、source_id 必须存在并相互匹配。",
      "confidence < 0.7 的证据必须 needs_review=true。",
      "review_queue 只引用实际存在的 evidence_id。",
    ],
  } satisfies RuntimeSkillDefinition<
    EvidenceExtractionInput,
    EvidenceExtractionOutput
  >,

  clusterInsights: {
    id: "runtime_user_insight_clusterer",
    slug: "user-insight-clusterer",
    version: "1.0.0",
    nameZh: "用户洞察主题聚类",
    descriptionZh: "按问题机制而非表面措辞聚类证据，并显式保留反例和不确定性。",
    control: "model",
    systemInstruction: `你是产品研究负责人。请把证据卡聚类成少量、互不重复、可解释的洞察主题。你只能使用输入中的 evidence_id，不得创造新证据。

必须遵守：
1. 先按用户要完成的工作、触发情境、阻碍机制和当前替代方案判断是否同一主题；不能只因词语相似就合并。
2. supporting_evidence_ids 只放直接支持主题陈述的证据；counter_evidence_ids 放反例、无需求或冲突证据。
3. independent_source_count 按不同 source_id 去重计数，不能按引用条数计数。
4. 只有一个独立来源时 strength=single_case；多来源但证据弱可用 emerging；多来源一致且无实质反例可用 repeated；存在实质冲突必须用 contested。
5. statement 描述用户问题或行为模式，不直接宣布某个功能方案。product_implication 只能写成待验证方向，不能写成已批准需求。
6. 无法可靠归类的证据放入 unclustered_evidence_ids，不强行归类。
7. theme_id 按重要性写为 theme-01、theme-02……，主题数量不得超过 max_theme_count。
8. 仅输出符合 JSON Schema 的 JSON，不输出 Markdown、解释或额外字段。`,
    inputSchema: objectSchema(
      ["research_goal", "evidence_items", "max_theme_count"],
      {
        research_goal: { type: "string" },
        evidence_items: {
          type: "array",
          minItems: 1,
          items: evidenceItemSchema,
        },
        max_theme_count: { type: "integer", minimum: 1, maximum: 12 },
      },
    ),
    outputSchema: objectSchema(
      ["themes", "unclustered_evidence_ids", "limitations"],
      {
        themes: { type: "array", items: insightThemeSchema },
        unclustered_evidence_ids: stringArraySchema(),
        limitations: stringArraySchema(),
      },
    ),
    limitationsZh: [
      "语义聚类存在模型不稳定性，同一数据可能得到不同的合理粒度。",
      "独立来源数不是统计显著性，也不能代表市场发生率。",
      "主题命名和产品含义必须由人确认后才能进入 PRD。",
    ],
    qualityRulesZh: [
      "所有证据 ID 必须来自输入且同一证据不能同时支持两个完全相同主题。",
      "independent_source_count 必须等于支持证据对应 source_id 的去重数。",
      "包含反例的主题不得标记为 repeated。",
      "主题数不得超过 max_theme_count，未归类证据仍需保留。",
    ],
  } satisfies RuntimeSkillDefinition<
    InsightClusteringInput,
    InsightClusteringOutput
  >,

  assessWorkflowAi: {
    id: "runtime_workflow_ai_fit_assessor",
    slug: "workflow-ai-fit-assessor",
    version: "1.0.0",
    nameZh: "工作流 AI 适用性判断",
    descriptionZh: "逐节点判断是否应使用 AI、如何组合 Skill，以及必须由人承担的责任。",
    control: "model",
    systemInstruction: `你是负责 AI 工作流设计的资深产品经理。请根据已抽取证据和洞察，把用户当前工作拆成少量有先后关系的节点，并对每个节点判断 AI 是否适用。你的目标不是让 AI 覆盖更多节点，而是让结果更可靠、可控、可验收。

必须遵守：
1. 每个节点必须有输入证据；evidence_ids 只能引用输入中的 evidence_id。没有证据支持的工作环节不要发明。
2. ai_decision 只能是：do_not_use_ai（保持人工）、assistive_ai（AI 起草或整理，人决定）、ai_first（AI 默认执行，异常或关键结果由人复核）。
3. 出现高后果判断、价值取舍、样本不足、目标含糊、不可逆动作、对外承诺或证据冲突时，不得选择 ai_first。发送、发布、删除、付款、承诺排期和确定优先级必须由人确认。
4. 推荐 Skill 只能从 allowed_skill_slugs 中选择；没有匹配项时返回空数组，并在 skill_combination_logic 说明能力缺口。不得创造 Skill 名称。
5. recommended_skill_slugs 有多个时，skill_combination_logic 必须按顺序说明前一个 Skill 的输出如何成为后一个 Skill 的输入；只有一个时说明它在哪个节点工作。
6. ai_role 写清 AI 具体做什么；human_role 写清人必须检查、修改或批准什么。do_not_use_ai 时 ai_role 写“无”，recommended_skill_slugs 返回空数组。
7. success_check 必须是可观察的验收方式，不能使用“效果更好”“更加智能”等空话。
8. node_id 按实际工作顺序写为 work-01、work-02……；不要把同一工作拆得过细，也不要跨越关键人工决策门。
9. manual_only_work 汇总不应自动化的责任；system_summary 说明整条工作流中 AI 的边界和推荐组合。
10. 仅输出符合 JSON Schema 的 JSON，不输出 Markdown、解释或额外字段。`,
    inputSchema: objectSchema(
      ["research_goal", "themes", "evidence_items", "allowed_skill_slugs"],
      {
        research_goal: { type: "string", minLength: 1 },
        themes: { type: "array", minItems: 1, items: insightThemeSchema },
        evidence_items: {
          type: "array",
          minItems: 1,
          items: evidenceItemSchema,
        },
        allowed_skill_slugs: stringArraySchema(),
      },
    ),
    outputSchema: objectSchema(
      ["workflow_nodes", "system_summary", "manual_only_work"],
      {
        workflow_nodes: {
          type: "array",
          minItems: 1,
          maxItems: 12,
          items: workflowAiAssessmentSchema,
        },
        system_summary: { type: "string" },
        manual_only_work: stringArraySchema(),
      },
    ),
    limitationsZh: [
      "判断基于访谈中描述的当前工作，不等于已经观察到真实操作过程。",
      "风险等级是产品工作流分流，不替代组织的安全、合规或权限评审。",
      "只会推荐平台注册且传入 allowed_skill_slugs 的 Skill；能力缺口会显式保留。",
    ],
    qualityRulesZh: [
      "每个节点必须引用有效 evidence_id，且推荐 Skill 必须来自 allowed_skill_slugs。",
      "do_not_use_ai 节点不得绑定 Skill；高风险节点不得标记 ai_first。",
      "多个 Skill 必须说明输入输出顺序，人工责任和验收方式均不能为空。",
      "节点 ID 唯一并按工作顺序递增。",
    ],
  } satisfies RuntimeSkillDefinition<
    WorkflowAiAssessmentInput,
    WorkflowAiAssessmentOutput
  >,

  approveThemes: {
    id: "runtime_theme_approval_gate",
    slug: "theme-approval-gate",
    version: "1.0.0",
    nameZh: "洞察人工确认",
    descriptionZh: "由产品负责人逐项批准、拒绝或修改主题，未经批准不得生成 PRD。",
    control: "human_gate",
    systemInstruction: null,
    inputSchema: objectSchema(["themes", "decisions", "approved_by"], {
      themes: { type: "array", items: insightThemeSchema },
      decisions: {
        type: "array",
        items: objectSchema(
          [
            "theme_id",
            "decision",
            "edited_title",
            "edited_statement",
            "human_note",
          ],
          {
            theme_id: { type: "string" },
            decision: {
              type: "string",
              enum: ["approved", "rejected", "needs_revision"],
            },
            edited_title: { type: ["string", "null"] },
            edited_statement: { type: ["string", "null"] },
            human_note: { type: ["string", "null"] },
          },
        ),
      },
      approved_by: { type: "string" },
    }),
    outputSchema: approvalOutputSchema,
    limitationsZh: [
      "批准动作代表当前负责人接受该研究解释，不代表统计或业务结论已经被证明。",
      "MVP 不提供多人会签；approved_by 是运行回执字段，不是组织级电子签名。",
    ],
    qualityRulesZh: [
      "每个输入主题必须恰好有一个决定。",
      "needs_revision 的主题不能进入 approved_themes。",
      "至少一个主题 approved 后 can_generate_prd 才能为 true。",
    ],
  } satisfies RuntimeSkillDefinition<ThemeApprovalInput, ThemeApprovalOutput>,

  generatePrd: {
    id: "runtime_evidence_driven_prd_generator",
    slug: "prd-draft-generator",
    version: "1.0.0",
    nameZh: "证据驱动 PRD 草稿",
    descriptionZh: "只基于已批准主题、证据和显式约束生成可评审 PRD。",
    control: "model",
    systemInstruction: `你是资深互联网产品经理。请把已由人批准的研究主题转成一份可评审、可追溯的 PRD 草稿。

必须遵守：
1. 只能依据 approved_themes、evidence_items、constraints 和 known_metrics。不要发明用户数量、转化基线、排期、研发成本、技术架构、法规结论或负责人承诺。
2. 每项 requirement 必须是可实现、边界明确的产品行为，按 REQ-001、REQ-002……编号；至少包含一条可观察、可验证的 acceptance_criteria。
3. requirement.evidence_ids 和 traceability 只能引用输入证据；每项 requirement 至少引用一个证据，并关联至少一个已批准 theme_id。
4. 证据不足但值得探索的内容必须放到 open_questions 或 assumptions_to_validate，不得包装成确定需求。
5. success_metrics 必须说明计算定义。输入没有目标值或时间范围时，target/timeframe 写 null，并在 open_questions 说明需要谁确认，不能编造数字。
6. 明确写出 non_goals，控制 MVP 范围；rollout_plan 只描述验证顺序，不承诺日期。
7. 优先把用户问题写清楚，再写功能。不要堆砌 AI、智能化等空洞词语。
8. 仅输出符合 JSON Schema 的 JSON，不输出 Markdown、解释或额外字段。`,
    inputSchema: objectSchema(
      [
        "product_name",
        "research_goal",
        "approved_themes",
        "evidence_items",
        "constraints",
        "known_metrics",
        "requested_detail",
      ],
      {
        product_name: { type: "string" },
        research_goal: { type: "string" },
        approved_themes: {
          type: "array",
          minItems: 1,
          items: approvedThemeSchema,
        },
        evidence_items: { type: "array", items: evidenceItemSchema },
        constraints: stringArraySchema(),
        known_metrics: stringArraySchema(),
        requested_detail: {
          type: "string",
          enum: ["brief", "review_ready"],
        },
      },
    ),
    outputSchema: prdOutputSchema,
    limitationsZh: [
      "输出是可评审草稿，不替代产品、设计、研发、数据和合规负责人确认。",
      "不能从定性访谈推导市场规模、收益预测或精确优先级。",
      "不会直接创建 Jira、飞书文档或对外发布。",
    ],
    qualityRulesZh: [
      "每个核心需求至少有一条验收标准和一条有效证据引用。",
      "需求、traceability、主题和证据之间必须可双向追溯。",
      "未知指标目标、排期和技术方案必须保留为空或进入开放问题。",
      "必须包含目标、非目标、风险、开放问题和验证顺序。",
    ],
  } satisfies RuntimeSkillDefinition<PrdGenerationInput, PrdGenerationOutput>,

  qualityReview: {
    id: "runtime_prd_quality_checker",
    slug: "prd-quality-checker",
    version: "1.0.0",
    nameZh: "PRD 确定性质量检查",
    descriptionZh: "用程序规则检查 PRD 完整性、证据追溯、验收性和未确认数字。",
    control: "deterministic",
    systemInstruction: null,
    inputSchema: objectSchema(
      ["prd_result", "approved_theme_ids", "valid_evidence_ids"],
      {
        prd_result: prdOutputSchema,
        approved_theme_ids: stringArraySchema(),
        valid_evidence_ids: stringArraySchema(),
      },
    ),
    outputSchema: objectSchema(["decision", "score", "issues", "checks"], {
      decision: {
        type: "string",
        enum: ["pass_with_notes", "needs_revision", "blocked"],
      },
      score: { type: "number", minimum: 0, maximum: 100 },
      issues: {
        type: "array",
        items: objectSchema(
          [
            "issue_id",
            "severity",
            "location",
            "rule",
            "reason",
            "suggested_fix",
          ],
          {
            issue_id: { type: "string" },
            severity: {
              type: "string",
              enum: ["blocker", "important", "suggestion"],
            },
            location: { type: "string" },
            rule: { type: "string" },
            reason: { type: "string" },
            suggested_fix: { type: "string" },
          },
        ),
      },
      checks: {
        type: "array",
        items: objectSchema(["check", "status"], {
          check: { type: "string" },
          status: { type: "string", enum: ["pass", "fail"] },
        }),
      },
    }),
    limitationsZh: [
      "确定性检查只能验证结构和引用一致性，不能证明方案对用户有效。",
      "语言清晰度、交互合理性和技术可行性仍需专业人员评审。",
    ],
    qualityRulesZh: [
      "阻断：无需求、需求 ID 重复、引用不存在或 traceability 缺失。",
      "重要：需求无验收标准、关键章节为空、指标无定义。",
      "建议：未知指标目标没有对应开放问题。",
    ],
  } satisfies RuntimeSkillDefinition,
} as const;

export const internetProductInterviewWorkflow: WorkflowStage[] = [
  {
    id: "normalize",
    skillSlug: interviewProductManagerSkills.normalize.slug,
    control: "deterministic",
    dependsOn: [],
    blocksDownstream: true,
    descriptionZh: "清理并按行号建立可追溯材料；不调用模型。",
  },
  {
    id: "extract_evidence",
    skillSlug: interviewProductManagerSkills.extractEvidence.slug,
    control: "model",
    dependsOn: ["normalize"],
    blocksDownstream: true,
    descriptionZh: "调用模型抽取原话证据；程序必须随后验证引用。",
  },
  {
    id: "cluster_insights",
    skillSlug: interviewProductManagerSkills.clusterInsights.slug,
    control: "model",
    dependsOn: ["extract_evidence"],
    blocksDownstream: true,
    descriptionZh: "调用模型形成主题草案；保留反例和未聚类证据。",
  },
  {
    id: "assess_workflow_ai",
    skillSlug: interviewProductManagerSkills.assessWorkflowAi.slug,
    control: "model",
    dependsOn: ["cluster_insights"],
    blocksDownstream: true,
    descriptionZh: "逐个工作节点判断 AI 适用性、Skill 组合、风险和人工责任。",
  },
  {
    id: "approve_themes",
    skillSlug: interviewProductManagerSkills.approveThemes.slug,
    control: "human_gate",
    dependsOn: ["cluster_insights", "assess_workflow_ai"],
    blocksDownstream: true,
    descriptionZh: "用户逐项批准或编辑；没有批准主题时停止。",
  },
  {
    id: "generate_prd",
    skillSlug: interviewProductManagerSkills.generatePrd.slug,
    control: "model",
    dependsOn: ["approve_themes"],
    blocksDownstream: true,
    descriptionZh: "模型只基于已批准主题和有效证据生成 PRD 草稿。",
  },
  {
    id: "quality_review",
    skillSlug: interviewProductManagerSkills.qualityReview.slug,
    control: "deterministic",
    dependsOn: ["generate_prd"],
    blocksDownstream: false,
    descriptionZh: "程序检查完整性、引用和验收性；不调用模型。",
  },
];

/**
 * Deterministically normalizes plain text without asking a model to repair or
 * reinterpret the user's evidence. File parsing must happen before this call.
 */
export function normalizeInterviewText(
  input: NormalizeInterviewInput,
): NormalizeInterviewOutput {
  const normalized = input.raw_text
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\u00a0]+/g, " ")
    .trim();
  const warnings: string[] = [];

  if (!normalized) {
    return {
      project_id: input.project_id,
      normalized_segments: [],
      coverage: {
        source_count: 1,
        processed_count: 0,
        warnings: ["访谈原文为空"],
      },
    };
  }

  const segments: NormalizedSegment[] = [];
  const lines = normalized.split("\n");
  let pendingSpeaker: string | null = input.participant_label;

  lines.forEach((rawLine, lineIndex) => {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) return;
    const speakerMatch = line.match(/^([^：:]{1,24})[：:]\s*(.+)$/u);
    const speaker = speakerMatch?.[1]?.trim() ?? pendingSpeaker;
    const text = speakerMatch?.[2]?.trim() ?? line;
    pendingSpeaker = speaker;

    const chunks = splitLongSegment(text, 1200);
    chunks.forEach((chunk, chunkIndex) => {
      const number = segments.length + 1;
      segments.push({
        segment_id: `seg-${String(number).padStart(3, "0")}`,
        source_id: input.source_id,
        speaker_id: speaker,
        text: chunk,
        locator: `line:${lineIndex + 1}${
          chunks.length > 1 ? `#${chunkIndex + 1}` : ""
        }`,
        quality_flags: speaker ? [] : ["speaker_unknown"],
      });
    });
  });

  if (segments.every((segment) => segment.speaker_id === null)) {
    warnings.push("未识别到明确说话人，后续结果需人工确认");
  }
  if (segments.length === 1) {
    warnings.push("材料只有一个可分析片段，洞察聚类的证据强度有限");
  }

  return {
    project_id: input.project_id,
    normalized_segments: segments,
    coverage: {
      source_count: 1,
      processed_count: segments.length > 0 ? 1 : 0,
      warnings,
    },
  };
}

function splitLongSegment(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    const window = remaining.slice(0, maxLength + 1);
    const boundary = Math.max(
      window.lastIndexOf("。"),
      window.lastIndexOf("！"),
      window.lastIndexOf("？"),
      window.lastIndexOf("；"),
      window.lastIndexOf(" "),
    );
    const splitAt = boundary > maxLength * 0.5 ? boundary + 1 : maxLength;
    chunks.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

export function validateExtractedEvidence(
  segments: NormalizedSegment[],
  output: EvidenceExtractionOutput,
): string[] {
  const errors: string[] = [];
  const byId = new Map(segments.map((segment) => [segment.segment_id, segment]));
  const evidenceIds = new Set<string>();

  for (const item of output.evidence_items) {
    if (evidenceIds.has(item.evidence_id)) {
      errors.push(`重复 evidence_id: ${item.evidence_id}`);
    }
    evidenceIds.add(item.evidence_id);
    const segment = byId.get(item.segment_id);
    if (!segment) {
      errors.push(`${item.evidence_id} 引用了不存在的 ${item.segment_id}`);
      continue;
    }
    if (segment.source_id !== item.source_id) {
      errors.push(`${item.evidence_id} 的 source_id 与原片段不一致`);
    }
    if (!segment.text.includes(item.quote)) {
      errors.push(`${item.evidence_id} 的 quote 不是原片段的逐字子串`);
    }
    if (item.confidence < 0.7 && !item.needs_review) {
      errors.push(`${item.evidence_id} 置信度低于 0.7 但未进入人工复核`);
    }
  }

  for (const review of output.review_queue) {
    if (!evidenceIds.has(review.evidence_id)) {
      errors.push(`复核队列引用了不存在的 ${review.evidence_id}`);
    }
  }
  return errors;
}

export function validateClusteredInsights(
  evidenceItems: EvidenceItem[],
  output: InsightClusteringOutput,
  maxThemeCount: number,
): string[] {
  const errors: string[] = [];
  const byId = new Map(evidenceItems.map((item) => [item.evidence_id, item]));
  const themeIds = new Set<string>();
  const clusteredIds = new Set<string>();

  if (output.themes.length > maxThemeCount) {
    errors.push(`主题数量 ${output.themes.length} 超过上限 ${maxThemeCount}`);
  }

  for (const theme of output.themes) {
    if (themeIds.has(theme.theme_id)) {
      errors.push(`重复 theme_id: ${theme.theme_id}`);
    }
    themeIds.add(theme.theme_id);
    const supportSet = new Set(theme.supporting_evidence_ids);
    const counterSet = new Set(theme.counter_evidence_ids);

    for (const id of [...supportSet, ...counterSet]) {
      if (!byId.has(id)) errors.push(`${theme.theme_id} 引用了不存在的 ${id}`);
      clusteredIds.add(id);
    }
    for (const id of supportSet) {
      if (counterSet.has(id)) {
        errors.push(`${theme.theme_id} 把 ${id} 同时列为支持与反例`);
      }
    }

    const sourceCount = new Set(
      [...supportSet]
        .map((id) => byId.get(id)?.source_id)
        .filter((id): id is string => Boolean(id)),
    ).size;
    if (sourceCount !== theme.independent_source_count) {
      errors.push(
        `${theme.theme_id} 的 independent_source_count 应为 ${sourceCount}，实际为 ${theme.independent_source_count}`,
      );
    }
    if (counterSet.size > 0 && theme.strength !== "contested") {
      errors.push(`${theme.theme_id} 存在反例，strength 必须为 contested`);
    }
    if (
      counterSet.size === 0 &&
      sourceCount === 1 &&
      theme.strength !== "single_case"
    ) {
      errors.push(`${theme.theme_id} 只有一个支持来源，应标记 single_case`);
    }
  }

  const unclusteredIds = new Set(output.unclustered_evidence_ids);
  for (const id of unclusteredIds) {
    if (!byId.has(id)) errors.push(`未聚类列表引用了不存在的 ${id}`);
    if (clusteredIds.has(id)) errors.push(`${id} 同时出现在主题和未聚类列表`);
  }
  return errors;
}

export function validateWorkflowAiAssessment(
  output: WorkflowAiAssessmentOutput,
  evidenceItems: EvidenceItem[],
  allowedSkillSlugs: string[],
): string[] {
  const errors: string[] = [];
  const evidenceIds = new Set(evidenceItems.map((item) => item.evidence_id));
  const allowedSlugs = new Set(allowedSkillSlugs);
  const nodeIds = new Set<string>();

  for (const [index, node] of output.workflow_nodes.entries()) {
    if (nodeIds.has(node.node_id)) errors.push(`重复 node_id: ${node.node_id}`);
    nodeIds.add(node.node_id);
    const expectedId = `work-${String(index + 1).padStart(2, "0")}`;
    if (node.node_id !== expectedId) {
      errors.push(`工作节点应按顺序编号，期望 ${expectedId}，实际 ${node.node_id}`);
    }
    if (node.evidence_ids.length === 0) {
      errors.push(`${node.node_id} 没有输入证据`);
    }
    for (const id of node.evidence_ids) {
      if (!evidenceIds.has(id)) errors.push(`${node.node_id} 引用了不存在的 ${id}`);
    }
    for (const slug of node.recommended_skill_slugs) {
      if (!allowedSlugs.has(slug)) {
        errors.push(`${node.node_id} 推荐了未允许的 Skill: ${slug}`);
      }
    }
    if (
      node.ai_decision === "do_not_use_ai" &&
      node.recommended_skill_slugs.length > 0
    ) {
      errors.push(`${node.node_id} 标记为不使用 AI，但仍绑定了 Skill`);
    }
    if (node.risk_level === "high" && node.ai_decision === "ai_first") {
      errors.push(`${node.node_id} 是高风险节点，不能选择 ai_first`);
    }
    if (!node.human_role.trim() || !node.success_check.trim()) {
      errors.push(`${node.node_id} 缺少人工责任或可观察验收方式`);
    }
  }
  return errors;
}

export function applyThemeApprovals(
  input: ThemeApprovalInput,
): ThemeApprovalOutput {
  const decisionByTheme = new Map(
    input.decisions.map((decision) => [decision.theme_id, decision]),
  );
  const approvedThemes: ApprovedTheme[] = [];
  const rejectedThemeIds: string[] = [];
  const revisionRequiredThemeIds: string[] = [];

  for (const theme of input.themes) {
    const decision = decisionByTheme.get(theme.theme_id);
    if (!decision || decision.decision === "needs_revision") {
      revisionRequiredThemeIds.push(theme.theme_id);
      continue;
    }
    if (decision.decision === "rejected") {
      rejectedThemeIds.push(theme.theme_id);
      continue;
    }
    approvedThemes.push({
      ...theme,
      approved_title: decision.edited_title?.trim() || theme.title,
      approved_statement: decision.edited_statement?.trim() || theme.statement,
      approval_note: decision.human_note?.trim() || null,
    });
  }

  return {
    approved_themes: approvedThemes,
    rejected_theme_ids: rejectedThemeIds,
    revision_required_theme_ids: revisionRequiredThemeIds,
    approved_by: input.approved_by,
    can_generate_prd:
      approvedThemes.length > 0 && revisionRequiredThemeIds.length === 0,
  };
}

export function runPrdQualityChecks(
  prdResult: PrdGenerationOutput,
  approvedThemeIds: string[],
  validEvidenceIds: string[],
): PrdQualityOutput {
  const issues: QualityIssue[] = [];
  const checks: PrdQualityOutput["checks"] = [];
  const evidenceSet = new Set(validEvidenceIds);
  const themeSet = new Set(approvedThemeIds);
  const requirementIds = new Set<string>();
  const traceByRequirement = new Map(
    prdResult.traceability.map((entry) => [entry.requirement_id, entry]),
  );
  let issueNumber = 1;

  const addIssue = (
    severity: QualityIssue["severity"],
    location: string,
    rule: string,
    reason: string,
    suggestedFix: string,
  ) => {
    issues.push({
      issue_id: `quality-${String(issueNumber++).padStart(3, "0")}`,
      severity,
      location,
      rule,
      reason,
      suggested_fix: suggestedFix,
    });
  };

  if (prdResult.prd.requirements.length === 0) {
    addIssue(
      "blocker",
      "prd.requirements",
      "至少一项需求",
      "PRD 没有任何可评审需求。",
      "补充至少一项来自已批准主题的需求。",
    );
  }

  for (const requirement of prdResult.prd.requirements) {
    const location = `prd.requirements.${requirement.requirement_id}`;
    if (requirementIds.has(requirement.requirement_id)) {
      addIssue(
        "blocker",
        location,
        "需求 ID 唯一",
        "requirement_id 重复。",
        "重新编号并同步 traceability。",
      );
    }
    requirementIds.add(requirement.requirement_id);
    if (requirement.acceptance_criteria.length === 0) {
      addIssue(
        "important",
        location,
        "需求可验收",
        "该需求没有验收标准。",
        "添加至少一条可观察、可判定通过或失败的验收标准。",
      );
    }
    const invalidEvidence = requirement.evidence_ids.filter(
      (id) => !evidenceSet.has(id),
    );
    if (requirement.evidence_ids.length === 0 || invalidEvidence.length > 0) {
      addIssue(
        "blocker",
        location,
        "需求证据有效",
        invalidEvidence.length
          ? `引用了不存在的证据：${invalidEvidence.join("、")}`
          : "该需求没有证据引用。",
        "只引用本次运行中通过校验的 evidence_id。",
      );
    }
    const trace = traceByRequirement.get(requirement.requirement_id);
    if (!trace) {
      addIssue(
        "blocker",
        location,
        "需求可追溯",
        "traceability 缺少该需求。",
        "补充需求到主题与证据的映射。",
      );
      continue;
    }
    if (trace.theme_ids.some((id) => !themeSet.has(id))) {
      addIssue(
        "blocker",
        `traceability.${requirement.requirement_id}`,
        "只使用已批准主题",
        "映射引用了未批准或不存在的主题。",
        "删除未批准主题引用，或返回人工确认步骤。",
      );
    }
    if (trace.evidence_ids.some((id) => !evidenceSet.has(id))) {
      addIssue(
        "blocker",
        `traceability.${requirement.requirement_id}`,
        "追溯证据有效",
        "映射引用了不存在的证据。",
        "只保留有效 evidence_id。",
      );
    }
  }

  for (const entry of prdResult.traceability) {
    if (!requirementIds.has(entry.requirement_id)) {
      addIssue(
        "blocker",
        `traceability.${entry.requirement_id}`,
        "追溯映射无孤儿",
        "映射引用了不存在的需求。",
        "删除孤儿映射或补回对应需求。",
      );
    }
  }

  for (const [index, metric] of prdResult.prd.success_metrics.entries()) {
    if (!metric.definition.trim()) {
      addIssue(
        "important",
        `prd.success_metrics.${index}`,
        "指标定义完整",
        "指标缺少计算定义。",
        "说明分子、分母、统计对象或事件口径。",
      );
    }
    if (
      (metric.target === null || metric.timeframe === null) &&
      prdResult.open_questions.length === 0
    ) {
      addIssue(
        "suggestion",
        `prd.success_metrics.${index}`,
        "未知指标进入开放问题",
        "目标值或时间范围未知，但没有开放问题说明后续确认。",
        "新增开放问题，明确由谁补充指标目标和时间范围。",
      );
    }
  }

  const chapterChecks: [string, boolean][] = [
    ["目标非空", Boolean(prdResult.prd.goal.trim())],
    ["包含非目标", prdResult.prd.non_goals.length > 0],
    ["包含风险", prdResult.prd.risks.length > 0],
    ["包含验证顺序", prdResult.prd.rollout_plan.length > 0],
    ["需求证据追溯完整", !issues.some((item) => item.severity === "blocker")],
  ];
  checks.push(
    ...chapterChecks.map(([check, passed]) => ({
      check,
      status: passed ? ("pass" as const) : ("fail" as const),
    })),
  );

  const blockerCount = issues.filter((item) => item.severity === "blocker").length;
  const importantCount = issues.filter(
    (item) => item.severity === "important",
  ).length;
  const suggestionCount = issues.filter(
    (item) => item.severity === "suggestion",
  ).length;
  const score = Math.max(
    0,
    100 - blockerCount * 30 - importantCount * 12 - suggestionCount * 4,
  );

  return {
    decision:
      blockerCount > 0
        ? "blocked"
        : importantCount > 0
          ? "needs_revision"
          : "pass_with_notes",
    score,
    issues,
    checks,
  };
}

export const productInterviewEvaluationFixtures: EvaluationFixture<
  NormalizeInterviewInput,
  {
    mustPreserveQuotes: string[];
    expectedThemes: string[];
    expectedCounterexample: string;
    forbiddenClaims: string[];
  }
>[] = [
  {
    id: "fixture_pm_interview_notifications",
    nameZh: "产品经理多渠道反馈整理",
    input: {
      project_id: "fixture-pm-001",
      research_goal: "判断产品团队是否需要一个自动归拢用户反馈并生成每周洞察的工作流",
      source_id: "interview-pm-a",
      raw_text: `访谈员：你现在怎么处理用户反馈？
受访者A：客服群、飞书群和问卷都有，我每周五会手工复制到一个表里，通常要两个小时。
访谈员：最麻烦的是什么？
受访者A：不是复制本身，是同一件事大家说法不同，我经常重复记三遍。后来我会先搜索关键词，但还是会漏。
访谈员：如果自动整理，你最担心什么？
受访者A：我不希望它直接说“用户都想要这个”。原话和来源必须能点回去，不然我不敢拿去开需求会。
访谈员：你希望它直接创建需求吗？
受访者A：不要。它先给我几个主题，我确认后再生成 PRD 草稿就够了，优先级还是我定。
访谈员：每周都会用吗？
受访者A：发布前后会用，平时不一定。样本少的时候我宁愿自己看。`,
      participant_label: "受访者A",
    },
    expected: {
      mustPreserveQuotes: [
        "我每周五会手工复制到一个表里，通常要两个小时。",
        "原话和来源必须能点回去，不然我不敢拿去开需求会。",
        "样本少的时候我宁愿自己看。",
      ],
      expectedThemes: ["跨渠道归拢", "证据可追溯", "人工确认"],
      expectedCounterexample: "低频或样本少时不一定需要自动化",
      forbiddenClaims: [
        "所有产品经理每周都需要自动整理",
        "自动创建 Jira 需求",
        "可以自动决定优先级",
      ],
    },
  },
];
