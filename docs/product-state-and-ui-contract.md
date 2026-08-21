# Skillflow 产品状态与 UI 契约

> Phase 1 冻结稿 · 2026-08-21  
> 适用范围：首页双入口、Workflow Lab、Node Inspector、Outcome Lens、Command Home，以及它们依赖的 Skill、Workflow Run、Artifact、权限与版本状态。  
> 本文是前后端共同遵守的产品契约。示例字段采用 TypeScript 表示，不等同于当前数据库实现。

## 1. 契约目标与不可破坏的原则

Skillflow 同时支持两条一级入口：

1. **找一个 Skill**：用户知道自己需要哪类能力，希望快速比较、试用和运行单个 Skill。
2. **让 AI 组合工作流**：用户只知道工作目标，由 AI 澄清上下文、拆分步骤并组合 Skill。

两条入口必须在 **Outcome Lens（可检查的真实结果）** 汇合，不能形成两套互不兼容的产品。

以下原则为强约束：

- AI 可以推荐和生成草案，但不能未经确认执行高风险外部动作。
- 一个 Skill 足够时，不得为了展示工作流而强行组合多个 Skill。
- 没有可信 Skill 时，不得把低置信候选包装为可直接运行的成功匹配。
- 样例 Demo 不读取用户连接；读取真实数据必须进入即时授权流程。
- 自然语言修改必须先形成结构化 Diff；权限、成本或外部副作用上升时必须重新确认。
- 单 Skill 和工作流运行都必须产出统一 Artifact，并保留来源、版本和运行血缘。
- 部分成功、结果未知和版本过期是一级状态，不能压缩成普通 `error`。
- Command Home 以任务、待确认事项和成果为核心，不展示普通 Dashboard 的 KPI 卡片墙。
- 动效只表达状态之间的因果，不得成为业务状态本身；刷新、深链接和 reduced motion 下必须保持同样可用。

## 2. 统一术语与核心对象

| 术语 | 定义 |
|---|---|
| Skill | 可独立试用或作为 Workflow Node 执行的版本化能力单元。 |
| Skill Release | Skill 的不可变发布版本，包含输入输出契约、权限、兼容性与风险声明。 |
| Workflow | 用户保存的能力组合定义，本身不等于某次运行。 |
| Workflow Revision | Workflow 的不可变版本；任何结构、参数、权限引用变化都生成新 revision。 |
| Workflow Node | Workflow 中引用特定 Skill Release 的步骤。 |
| Run | 单 Skill 或 Workflow 的一次执行实例。 |
| Artifact | Run 产生的可预览、可验证、可导出、可继续修改的成果。 |
| Outcome Lens | 检查输入、输出、处理过程、来源和 Diff 的结果界面。 |
| Workflow Lab | AI 生成、比较、配置、试运行和修改能力路径的工作区。 |
| Node Inspector | 与当前选中节点绑定的配置、权限、Demo 和 AI 修改面板。 |
| Command Home | 登录后的任务入口与继续工作界面，不是统计 Dashboard。 |
| Side Effect | 对外部系统产生写入、发送、删除、支付或公开发布。 |

### 2.1 稳定标识与版本规则

- `skillId` 标识 Skill 产品，`skillReleaseId` 标识不可变发布版本。
- `workflowId` 标识用户工作流，`workflowRevisionId` 标识不可变结构版本。
- `runId` 标识一次运行；重试失败节点必须创建新的 attempt，不覆盖原 attempt。
- `artifactId` 标识逻辑成果，`artifactVersionId` 标识不可变成果版本。
- 已保存 Workflow 默认固定引用 `skillReleaseId`，不得自动漂移到最新版本。
- 更新 Skill 只能通过显式迁移生成新的 `workflowRevisionId`。

## 3. 跨页面主状态机

### 3.1 顶层状态

```ts
type ProductStage =
  | "discover"
  | "single_skill_results"
  | "single_skill_detail"
  | "diagnosing"
  | "workflow_planning"
  | "workflow_lab"
  | "outcome_lens"
  | "command_home";

type EntryIntent =
  | "find_skill"
  | "compose_workflow"
  | "open_saved_workflow"
  | "open_recent_artifact"
  | "unknown";
```

