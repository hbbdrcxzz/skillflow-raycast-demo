export type RegistryLocalizationSource =
  | "upstream_zh"
  | "upstream_zh_excerpt"
  | "curated_override"
  | "deterministic_taxonomy"
  | "source_fallback";

export type RegistryCapabilityId =
  | "deep_research"
  | "academic_research"
  | "rag_knowledge"
  | "career_interview"
  | "dataset_ml"
  | "search_infrastructure"
  | "pdf_research_reader"
  | "desktop_utility"
  | "decision_stress_test"
  | "public_opinion_research"
  | "product_research"
  | "data_analysis"
  | "content_operations"
  | "web_research"
  | "documents_reports"
  | "software_development"
  | "design_creative"
  | "workflow_automation"
  | "meetings_communication"
  | "knowledge_management"
  | "finance_research"
  | "security_governance"
  | "general_assistant"
  | "unclassified";

type CapabilityDefinition = {
  id: RegistryCapabilityId;
  label: string;
  brief: string;
  tags: string[];
  signals: string[];
};

type RegistryLocalizationInput = {
  slug: string;
  name: string;
  description: string;
  tagline?: string;
  category: string;
  tags: string[];
  semanticHints: string[];
};

type CuratedOverride = {
  brief: string;
  category: string;
  tags: string[];
  capabilityIds: RegistryCapabilityId[];
};