### 3.2 首页双入口判定

首页必须同时提供两个可点击的显式动作：

- `找一个 Skill`
- `让 AI 组合工作流`

AI 可以返回意图建议，但 UI 不得只靠隐式路由。若用户输入“周报”这类歧义查询，结果面板同时显示：

1. `搜索“周报”相关 Skill`
2. `把“周报”拆成一条工作流`

```ts
interface IntentResolution {
  suggestedIntent: EntryIntent;
  confidence: number; // 0..1
  alternatives: Array<{
    intent: EntryIntent;
    label: string;
    reason: string;
  }>;
}
```

前端规则：

- `confidence < 0.75` 时不得自动跳转，只显示两种选择。
- 用户选定入口后，本次 session 内保持该选择，除非用户主动切换。
- 单 Skill 搜索结果页始终提供次级动作 `让 AI 为这个任务组合工作流`。
- Workflow Lab 中每个节点始终提供 `替换 Skill` 和 `仅运行这个 Skill`。

### 3.3 双入口汇合规则

```text
找一个 Skill
  → Skill 详情
  → 样例 Demo / 真实试运行
  → Outcome Lens
  → 添加到我的能力 / 加入工作流 / 正式运行

让 AI 组合工作流
  → 最少必要诊断
  → 计划草案
  → Workflow Lab
  → 节点 Demo / 全路径试运行
  → Outcome Lens
  → 保存组合 / 正式运行
```

Outcome Lens 不应根据入口复制两套组件。差异通过 `subjectType` 表达：

```ts
type OutcomeSubject =
  | { subjectType: "skill_run"; skillReleaseId: string }
  | { subjectType: "workflow_run"; workflowRevisionId: string };
```

## 4. Skill 状态契约

```ts
type SkillAvailability =
  | "available"
  | "requires_connection"
  | "incompatible"
  | "unavailable"
  | "deprecated"
  | "suspended";

type TrustLevel = "verified" | "reviewed" | "community" | "untrusted";
type RiskLevel = "low" | "medium" | "high";

interface SkillReleaseSummary {
  skillId: string;
  skillReleaseId: string;
  version: string;
  name: string;
  outcomeStatement: string;
  trustLevel: TrustLevel;
  riskLevel: RiskLevel;
  availability: SkillAvailability;
  inputTypes: string[];
  outputTypes: string[];
  requiredConnections: ConnectionRequirement[];
  permissionManifest: PermissionManifest;
  compatibility: CompatibilityResult;
  lastVerifiedAt?: string;
  deprecation?: {
    effectiveAt: string;
    replacementSkillReleaseId?: string;
    reason: string;
  };
}
```

### 4.1 CTA 随 Skill 状态变化

| 状态 | 主 CTA | 次 CTA | 禁止行为 |
|---|---|---|---|
| `available` 且未试用 | 用样例试运行 | 查看详情 | 不得先要求连接真实数据 |
| 样例成功 | 用我的数据运行 | 添加到我的能力 | 不得将样例结果伪装为用户真实结果 |
| `requires_connection` | 连接 `{service}` 后运行 | 继续使用样例 | 不得把 OAuth 失败显示成 Skill 执行失败 |
| `incompatible` | 无主 CTA | 收藏 / 查看兼容要求 | 不得允许执行 |
| 已添加 | 运行 Skill | 加入工作流 | 不使用“再次安装” |
| `deprecated` | 迁移到替代 Skill | 查看旧版本 | 不得新建引用旧版本的工作流 |
| `suspended` | 无主 CTA | 查看原因 | 不得重试或绕过 |

## 5. Workflow Lab 状态机

### 5.1 Workflow 计划状态

```ts
type WorkflowPlanState =
  | "draft"
  | "clarifying"
  | "generating"
  | "plan_ready"
  | "needs_configuration"
  | "needs_permission"
  | "ready"
  | "stale"
  | "blocked";

type RecommendationShape =
  | "single_skill_sufficient"
  | "minimum_viable_route"
  | "full_workflow"
  | "no_trusted_skill";
```

```ts
interface WorkflowPlan {
  planId: string;
  state: WorkflowPlanState;
  objective: string;
  context: TaskContext;
  recommendationShape: RecommendationShape;
  confidence: number;
  routes: WorkflowRouteProposal[];
  unresolvedQuestions: ClarificationQuestion[];
  blockingIssues: BlockingIssue[];
  generatedAt: string;
  expiresAt: string;
}
```

### 5.2 一个 Skill 足够

当 `recommendationShape === "single_skill_sufficient"`：

- Workflow Lab 显示一条单节点路径，不得人为添加包装节点。
- 标题明确为 `这个任务，一个 Skill 就够了`。
- 主 CTA 为 `预览这个 Skill 的结果`。
- 次 CTA 为 `仍然查看完整自动化方案`，仅在存在合理完整方案时展示。
- 用户接受后可直接进入 Outcome Lens；只有点击 `保存为工作流` 时才创建单节点 Workflow。
- 后端必须返回判定理由和未采用多节点方案的原因。

```ts
interface SingleSkillSufficientDecision {
  skillReleaseId: string;
  confidence: number;
  reasons: string[];
  avoidedComplexity?: string[];
}
```

### 5.3 无可信 Skill

当 `recommendationShape === "no_trusted_skill"` 或全部候选不满足最低信任门槛：

- 不显示“可运行”或“匹配成功”。
- 页面状态为 `blocked`，但保留用户任务和已完成诊断。
- 明确区分：无匹配、只有低可信候选、平台不兼容、暂时不可用。
- 可提供的动作仅为：
  - `查看近似 Skill`（必须显示缺口与风险）；
  - `提交能力需求`；
  - `让 AI 临时完成一次`（若平台具备安全的一次性执行能力）；
  - `修改任务范围`。
- 未经额外确认不得将低可信候选自动放入 Workflow。

```ts
interface NoTrustedSkillIssue extends BlockingIssue {
  code: "NO_TRUSTED_SKILL";
  nearMatches: Array<{
    skillReleaseId: string;
    gaps: string[];
    trustLevel: TrustLevel;
    riskLevel: RiskLevel;
  }>;
}
```

### 5.4 Workflow Node 状态

```ts
type NodeReadiness =
  | "unresolved"
  | "needs_configuration"
  | "needs_permission"
  | "ready"
  | "version_outdated"
  | "blocked";

interface WorkflowNodeDefinition {
  nodeId: string;
  position: number;
  label: string;
  skillReleaseId?: string;
  candidateSkillReleaseIds: string[];
  selectedConfiguration: Record<string, unknown>;
  readiness: NodeReadiness;
  inputBindings: InputBinding[];
  outputBindings: OutputBinding[];
  permissionManifest: PermissionManifest;
  sideEffects: SideEffectDeclaration[];
  estimatedCost?: CostEstimate;
  blockingIssues: BlockingIssue[];
}
```

节点视觉规则：

- 同屏主路径默认不超过 7 个节点，其他节点折叠为阶段组。
- `needs_configuration` 使用中性待办状态，不得使用错误红色。
- `needs_permission` 显示锁标识和所需连接，不能显示为 `ready`。
- `version_outdated` 不得自动迁移；运行前必须解决或明确使用旧版本。
- `blocked` 必须展示可恢复动作或不可恢复原因。

## 6. Node Inspector 契约

Node Inspector 只绑定当前选中节点，不承担全局 Workflow 设置。未选中节点时显示 Workflow 概览。

```ts
type InspectorMode =
  | "overview"
  | "skill_summary"
  | "configure"
  | "permissions"
  | "demo"
  | "ai_modify"
  | "diff_review"
  | "run_status";
```

### 6.1 模式转换