const capabilityTaxonomy: CapabilityDefinition[] = [
  {
    id: "search_infrastructure",
    label: "搜索与检索基础设施",
    brief: "帮助搭建或使用搜索引擎、全文索引和向量检索能力，用于为数据建立索引并提供查询接口。",
    tags: ["搜索引擎", "全文索引", "向量检索"],
    signals: [
      "search engine",
      "full-text search",
      "full text search",
      "search index",
      "search infrastructure",
      "vector search",
      "indexing engine",
      "manticoresearch",
      "elasticsearch",
      "meilisearch",
      "opensearch",
      "whoogle search",
      "redisearch",
      "flexsearch",
      "搜索引擎",
      "全文索引",
      "向量检索",
    ],
  },
  {
    id: "pdf_research_reader",
    label: "论文与 PDF 阅读",
    brief: "帮助阅读和导航学术 PDF，支持在论文中检索、跳转引用和管理阅读位置。",
    tags: ["PDF 阅读", "论文阅读", "引用导航"],
    signals: ["sioyek", "research paper reader", "academic pdf reader", "pdf research reader", "论文阅读器"],
  },
  {
    id: "desktop_utility",
    label: "桌面效率工具",
    brief: "帮助完成屏幕截图、OCR 文字识别、翻译和录屏等桌面取材任务。",
    tags: ["截图", "OCR", "翻译与录屏"],
    signals: ["esearch", "screenshot ocr", "screen capture ocr", "截图识别", "录屏"],
  },
  {
    id: "deep_research",
    label: "深度研究",
    brief: "帮助围绕复杂问题进行多步检索、来源整理与交叉综合，形成带来源线索的研究报告。",
    tags: ["深度研究", "多源检索", "来源追踪"],
    signals: [
      "deep research",
      "deepresearch",
      "gpt researcher",
      "gpt-researcher",
      "mirothinker",
      "last30days",
      "multi-agent research",
      "comprehensive research",
      "research report with citations",
      "source-backed research",
      "深度研究",
      "多源研究",
    ],
  },
  {
    id: "academic_research",
    label: "学术与论文研究",
    brief: "帮助检索、阅读、整理或跟踪论文与学术资料，并保留论文、作者和引用线索。",
    tags: ["学术研究", "论文阅读", "文献追踪"],
    signals: [
      "academic research",
      "literature review",
      "research paper",
      "scientific paper",
      "paper analysis",
      "chatpaper",
      "arxiv",
      "zotero",
      "scholar",
      "citation",
      "学术研究",
      "论文",
      "文献综述",
    ],
  },
  {
    id: "rag_knowledge",
    label: "RAG 与知识库",
    brief: "帮助构建或使用检索增强生成（RAG）与知识库，让回答能够引用指定资料。",
    tags: ["RAG", "知识库", "语义检索"],
    signals: [
      "retrieval augmented generation",
      "retrieval-augmented generation",
      "rag knowledge",
      "rag pipeline",
      "vector database",
      "vector store",
      "semantic retrieval",
      "embedding",
      "knowledge base qa",
      "知识库问答",
      "向量检索",
      "检索增强生成",
    ],
  },
  {
    id: "career_interview",
    label: "求职与面试准备",
    brief: "帮助准备求职面试问题、回答框架和练习材料；具体招聘判断仍应由人负责。",
    tags: ["求职面试", "面试准备", "职业发展"],
    signals: [
      "interview guide",
      "job interview",
      "career interview",
      "behavioral interview",
      "technical interview preparation",
      "interview questions",
      "candidate interview",
      "recruiting interview",
      "resume interview",
      "求职面试",
      "面试准备",
      "招聘面试",
    ],
  },
  {
    id: "decision_stress_test",
    label: "计划与决策复盘",
    brief: "通过连续追问检验并打磨计划或设计方案，暴露尚未解决的分支、假设与取舍。",
    tags: ["计划复盘", "决策压力测试", "假设检查"],
    signals: ["pressure-test a plan", "pressure test a plan", "sharpen a plan", "decision stress test", "计划复盘", "决策压力测试"],
  },
  {
    id: "public_opinion_research",
    label: "舆情与趋势分析",
    brief: "帮助汇集并对比公开舆情信息，分析观点分布和变化趋势，辅助人工判断。",
    tags: ["舆情分析", "趋势判断", "多源观点"],
    signals: ["public opinion analysis", "sentiment intelligence", "media intelligence", "舆情分析", "舆情", "信息茧房"],
  },
  {
    id: "dataset_ml",
    label: "数据集与机器学习",
    brief: "帮助发现、整理、检查或使用机器学习数据集，并说明数据来源、字段和适用任务。",
    tags: ["数据集", "机器学习", "训练数据"],
    signals: [
      "datasets",
      "dataset",
      "machine learning dataset",
      "training data",
      "hugging face dataset",
      "huggingface dataset",
      "kaggle dataset",
      "data science",
      "model training",
      "数据集",
      "训练数据",
      "机器学习",
    ],
  },
  {
    id: "product_research",
    label: "产品与用户研究",
    brief: "帮助整理用户反馈、访谈证据或产品需求，形成可继续评审的研究与产品材料。",
    tags: ["用户研究", "需求分析", "产品管理"],
    signals: [
      "user interview",
      "customer interview",
      "product interview",
      "customer research",
      "user research",
      "user insight",
      "product requirement",
      "prd",
      "product manager",
      "product discovery",
      "requirement",
      "用户访谈",
      "客户访谈",
      "产品访谈",
      "用户研究",
      "需求",
      "产品经理",
    ],
  },
  {
    id: "data_analysis",
    label: "数据分析",
    brief: "帮助清洗、分析或解释表格和结构化数据，并生成可检查的数据结论。",
    tags: ["数据处理", "表格分析", "可视化"],
    signals: [
      "spreadsheet",
      "excel",
      "csv",
      "sql",
      "data analysis",
      "analytics",
      "visualization",
      "chart",
      "statistics",
      "表格",
      "数据分析",
      "数据可视化",
    ],
  },
  {
    id: "content_operations",
    label: "内容与运营",
    brief: "帮助策划、撰写、改写或复用运营内容，并按目标受众和渠道整理交付物。",
    tags: ["内容创作", "运营", "营销"],
    signals: [
      "content",
      "copywriting",
      "marketing",
      "social media",
      "seo",
      "newsletter",
      "blog",
      "campaign",
      "运营",
      "营销",
      "文案",
      "内容创作",
    ],
  },
  {
    id: "web_research",
    label: "网页与信息研究",
    brief: "帮助检索、采集、比较或总结公开网页信息，并保留必要的来源线索。",
    tags: ["网页检索", "信息采集", "研究"],
    signals: [
      "web research",
      "browser",
      "browse",
      "scrape",
      "crawler",
      "web search",
      "internet search",
      "competitive research",
      "competitor",
      "网页",
      "采集",
      "竞品",
      "检索",
    ],
  },
  {
    id: "documents_reports",
    label: "文档与汇报",
    brief: "帮助读取、整理或生成文档、报告和演示材料，并保持清晰的交付结构。",
    tags: ["文档处理", "报告", "演示文稿"],
    signals: [
      "document",
      "docs",
      "pdf",
      "slide",
      "presentation",
      "powerpoint",
      "ppt",
      "report",
      "word",
      "markdown",
      "文档",
      "报告",
      "汇报",
      "演示文稿",
    ],
  },
  {
    id: "software_development",
    label: "软件开发",
    brief: "帮助完成代码编写、调试、测试或工程维护；采用前仍需核对运行环境和代码权限。",
    tags: ["编程", "调试", "工程效率"],
    signals: [
      "coding",
      "code",
      "developer",
      "software",
      "debug",
      "testing",
      "test automation",
      "frontend",
      "backend",
      "api",
      "github",
      "git",
      "编程",
      "代码",
      "开发",
      "调试",
    ],
  },
  {
    id: "design_creative",
    label: "设计与创意",
    brief: "帮助生成或评审界面、品牌和视觉创意，并把设计意图整理成可执行方案。",
    tags: ["界面设计", "视觉创意", "设计审查"],
    signals: [
      "design",
      "ui design",
      "ux design",
      "user interface",
      "user experience",
      "visual",
      "image",
      "brand",
      "creative",
      "figma",
      "设计",
      "视觉",
      "创意",
      "界面",
    ],
  },
  {
    id: "workflow_automation",
    label: "工作流与自动化",
    brief: "帮助把重复步骤连接成自动化流程；启用前需要确认涉及的系统、写入范围和人工审批点。",
    tags: ["工作流", "自动化", "系统连接"],
    signals: [
      "workflow",
      "automation",
      "integration",
      "connector",
      "zapier",
      "n8n",
      "scheduled",
      "工作流",
      "自动化",
      "连接器",
    ],
  },
  {
    id: "meetings_communication",
    label: "会议与协作",
    brief: "帮助整理会议材料、沟通内容或协作记录，形成待办、摘要或可共享的结果。",
    tags: ["会议纪要", "沟通协作", "任务整理"],
    signals: [
      "meeting",
      "minutes",
      "transcript",
      "email",
      "calendar",
      "slack",
      "teams",
      "communication",
      "会议",
      "纪要",
      "邮件",
      "日历",
    ],
  },
  {
    id: "knowledge_management",
    label: "知识管理",
    brief: "帮助归档、检索、总结或重组知识材料，使信息更容易被查找和复用。",
    tags: ["知识库", "信息整理", "总结"],
    signals: [
      "knowledge",
      "notion",
      "summarize",
      "summary",
      "note",
      "wiki",
      "memory",
      "research paper",
      "知识库",
      "总结",
      "笔记",
    ],
  },
  {
    id: "finance_research",
    label: "金融与投研",
    brief: "帮助整理公司、市场或财务信息并形成研究材料；结论仍需人工核验，不构成投资建议。",
    tags: ["金融研究", "公司分析", "财务分析"],
    signals: [
      "finance",
      "financial",
      "investment",
      "equity research",
      "stock",
      "valuation",
      "due diligence",
      "earnings",
      "投研",
      "金融",
      "财务",
      "估值",
      "尽调",
    ],
  },
  {
    id: "security_governance",
    label: "安全与治理",
    brief: "帮助检查安全、权限、合规或质量风险，并输出需要人工复核的检查结果。",
    tags: ["安全检查", "权限治理", "合规"],
    signals: [
      "security",
      "audit",
      "compliance",
      "privacy",
      "permission",
      "vulnerability",
      "governance",
      "安全",
      "审计",
      "合规",
      "隐私",
      "权限",
    ],
  },
  {
    id: "general_assistant",
    label: "通用效率",
    brief: "帮助处理通用办公与个人效率任务；采用前仍需核对具体输入、输出和权限边界。",
    tags: ["办公效率", "通用助手"],
    signals: ["general office assistant", "office productivity assistant", "办公助手", "通用办公助手"],
  },
  {
    id: "unclassified",
    label: "待确认分类",
    brief: "暂无可靠中文说明，请查看作者原始描述，并核对输入、输出、权限和适用边界。",
    tags: ["待分类"],
    signals: [],
  },
];