```text
overview
  └─ select node → skill_summary
skill_summary
  ├─ configure → configure
  ├─ connect / authorize → permissions
  ├─ sample demo → demo
  └─ natural language edit → ai_modify
ai_modify
  └─ diff generated → diff_review
diff_review
  ├─ cancel → skill_summary
  ├─ apply, no permission change → skill_summary + new revision
  └─ apply, permission/risk increase → permissions
```

### 6.2 需要配置

`needs_configuration` 必须返回结构化字段，不能只返回一段 AI 说明：

```ts
interface ConfigurationRequirement {
  key: string;
  label: string;
  description?: string;
  type: "text" | "number" | "boolean" | "select" | "mapping" | "secret_ref";
  required: boolean;
  options?: Array<{ value: string; label: string }>;
  currentValue?: unknown;
  suggestedValue?: unknown;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}
```

前端必须区分：

- 可接受 AI 建议的配置；
- 必须由用户选择的业务决策；
- 必须通过安全连接提供的 secret，前端不得接收或回显明文。

### 6.3 需要权限

权限摘要必须具体到服务、资源范围、动作和目的：

```ts
interface PermissionManifest {
  reads: PermissionItem[];
  writes: PermissionItem[];
  sends: PermissionItem[];
  deletes: PermissionItem[];
  publishes: PermissionItem[];
  payments: PermissionItem[];
}

interface PermissionItem {
  service: string;
  resourceType: string;
  scope: string;
  purpose: string;
  required: boolean;
}
```

授权成功只表示连接可用，不等于用户已确认本次外部副作用。发送、删除、支付和公开发布必须在每次运行前显示具体目标并确认。

## 7. 自然语言修改与 Diff 契约

所有自然语言修改先创建 `ChangeProposal`，不得直接更新 Workflow 或 Skill personal variant。

```ts
type ChangeKind =
  | "add_node"
  | "remove_node"
  | "replace_skill"
  | "reorder_node"
  | "change_configuration"
  | "change_input_binding"
  | "change_output_binding"
  | "change_permission"
  | "change_side_effect"
  | "change_cost_limit";

interface ChangeProposal {
  proposalId: string;
  baseWorkflowRevisionId: string;
  summary: string;
  changes: Array<{
    kind: ChangeKind;
    nodeId?: string;
    before: unknown;
    after: unknown;
    reason: string;
  }>;
  impact: ChangeImpact;
  state: "proposed" | "requires_reauthorization" | "applied" | "rejected" | "expired";
  expiresAt: string;
}

interface ChangeImpact {
  permissionDelta: PermissionDelta;
  riskBefore: RiskLevel;
  riskAfter: RiskLevel;
  sideEffectsAdded: SideEffectDeclaration[];
  estimatedCostBefore?: CostEstimate;
  estimatedCostAfter?: CostEstimate;
  compatibilityIssues: BlockingIssue[];
}
```

### 7.1 Diff 导致权限升级

满足任一条件即视为权限升级：

- 新增服务连接；
- 读取范围扩大；
- 从只读变为写入；
- 新增发送、删除、支付或公开发布；
- 外部动作目标从单个对象扩大为批量或通配范围；
- Skill 替换后风险等级上升；
- Skill Release 的权限声明发生变化。

处理规则：

1. `ChangeProposal.state = "requires_reauthorization"`。
2. `应用修改` CTA 改为 `查看新增权限`。
3. 用户先审核 Diff，再审核新增权限；两步不得合并为一个模糊确认。
4. 授权或风险确认完成后，创建新的 `workflowRevisionId`。
5. 原 revision 保持可回滚，不得原地覆盖。
6. 若用户拒绝新增权限，提案保持未应用，并提供 `让 AI 改成不需要该权限的方案`。

## 8. Run 状态机与恢复规则

```ts
type RunState =
  | "queued"
  | "preparing"
  | "awaiting_configuration"
  | "awaiting_permission"
  | "awaiting_side_effect_confirmation"
  | "running"
  | "paused"
  | "partially_succeeded"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "outcome_unknown";

type NodeRunState =
  | "pending"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "cancelled"
  | "outcome_unknown";
```

### 8.1 状态转换守卫

- `ready → running` 前必须满足配置、连接和必要授权。
- 存在高风险 Side Effect 时，先进入 `awaiting_side_effect_confirmation`。
- 取消只停止尚未完成的节点；已发生外部副作用不能假装回滚成功。
- 重试必须携带 `idempotencyKey`；发送、支付、创建等动作不得无条件自动重试。
- Run 完成后至少产生一个 Artifact 或一份明确的无成果报告。

### 8.2 部分成功

进入 `partially_succeeded` 的条件：至少一个节点成功且至少一个节点失败、跳过或结果未知。

UI 必须：

- 立即开放已完成 Artifact；
- 标明失败节点对最终成果的影响；
- 提供 `仅重试失败步骤`；
- 提供 `替换失败 Skill`；
- 若下游允许，提供 `手动补充结果并继续`；
- 不提供含糊的全局 `再次运行` 作为唯一动作。

```ts
interface PartialSuccessRecovery {
  retryableNodeIds: string[];
  replaceableNodeIds: string[];
  resumableFromNodeIds: string[];
  completedArtifactIds: string[];
  sideEffectsAlreadyCommitted: SideEffectReceipt[];
}
```

### 8.3 `outcome_unknown`

`outcome_unknown` 表示请求已发出，但无法确认第三方是否完成；它既不是成功也不是普通失败。

必须遵守：

- 默认禁止自动重试；
- UI 显示外部目标、请求时间、幂等键和最后检查时间；
- 主 CTA 为 `检查外部状态`；
- 次 CTA 为 `我已确认未执行，允许重试`；
- 用户确认重试前必须提示重复发送、重复创建或重复付款风险；
- 后端必须保留原始 provider request ID 和可用的查询方式。

```ts
interface UnknownOutcomeDetail {
  nodeRunId: string;
  provider: string;
  operation: string;
  targetLabel: string;
  providerRequestId?: string;
  idempotencyKey: string;
  requestedAt: string;
  lastCheckedAt?: string;
  duplicateRisk: "low" | "medium" | "high";
}
```

## 9. 版本过期与迁移

### 9.1 过期判定

以下任一情况使节点进入 `version_outdated`：

- 引用的 Skill Release 已弃用或暂停；
- 当前 Release 与连接 API 不兼容；
- 新 Release 修复高风险安全问题；
- 权限 manifest 或输入输出 schema 不再匹配；
- Workflow Plan 超过 `expiresAt`，候选排序可能失效。

### 9.2 UI 与运行规则

- 普通功能更新：允许继续运行已固定版本，同时提供迁移预览。
- 兼容性破坏：阻止受影响节点运行，要求迁移或替换。
- 安全暂停：立即阻止运行，不提供继续使用旧版本。
- 迁移必须展示输入输出、权限、成本和结果格式 Diff。
- 迁移生成新的 Workflow Revision；不得覆盖旧 revision。

## 10. Artifact 统一模型

```ts
type ArtifactKind =
  | "document"
  | "spreadsheet"
  | "presentation"
  | "image"
  | "video"
  | "audio"
  | "webpage"
  | "email"
  | "message"
  | "dataset"
  | "structured_data"
  | "archive"
  | "external_reference";

type ArtifactState =
  | "draft"
  | "complete"
  | "partial"
  | "invalid"
  | "superseded"
  | "deleted";

interface Artifact {
  artifactId: string;
  artifactVersionId: string;
  kind: ArtifactKind;
  state: ArtifactState;
  title: string;
  mimeType?: string;
  preview: ArtifactPreview;
  contentRef: string;
  externalRef?: {
    provider: string;
    url?: string;
    externalId?: string;
  };
  lineage: ArtifactLineage;
  validation: ArtifactValidation;
  createdAt: string;
  createdBy: "user" | "ai" | "skill" | "external_system";
}

interface ArtifactPreview {
  mode: "native" | "rendered" | "thumbnail" | "metadata_only";
  previewUrl?: string;
  textExcerpt?: string;
  dimensions?: { width: number; height: number };
}

interface ArtifactLineage {
  runId: string;
  nodeRunId?: string;
  sourceArtifactVersionIds: string[];
  skillReleaseIds: string[];
  workflowRevisionId?: string;
  citations?: Array<{ label: string; url?: string; sourceArtifactVersionId?: string }>;
}

interface ArtifactValidation {
  status: "not_checked" | "passed" | "warning" | "failed";
  issues: Array<{
    code: string;
    severity: "info" | "warning" | "error";
    message: string;
    location?: string;
  }>;
}
```