const deepResearchOverride: CuratedOverride = {
  brief: "帮助围绕复杂问题进行多步检索、来源整理与交叉综合，形成带来源线索的研究报告。",
  category: "深度研究",
  tags: ["深度研究", "多源检索", "来源追踪"],
  capabilityIds: ["deep_research"],
};

const academicResearchOverride: CuratedOverride = {
  brief: "帮助检索、阅读、整理或跟踪论文与学术资料，并保留论文、作者和引用线索。",
  category: "学术与论文研究",
  tags: ["学术研究", "论文阅读", "文献追踪"],
  capabilityIds: ["academic_research"],
};

const careerInterviewOverride: CuratedOverride = {
  brief: "帮助准备求职面试问题、回答框架和练习材料；具体招聘判断仍应由人负责。",
  category: "求职与面试准备",
  tags: ["求职面试", "面试准备", "职业发展"],
  capabilityIds: ["career_interview"],
};

const datasetMlOverride: CuratedOverride = {
  brief: "帮助发现、整理、检查或使用机器学习数据集，并说明数据来源、字段和适用任务。",
  category: "数据集与机器学习",
  tags: ["数据集", "机器学习", "训练数据"],
  capabilityIds: ["dataset_ml"],
};

function searchOverride(brief: string, tags: string[]): CuratedOverride {
  return {
    brief,
    category: "搜索与检索基础设施",
    tags,
    capabilityIds: ["search_infrastructure"],
  };
}