强约束：

- Artifact 内容不得直接塞入列表接口；列表只返回预览和 metadata。
- 每次 AI 修改生成新的 `artifactVersionId`。
- Outcome Lens 必须能从 Artifact 追溯到 Run、Node、Skill Release 和源 Artifact。
- `partial` Artifact 可以查看和导出，但必须带显著不完整标识。
- 外部邮件或消息在发送前是 Artifact draft；发送后追加 Side Effect Receipt，不覆盖草稿历史。

## 11. Outcome Lens 页面契约

```ts
type OutcomeLensMode =
  | "compare"
  | "result"
  | "process"
  | "sources"
  | "diff"
  | "recovery";
```

Outcome Lens 必须包含：

- 当前 Artifact 与状态；
- 原始输入或上一个版本；
- 可检查的真实结果；
- 运行/节点/Skill 版本血缘；
- 权限和已发生 Side Effect；
- 修改入口与版本 Diff；
- 部分成功或结果未知时的恢复操作。

不同状态的默认 Tab：

| Run / Artifact 状态 | 默认模式 |
|---|---|
| 样例成功 | `compare` |
| 正式成功 | `result` |
| AI 修改待确认 | `diff` |
| 部分成功 | `recovery` |
| `outcome_unknown` | `recovery` |
| 验证失败 | `process` 并展示 validation issues |

CTA 规则：

- 样例结果：`用我的数据运行`。
- 单 Skill 正式结果：`保存成果`；次级为 `加入工作流`。
- Workflow 正式结果：`保存为能力组合` 或 `再次运行`，取决于是否已保存。
- 有未确认 Side Effect：`检查并确认发送`，不得显示普通 `完成`。
- 部分成功：`仅重试失败步骤`。
- `outcome_unknown`：`检查外部状态`。

## 12. Command Home 页面契约

Command Home 不是数据统计 Dashboard，首屏固定优先级如下：

1. 全局任务命令框；
2. 需要用户确认或恢复的任务；
3. 正在运行的任务；
4. 最近 Artifact；
5. 已保存的 Workflow 与已添加 Skill。

```ts
interface CommandHomePayload {
  attentionItems: AttentionItem[];
  activeRuns: RunSummary[];
  recentArtifacts: ArtifactSummary[];
  savedWorkflows: WorkflowSummary[];
  savedSkills: SkillReleaseSummary[];
}

type AttentionReason =
  | "needs_configuration"
  | "needs_permission"
  | "side_effect_confirmation"
  | "partial_success"
  | "outcome_unknown"
  | "version_outdated"
  | "change_requires_reauthorization";
```

禁止在 Command Home 首屏使用：总 Skill 数、总运行数、本月节省时间等 KPI 卡片作为主要内容。此类统计只能进入独立分析或团队管理页面。

空状态：

- 新用户：显示命令框、两个入口和 3 个可真实运行的样例任务。
- 无进行中任务：隐藏该段，不显示空白卡。
- 无最近成果：展示一个样例 Artifact，并明确标记为样例。
- 所有列表加载失败：命令入口仍然可用；每个模块独立重试，不阻塞全页。

## 13. CTA 语义冻结

同一动词必须始终代表同一后端动作。