const sioyekOverride: CuratedOverride = {
  brief: "帮助阅读和导航学术 PDF，支持在论文中检索、跳转引用和管理阅读位置。",
  category: "论文与 PDF 阅读",
  tags: ["PDF 阅读", "论文阅读", "引用导航"],
  capabilityIds: ["pdf_research_reader"],
};

const eSearchOverride: CuratedOverride = {
  brief: "帮助完成屏幕截图、OCR 文字识别、翻译和录屏等桌面取材任务。",
  category: "桌面效率工具",
  tags: ["截图", "OCR", "翻译与录屏"],
  capabilityIds: ["desktop_utility"],
};

const last30daysOverride: CuratedOverride = {
  brief: "帮助研究最近一段时间的公开讨论与采用信号，整理不同来源中的真实观点和变化。",
  category: "深度研究",
  tags: ["近期研究", "社区观点", "多源检索"],
  capabilityIds: ["deep_research"],
};

const grillMeOverride: CuratedOverride = {
  brief: "通过连续追问检验并打磨计划或设计方案，暴露尚未解决的分支、假设与取舍。",
  category: "计划与决策复盘",
  tags: ["计划复盘", "连续追问", "假设检查"],
  capabilityIds: ["decision_stress_test"],
};

const grillWithDocsOverride: CuratedOverride = {
  brief: "通过连续追问把工程计划与现有代码库交叉验证，收紧领域语言，并在决策稳定后更新 CONTEXT.md 和 ADR。",
  category: "计划与决策复盘",
  tags: ["工程计划", "代码库核验", "决策记录"],
  capabilityIds: ["decision_stress_test", "software_development"],
};

const bettaFishOverride: CuratedOverride = {
  brief: "通过多 Agent 汇集并对比舆情信息，分析观点分布与未来趋势，辅助用户做人工决策。",
  category: "舆情与趋势分析",
  tags: ["舆情分析", "趋势判断", "多源观点"],
  capabilityIds: ["public_opinion_research"],
};

const curatedOverrides: Record<string, CuratedOverride> = {
  "grill-me": grillMeOverride,
  "grill-with-docs": grillWithDocsOverride,
  bettafish: bettaFishOverride,
  manticoresearch: searchOverride(
    "开源搜索数据库，可建立全文和向量索引，并作为 Elasticsearch 的替代方案提供查询服务。",
    ["搜索数据库", "全文索引", "向量检索"],
  ),
  elasticsearch: searchOverride(
    "分布式 RESTful 搜索引擎，用于为数据建立索引并提供全文检索与查询接口。",
    ["分布式搜索", "全文索引", "REST API"],
  ),
  meilisearch: searchOverride(
    "面向网站和应用的搜索引擎 API，侧重低延迟检索，并支持 AI 混合搜索。",
    ["站内搜索", "搜索 API", "混合搜索"],
  ),
  opensearch: searchOverride(
    "开源分布式 RESTful 搜索引擎，用于搭建可查询的数据索引与搜索服务。",
    ["开源搜索", "分布式索引", "REST API"],
  ),
  "whoogle-search": searchOverride(
    "可自行托管、无广告且重视隐私的元搜索引擎，用于聚合网页搜索结果。",
    ["元搜索", "隐私保护", "自行托管"],
  ),
  redisearch: searchOverride(
    "为 Redis 数据提供二级索引、全文检索、向量相似度搜索和聚合查询。",
    ["Redis 索引", "全文检索", "向量搜索"],
  ),
  flexsearch: searchOverride(
    "适用于浏览器和 Node.js 的全文检索库，用于在应用内构建文本索引与搜索。",
    ["全文检索库", "浏览器", "Node.js"],
  ),
  "search-plugins": searchOverride(
    "为 qBittorrent 的搜索功能提供可安装插件，用于接入不同的资源搜索来源。",
    ["qBittorrent", "搜索插件", "来源接入"],
  ),
  sioyek: sioyekOverride,
  esearch: eSearchOverride,
  deepresearch: deepResearchOverride,
  "deep-research": deepResearchOverride,
  "gpt-researcher": deepResearchOverride,
  "local-deep-research": deepResearchOverride,
  "deep-research-web-ui": deepResearchOverride,
  mirothinker: deepResearchOverride,
  last30days: last30daysOverride,
  "academic-research": academicResearchOverride,
  chatpaper: academicResearchOverride,
  "zotero-arxiv-daily": academicResearchOverride,
  "daily-arxiv": academicResearchOverride,
  "interview-guide": careerInterviewOverride,
  datasets: datasetMlOverride,
  "frontend-design": {
    brief: "帮助生成或改进前端界面设计，并从信息层级、组件和视觉一致性角度给出可执行方案。",
    category: "设计与创意",
    tags: ["前端设计", "界面设计", "视觉审查"],
    capabilityIds: ["design_creative", "software_development"],
  },
  "skill-creator": {
    brief: "帮助把专业知识和重复流程整理成结构清晰、可测试、可维护的 Skill。",
    category: "工作流与自动化",
    tags: ["Skill 创建", "流程设计", "质量检查"],
    capabilityIds: ["workflow_automation", "software_development"],
  },
  spreadsheets: {
    brief: "帮助创建、编辑、分析和检查表格数据，适用于 Excel、CSV 等常见办公数据。",
    category: "数据分析",
    tags: ["Excel", "表格分析", "数据处理"],
    capabilityIds: ["data_analysis", "documents_reports"],
  },
  presentations: {
    brief: "帮助创建、编辑和检查演示文稿，把内容组织成适合沟通与汇报的页面结构。",
    category: "文档与汇报",
    tags: ["PPT", "演示文稿", "汇报"],
    capabilityIds: ["documents_reports", "design_creative"],
  },
  documents: {
    brief: "帮助创建、编辑和检查结构化文档，适用于报告、方案和日常办公材料。",
    category: "文档与汇报",
    tags: ["文档处理", "报告", "办公效率"],
    capabilityIds: ["documents_reports"],
  },
  pdf: {
    brief: "帮助读取、生成或检查 PDF 文件，在版式重要的任务中保留可视化验证步骤。",
    category: "文档与汇报",
    tags: ["PDF", "文档处理", "版式检查"],
    capabilityIds: ["documents_reports"],
  },
};

const chineseSearchIntents = [
  { signals: ["用户访谈", "访谈", "用户研究"], terms: ["user interview", "customer research", "user insights"] },
  { signals: ["产品需求", "需求文档", "prd"], terms: ["product requirements document", "product management"] },
  { signals: ["产品分析", "产品运营"], terms: ["product analytics", "product operations"] },
  { signals: ["表格", "excel", "csv", "数据分析"], terms: ["spreadsheet", "Excel", "CSV data analysis"] },
  { signals: ["竞品", "竞争对手"], terms: ["competitor research", "competitive analysis"] },
  { signals: ["运营", "文案", "营销", "内容"], terms: ["content operations", "marketing copywriting", "social media"] },
  { signals: ["ppt", "演示", "汇报", "幻灯片"], terms: ["presentation", "slides", "PowerPoint"] },
  { signals: ["网页采集", "爬虫", "网页检索"], terms: ["web scraping", "browser research", "information extraction"] },
  { signals: ["周报", "日报", "报告"], terms: ["weekly report", "status report", "report generation"] },
  { signals: ["金融", "投研", "财务", "估值", "尽调"], terms: ["financial research", "investment analysis", "due diligence"] },
  { signals: ["设计", "界面", "视觉", "原型"], terms: ["UI UX design", "frontend design", "visual review"] },
  { signals: ["代码", "编程", "开发", "调试", "测试"], terms: ["software development", "coding", "debugging and testing"] },
  { signals: ["会议", "纪要", "录音"], terms: ["meeting notes", "transcript summarization", "action items"] },
  { signals: ["翻译", "本地化"], terms: ["translation", "localization"] },
];