| CTA | 精确定义 | 是否产生持久化/副作用 |
|---|---|---|
| 找一个 Skill | 进入 Skill 检索，不创建 Workflow | 否 |
| 让 AI 组合工作流 | 创建 Workflow Plan 草案 | 保存草案，可删除 |
| 用样例试运行 | 在隔离样例数据上创建 Run | 保存 Run/Artifact，不访问用户连接 |
| 用我的数据运行 | 校验连接、权限和副作用后创建正式 Run | 是 |
| 添加到我的能力 | 保存 Skill Release 引用 | 是，不执行 Skill |
| 加入工作流 | 将 Skill Release 作为节点加入草稿 revision | 是，不执行 Workflow |
| 保存为能力组合 | 创建或更新 Workflow，并生成不可变 revision | 是 |
| 生成修改预览 | 创建 ChangeProposal | 保存提案，不应用 |
| 应用修改 | 基于提案创建新 revision / personal variant | 是，不自动运行 |
| 查看新增权限 | 进入权限审核 | 否 |
| 确认并执行 | 确认当前运行的具体 Side Effect 后继续 | 是，可能产生外部副作用 |
| 仅重试失败步骤 | 创建新的节点 attempts，复用已成功输出 | 是 |
| 检查外部状态 | 查询 provider 状态，不重发请求 | 否 |
| 迁移版本 | 生成迁移提案或新 revision | 是，不自动运行 |

以下文案禁止作为主要 CTA，因为动作不明确：`开始使用`、`继续`、`完成`、`确认`、`立即体验`。只有上下文已经在同一视口内明确时，才允许使用 `继续`。

## 14. API 响应与错误契约

### 14.1 通用响应

```ts
interface ApiEnvelope<T> {
  data?: T;
  error?: ApiError;
  requestId: string;
  serverTime: string;
}

interface ApiError {
  code: string;
  message: string;
  recoverability: "retryable" | "user_action_required" | "not_recoverable";
  retryAfterMs?: number;
  fieldErrors?: Record<string, string>;
  blockingIssues?: BlockingIssue[];
}
```

### 14.2 建议端点边界

端点命名可调整，但职责不得混合：

```text
POST   /api/intents/resolve
GET    /api/skills/search
GET    /api/skills/:skillId/releases/:releaseId
POST   /api/skills/:releaseId/sample-runs
POST   /api/workflow-plans
POST   /api/workflow-plans/:planId/answers
GET    /api/workflow-plans/:planId
POST   /api/workflows
POST   /api/workflows/:workflowId/change-proposals
POST   /api/change-proposals/:proposalId/apply
POST   /api/runs
GET    /api/runs/:runId
POST   /api/runs/:runId/confirm-side-effects
POST   /api/runs/:runId/retry-failed
POST   /api/node-runs/:nodeRunId/check-external-status
GET    /api/artifacts/:artifactId/versions/:versionId
GET    /api/home
```

创建 Run、应用 Diff、确认 Side Effect、重试和迁移请求必须接受 `Idempotency-Key`。前端超时后不得自行判断失败并重复提交。

### 14.3 前端轮询/事件

Run 更新推荐使用 SSE 或等价事件流；若使用轮询：

- `queued/preparing`：2 秒；
- `running`：1 秒起，指数退避至 5 秒；
- 页面后台化后最大 15 秒；
- 终态停止轮询；
- `outcome_unknown` 不自动轮询第三方，除非 provider 明确支持安全查询。

事件至少包含：

```ts
type RunEvent =
  | { type: "run.state_changed"; runId: string; state: RunState }
  | { type: "node.state_changed"; nodeRunId: string; state: NodeRunState }
  | { type: "artifact.created"; artifact: ArtifactSummary }
  | { type: "artifact.version_created"; artifactVersionId: string }
  | { type: "run.attention_required"; reason: AttentionReason }
  | { type: "side_effect.recorded"; receipt: SideEffectReceipt };
```

## 15. 共享动效边界

动效服务于跨阶段连续性，但不能跨越安全确认或伪造完成状态。

### 15.1 允许共享的对象