const tagTranslations: Record<string, string> = {
  analytics: "数据分析",
  automation: "自动化",
  browser: "网页浏览",
  coding: "编程",
  content: "内容创作",
  data: "数据处理",
  design: "设计",
  docs: "文档处理",
  finance: "金融研究",
  marketing: "营销",
  pdf: "PDF",
  productivity: "办公效率",
  research: "研究",
  security: "安全检查",
  slides: "演示文稿",
  spreadsheet: "表格分析",
  testing: "测试",
  workflow: "工作流",
};

const statusLabels: Record<string, Record<string, string>> = {
  quality: {
    excellent: "证据充分",
    high: "证据较充分",
    good: "证据较充分",
    fair: "证据有限",
    low: "证据不足",
    pending: "待评估",
    unknown: "待评估",
    unreviewed: "待评估",
  },
  trust: {
    verified: "已验证",
    trusted: "较可信",
    good: "较可信",
    caution: "需要复核",
    warning: "存在警告",
    pending: "待复核",
    unknown: "待复核",
    unreviewed: "待复核",
  },
  safety: {
    low: "低风险",
    medium: "中等风险",
    high: "高风险",
    critical: "严重风险",
    safe: "低风险",
    reviewed: "已复核",
    pending: "待复核",
    unknown: "未复核",
    unreviewed: "未复核",
    blocked: "已阻断",
  },
  maintenance: {
    active: "持续维护",
    maintained: "持续维护",
    stable: "维护稳定",
    inactive: "近期未维护",
    stale: "可能已过期",
    archived: "已归档",
    deprecated: "已停止维护",
    unknown: "维护状态未知",
  },
  risk: {
    low: "低风险",
    medium: "中等风险",
    high: "高风险",
    critical: "严重风险",
    unknown: "待评估",
    unreviewed: "待评估",
  },
  attribution: {
    claimed: "作者已认领",
    creator_claimed: "作者已认领",
    verified: "作者已验证",
    community_indexed: "社区公开索引",
    indexed: "公开索引",
    unknown: "来源待复核",
  },
};

const permissionDefinitions = [
  {
    signals: ["delete", "remove", "destructive", "删除"],
    label: "删除数据",
    reason: "可能删除或移除数据，执行前必须确认对象、范围和恢复方式。",
  },
  {
    signals: ["shell", "command", "execute", "terminal", "script", "命令", "脚本"],
    label: "执行本地命令",
    reason: "可能运行命令或脚本，采用前需要检查允许范围和实际执行内容。",
  },
  {
    signals: ["write", "create", "update", "modify", "publish", "send", "写入", "发布", "发送"],
    label: "写入或修改数据",
    reason: "可能在目标系统中创建、修改、发送或发布内容，关键动作需要人工确认。",
  },
  {
    signals: ["filesystem", "file", "folder", "directory", "文件", "目录"],
    label: "访问文件",
    reason: "可能读取或处理文件，请把授权范围限制在完成任务所需的文件或目录。",
  },
  {
    signals: ["network", "http", "web", "browser", "internet", "网络", "网页"],
    label: "访问网络",
    reason: "可能向外部网站或服务发送请求，请确认数据去向和目标域名。",
  },
  {
    signals: ["email", "mail", "邮箱", "邮件"],
    label: "访问邮件",
    reason: "可能读取或发送邮件，请限制账户、文件夹和发送动作的授权范围。",
  },
  {
    signals: ["calendar", "日历"],
    label: "访问日历",
    reason: "可能读取或创建日程，请确认日历范围和是否允许对外邀请。",
  },
  {
    signals: ["database", "sql", "数据库"],
    label: "访问数据库",
    reason: "可能查询或修改数据库，请使用最小权限并优先采用只读连接。",
  },
  {
    signals: ["read", "读取"],
    label: "读取数据",
    reason: "可能读取任务相关数据，请把授权对象和持续时间限制在必要范围。",
  },
];

function compact(value: string, maxLength: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1).trim()}…` : normalized;
}

function includesChinese(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function normalizeIdentity(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function matchesSignal(haystack: string, signal: string) {
  if (includesChinese(signal) || signal.includes(" ")) return haystack.includes(signal);
  const escaped = signal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`).test(haystack);
}

function resolveCuratedOverride(input: RegistryLocalizationInput) {
  const identities = [normalizeIdentity(input.slug), normalizeIdentity(input.name)];
  const exact = identities.map((identity) => curatedOverrides[identity]).find(Boolean);
  if (exact) return exact;
  if (identities.some((identity) => /^academic-research-skills(?:-|$)/.test(identity))) {
    return academicResearchOverride;
  }
  if (identities.some((identity) => /^last30days(?:-skill)?(?:-|$)/.test(identity))) {
    return last30daysOverride;
  }
  return undefined;
}

function detectCapabilities(input: RegistryLocalizationInput) {
  const evidence = [
    { text: `${input.slug} ${input.name}`.toLowerCase(), weight: 4 },
    { text: input.semanticHints.join(" ").toLowerCase(), weight: 6 },
    { text: `${input.category} ${input.tags.join(" ")}`.toLowerCase(), weight: 3 },
    { text: `${input.description} ${input.tagline || ""}`.toLowerCase(), weight: 2 },
  ];
  const ranked = capabilityTaxonomy
    .map((capability) => ({
      capability,
      score: capability.signals.reduce(
        (score, signal) =>
          score + evidence.reduce((signalScore, item) => signalScore + (matchesSignal(item.text, signal) ? item.weight : 0), 0),
        0,
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score);

  return (ranked.length ? ranked : [{ capability: capabilityTaxonomy.at(-1)!, score: 0 }]).slice(0, 3);
}

function chineseCharacterCount(value: string) {
  return value.match(/[\u3400-\u9fff]/g)?.length || 0;
}

function extractChineseBrief(value: string) {
  if (!includesChinese(value)) return null;
  const latinWordCount = value.match(/[A-Za-z][A-Za-z0-9+_.-]*/g)?.length || 0;
  if (latinWordCount === 0) {
    return { text: compact(value, 180), source: "upstream_zh" as const };
  }

  const candidates = value
    .split(/(?:\r?\n|[。！？!?;；]|\s+[—–|/]\s+)+/)
    .map((segment) =>
      segment
        .replace(/[A-Za-z][A-Za-z0-9+_.-]*(?:\s+[A-Za-z][A-Za-z0-9+_.-]*)*/g, " ")
        .replace(/^[\s,，:：·\-—–]+|[\s,，:：·\-—–]+$/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((segment) => chineseCharacterCount(segment) >= 6)
    .sort((left, right) => chineseCharacterCount(right) - chineseCharacterCount(left));

  return candidates[0]
    ? { text: compact(candidates[0], 180), source: "upstream_zh_excerpt" as const }
    : null;
}

function localizedTags(originalTags: string[], capabilities: CapabilityDefinition[], curated?: string[]) {
  if (curated?.length) return curated;
  const translated = originalTags
    .map((tag) => (includesChinese(tag) ? compact(tag, 18) : tagTranslations[tag.trim().toLowerCase()]))
    .filter((tag): tag is string => Boolean(tag));
  return unique([...translated, ...capabilities.flatMap((capability) => capability.tags)]).slice(0, 8);
}

export function localizeRegistrySkill(input: RegistryLocalizationInput) {
  const curated = resolveCuratedOverride(input);
  const detected = detectCapabilities(input);
  const byId = new Map(capabilityTaxonomy.map((capability) => [capability.id, capability]));
  const capabilities = curated
    ? curated.capabilityIds.map((id) => byId.get(id)).filter((item): item is CapabilityDefinition => Boolean(item))
    : detected.map((item) => item.capability);
  const upstreamChineseBrief = extractChineseBrief(input.description) || extractChineseBrief(input.tagline || "");

  const source: RegistryLocalizationSource = curated
    ? "curated_override"
    : upstreamChineseBrief
      ? upstreamChineseBrief.source
      : detected[0]?.score
        ? "deterministic_taxonomy"
        : "source_fallback";
  const primaryCapability = capabilities[0] || capabilityTaxonomy.at(-1)!;
  const brief = curated?.brief || upstreamChineseBrief?.text || primaryCapability.brief;

  return {
    locale: "zh-CN" as const,
    brief,
    category: curated?.category || primaryCapability.label,
    tags: localizedTags(input.tags, capabilities, curated?.tags),
    capabilityIds: capabilities.map((capability) => capability.id),
    source,
    confidence:
      source === "curated_override"
        ? 1
        : source === "upstream_zh"
          ? 0.95
          : source === "upstream_zh_excerpt"
            ? 0.75
            : source === "deterministic_taxonomy"
              ? 0.72
              : 0,
    needsReview:
      source === "upstream_zh_excerpt" || source === "deterministic_taxonomy" || source === "source_fallback",
    notice:
      source === "curated_override"
        ? "平台维护的中文功能说明；能力边界仍以作者原始说明为准。"
        : source === "upstream_zh"
          ? "沿用上游提供的中文说明。"
          : source === "upstream_zh_excerpt"
            ? "从中英混合的上游说明中提取中文句，尚待复核；准确边界以原始说明为准。"
            : source === "source_fallback"
              ? "公开元数据不足，暂不推断具体功能；请查看作者原始描述。"
              : "基于公开元数据和能力分类生成的规则化中文说明，不是逐字人工翻译；准确边界以原始说明为准。",
    schemaVersion: "registry-localization.v2" as const,
  };
}

export function localizeRegistryStatus(
  domain: keyof typeof statusLabels,
  status: string,
  upstreamLabel: string,
  fallback: string,
) {
  if (includesChinese(upstreamLabel)) return compact(upstreamLabel, 40);
  const normalizedStatus = status.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const normalizedLabel = upstreamLabel.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return statusLabels[domain][normalizedStatus] || statusLabels[domain][normalizedLabel] || fallback;
}

export function localizeRegistryWarning(warning: string) {
  if (includesChinese(warning)) return compact(warning, 120);
  const normalized = warning.toLowerCase();
  if (normalized.includes("owner") || normalized.includes("claim")) return "作者身份尚未完成验证。";
  if (normalized.includes("install")) return "安装准备状态需要进一步复核。";
  if (normalized.includes("permission")) return "权限范围需要在采用前进一步复核。";
  if (normalized.includes("maintain") || normalized.includes("stale")) return "维护状态可能影响当前可用性。";
  return "上游记录了一项信任警告，请展开原始说明复核。";
}

export function localizeRegistryPermission(id: string, label: string, reason: string) {
  if (includesChinese(label) && includesChinese(reason)) {
    return {
      label: compact(label, 40),
      reason: compact(reason, 160),
      source: "upstream_zh" as const,
    };
  }
  const haystack = `${id} ${label} ${reason}`.toLowerCase();
  const definition = permissionDefinitions.find((item) => item.signals.some((signal) => haystack.includes(signal)));
  return {
    label: definition?.label || "需要额外权限",
    reason: definition?.reason || "上游声明该 Skill 需要额外权限，采用前请核对具体对象、范围、时长和用途。",
    source: "deterministic_taxonomy" as const,
  };
}

export function expandRegistrySearchQuery(query: string) {
  const original = compact(query, 400);
  const normalized = original.toLowerCase();
  const matchedIntents = chineseSearchIntents.filter((intent) =>
    intent.signals.some((signal) => normalized.includes(signal)),
  );
  const englishTerms = unique(matchedIntents.flatMap((intent) => intent.terms)).slice(0, 12);
  const suffix = englishTerms.length ? ` Search intents: ${englishTerms.join(", ")}.` : "";
  return {
    original,
    upstreamTask: compact(`${original}${suffix}`, 400),
    strategy: englishTerms.length ? ("zh_intent_expansion_v1" as const) : ("original_query" as const),
    englishTerms,
  };
}