| 来源 | 目标 | 共享对象 |
|---|---|---|
| 首页命令框 | 诊断 | 任务文本、命令窗口外壳 |
| 诊断 | Workflow Lab | 任务上下文、已确认来源图标 |
| Workflow Lab | Outcome Lens | 选中输出节点、Skill 图标、运行状态 |
| Outcome Lens | Command Home | 当前 Artifact、任务标题、状态 |
| Skill 详情 | Outcome Lens | Demo 预览、Skill 身份与版本 |

### 15.2 不允许动画跨越的边界

- OAuth 或权限确认必须是稳定、可阅读的确定性 UI。
- 发送、删除、支付、公开发布确认不得被 shared transition 隐藏。
- `partial_success`、`failed`、`outcome_unknown` 不得通过庆祝动画弱化。
- 应用 Diff 前后必须可比较，不能用形变掩盖删除或权限变化。
- 路由刷新或深链接进入时，页面必须直接渲染正确终态，不依赖前序动画。

### 15.3 时序 token

```ts
const motion = {
  micro: 120,
  control: 180,
  panel: 240,
  stateChange: 320,
  sharedElement: 480,
  maxBlocking: 600,
};
```

- 微交互：80–180ms。
- 面板与确定性状态切换：220–320ms。
- 跨页面共享对象：420–520ms。
- 不得用超过 600ms 的不可中断动画阻塞操作。
- 请求仍在进行时，动画完成后必须进入真实 pending 状态，不能循环假进度。

### 15.4 Reduced motion

`prefers-reduced-motion: reduce` 下：

- shared-element 改为不超过 120ms 的 crossfade；
- sticky scroll 叙事改为普通纵向内容；
- 取消视差、连续环境光、自动 marquee、弹性和路径绘制；
- 拖拽与 Workflow 操作仍保持 1:1 响应；
- 所有状态、权限和恢复能力保持完整。

## 16. Phase 1 前后端验收清单

### 前端

- [ ] 首页两种入口都可直接点击，意图判断错误可一键切换。
- [ ] 单 Skill 与 Workflow 都使用同一个 Outcome Lens 数据接口。
- [ ] `single_skill_sufficient` 有独立状态，不显示伪多节点流程。
- [ ] `no_trusted_skill` 不显示成功匹配 CTA。
- [ ] Node Inspector 支持配置、权限、Demo、AI 修改和 Diff 五类模式。
- [ ] Diff 权限升级时，`应用修改` 被 `查看新增权限` 替换。
- [ ] `partially_succeeded` 和 `outcome_unknown` 有独立恢复界面。
- [ ] 版本过期可查看迁移 Diff，不能静默升级。
- [ ] Command Home 首屏优先显示 attention items、active runs 和 Artifact。
- [ ] 深链接、刷新与 reduced motion 不依赖前序动画。

### 后端

- [ ] Skill Release、Workflow Revision、Artifact Version 均不可变且有稳定 ID。
- [ ] Workflow Plan 返回 `recommendationShape`、置信度、阻断问题和过期时间。
- [ ] Run 与 Node Run 分别保存状态和 attempt。
- [ ] 部分成功保留已完成输出，支持仅重试失败步骤。
- [ ] `outcome_unknown` 保存 provider request ID、幂等键和重复风险。
- [ ] ChangeProposal 返回权限、风险、成本和副作用 Diff。
- [ ] 权限升级不会在应用 Diff 时被绕过。
- [ ] 高风险外部动作需要独立确认并返回 Side Effect Receipt。
- [ ] 所有创建、应用、重试和确认接口支持幂等键。
- [ ] Artifact 可追溯到 Run、Node、Skill Release、Workflow Revision 和源 Artifact。

### 联调阻断条件

以下任一项未实现，不得把对应流程标记为可正式运行：

- 无幂等保护的发送、支付、删除或创建操作；
- 无权限 Diff 的自然语言工作流修改；
- 无节点级状态的多步骤运行；
- 无恢复路径的 `partial_success`；
- 将 `outcome_unknown` 当作普通失败自动重试；
- 将过期或暂停 Skill 自动升级到新版本；
- 样例 Demo 误用用户真实连接；
- 无 Artifact 血缘的最终成果。

