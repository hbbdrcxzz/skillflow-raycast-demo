# Skillflow Canonical Skill Contract v1

状态：Phase 1 冻结草案  
适用范围：中国区首发的互联网产品与运营 Skill；同时适用于单 Skill 试用和工作流节点绑定。  
规范版本：`1.0.0`

## 1. 契约目标

Canonical Skill Contract 是 Skillflow 内部唯一的 Skill 规范化对象。它不是商品文案，也不是任一宿主的安装文件，而是连接以下环节的执行契约：

1. 用户任务与 Skill 检索；
2. 工作流节点与 Skill 版本绑定；
3. 沙箱试用与正式运行；
4. 权限、连接器、地域和数据策略判断；
5. 证据分级、评测、版本升级和失败回退；
6. 用户个性化配置与未来 Skill Fork。

任何 Skill 在进入推荐、试用或工作流前，都必须被规范化为本契约。模型不得发明未注册的 Skill、连接器、权限或版本。

## 2. 设计原则

### 2.1 工作流是主对象，Skill 是节点实现

工作流保存业务目标、节点顺序、输入输出契约和审批点；节点通过 `skill_id + version` 引用不可变 Skill 版本。单 Skill 可以独立试用，但不能绕开节点契约和运行策略。

### 2.2 作者声明与平台证据严格分离

作者、README 或仓库中的能力描述只能进入 E0。只有平台实际完成格式校验、沙箱运行、独立评测或生产观测后，才能升级为 E1—E4。

### 2.3 不使用可互相抵消的单一信任总分

任务适配、输入输出、安全权限、地域、维护和结果证据分别记录。高任务适配不能抵消阻断级权限、许可证或数据风险。

### 2.4 版本不可变

已发布版本的指令、脚本、Schema、权限、连接器或数据策略发生变化时，必须生成新版本。工作流默认锁定具体版本，升级前展示结构化 Diff。

### 2.5 个性化默认不修改原 Skill

语气、字段、篇幅、阈值、受众和模板等进入 `personalization.fields`，保存为用户 Overlay。只有步骤、工具、输入输出契约或权限发生本质变化时，才进入 Fork 流程。

## 3. 顶层结构

每个 `data/skills/*.json` 文件表示一个 Skill 的当前规范化清单，必须包含以下顶层字段：

```json
{
  "manifest_version": "1.0.0",
  "skill": {},
  "task": {},
  "node": {},
  "contracts": {},
  "permissions": {},
  "connectors": {},
  "region_data_policy": {},
  "execution": {},
  "evidence": {},
  "license": {},
  "versioning": {},
  "evaluations": {},
  "failure_policy": {},
  "personalization": {}
}
```

未知字段可以保留，但运行时不得根据未进入本规范的自由文本隐式扩大权限或能力。

## 4. 字段定义

### 4.1 `manifest_version`

- 必填，语义化版本字符串。
- 表示本清单结构版本，不是 Skill 内容版本。
- 当前仅接受 `1.0.0`。

### 4.2 `skill`

| 字段 | 要求 | 说明 |
|---|---|---|
| `id` | 必填、全局唯一 | 推荐格式 `skl_<domain>_<capability>` |
| `slug` | 必填 | 小写英文和连字符，用于 URL 与文件名 |
| `name_zh` | 必填 | 面向用户的中文名称 |
| `summary_zh` | 必填 | 一句话说明可交付结果，不使用夸大承诺 |
| `domain` | 必填 | 首发使用 `internet-product-operations` |
| `status` | 必填 | `draft`、`review`、`active`、`deprecated`、`blocked` |
| `source_type` | 必填 | `platform-example`、`platform-built-in`、`external-import`、`creator-submission` |
| `source_status` | 必填 | `example-only`、`pending-import`、`source-verified` |
| `author` | 必填 | 作者名、作者状态和来源；示例必须明确标注占位 |
| `tags` | 必填数组 | 用于检索，不作为能力证据 |

### 4.3 `task`

任务定义必须面向用户工作，而不是复述技术实现。

| 字段 | 说明 |
|---|---|
| `definition_zh` | Skill 要完成的单一工作 |
| `jobs_to_be_done_zh` | 用户在何种情况下希望得到什么结果 |
| `applies_when_zh` | 适用条件数组 |
| `not_for_zh` | 不适用、禁止或必须转人工的情况 |
| `success_criteria_zh` | 可检验的任务完成标准 |
| `assumptions_zh` | 运行所依赖的前提，不满足时不得静默推断 |

### 4.4 `node`

`node.type` 仅允许：

- `input`：读取或接收材料；
- `deterministic-processing`：确定性转换、去重、映射或计算；
- `ai-cognitive`：语义抽取、分类、分析或生成；
- `validation`：格式、引用、证据或质量验证；
- `human-decision`：人类审批或判断；
- `output-action`：写入或对外动作。

`node.recommended_execution_mode` 仅允许：

- `deterministic`；
- `ai-auto`；
- `ai-with-exception`；
- `ai-draft-human-approve`；
- `human-only`。

`node.cognitive_fit` 与 `node.autonomy_risk` 使用 `low`、`medium`、`high`。高自治风险节点不得因 Skill 评分高而跳过人类审批。

### 4.5 `contracts`

`contracts.input_schema` 与 `contracts.output_schema` 使用 JSON Schema Draft 2020-12 的对象子集：

- 必须有 `$schema`、`type`、`required` 和 `properties`；
- 顶层默认 `additionalProperties: false`；
- 文件、引用和材料使用平台对象 ID，不把二进制或 Secret 写入清单；
- 下游节点只能连接兼容 Schema，或显式插入映射节点；
- 自由文本描述不能代替 Schema。

### 4.6 `permissions`

权限必须描述真实动作，不使用“完整访问”等模糊表达。

```json
{
  "risk_level": "low | medium | high | blocked",
  "read": [],
  "write": [],
  "network": {
    "mode": "none | allowlist | connector-only",
    "allowlist": []
  },
  "credentials": [],
  "external_actions": [],
  "requires_per_run_confirmation": false
}
```

新增写入、凭据、外部发送、境外域名或高权限操作时必须生成新版本并重新确认。

### 4.7 `connectors`

- `required`：缺少即无法运行；
- `optional`：只增强输入或输出；
- 每项包含 `connector_id`、`mode`（`read`/`write`/`read-write`）、`purpose_zh`；
- MVP 只允许平台注册连接器，如上传文件、网页读取、飞书和 Jira；
- 未接入连接器不得以“可用”状态出现在前台。

### 4.8 `region_data_policy`

必须包含：

- `default_processing_region`：中国区首发默认为 `CN`；
- `allowed_processing_regions`；
- `foreign_model_policy.allowed`；
- `foreign_model_policy.requires_explicit_consent`；
- `foreign_model_policy.disclosure_zh`；
- `data_classes_allowed`；
- `data_classes_blocked`；
- `retention`；
- `training_policy_zh`。

允许境外模型不等于默认使用境外模型。若启用境外模型，运行前必须显示数据字段、接收方、地区和保存策略，并取得明确授权。

### 4.9 `execution`

`execution.class` 仅允许：

- `instruction-only`：仅包含受控指令，不执行附带代码；
- `built-in`：由平台内置确定性能力实现；
- `allowlist`：只执行经过审查、固定哈希和依赖的允许列表代码。

还需定义：

- `runtime`；
- `timeout_seconds`；
- `max_retries`；
- `deterministic_temperature` 或等价模型策略；
- `side_effects`；
- `human_gate`；
- `sandbox_required`。

任意 Shell、运行时包安装、读取宿主环境变量和未声明网络访问不属于 MVP 允许范围。

### 4.10 `evidence`

证据等级定义：

| 等级 | 含义 | 可支持的结论 |
|---|---|---|
| E0 | 作者或平台示例声明 | 只说明计划能力 |
| E1 | 格式、Schema、静态与依赖检查通过 | 结构合法、可进入测试 |
| E2 | 官方样例在受控沙箱真实运行成功 | 可在指定样例与环境运行 |
| E3 | 平台独立测试集达到阈值 | 对一类任务有可复现结果 |
| E4 | 绑定版本与环境的真实生产遥测 | 对特定真实场景有持续结果 |

`evidence.current_level` 只能由实际完成的证据决定。首批规划清单统一从 E0 开始，评测用例标记 `planned`，不得预填成功率。

### 4.11 `license`

许可证信息是内部风控事实，不等于法律意见。字段包括：

- `declared_license`：已核验时填 SPDX 或明确文本；未核验填 `null`；
- `source_status`：`example-placeholder`、`pending-verification`、`verified`；
- `internal_tier`：后台分级，例如 `L0_EXAMPLE_ONLY`、`L1_INDEX_ONLY`、`L2_TRY_ALLOWED`、`L3_DISTRIBUTION_ALLOWED`、`BLOCKED`；
- `commercial_use_status`：`blocked-until-verified`、`review-required`、`allowed`；
- `notice_zh`：事实说明。

内部商业分级不在 MVP 前台展示，但作者、来源、许可证和版本事实必须保留。示例作者和待导入来源不得伪装成真实开源项目。

### 4.12 `versioning`

- `current_version` 使用语义化版本；
- `versions` 至少记录当前版本、状态、内容哈希状态和变化；
- Phase 1 示例允许 `content_hash: null`，但进入 E1 前必须生成；
- 修改指令、Schema、权限、连接器、地域策略、评测标准或执行代码必须生成新版本；
- `breaking_change` 标识输入输出或权限是否不兼容。

### 4.13 `evaluations`

每个 Skill 至少包含两个计划评测：正常样例和边界/失败样例。字段包括：

- `id`；
- `name_zh`；
- `status`：`planned`、`running`、`passed`、`failed`；
- `fixture_zh`；
- `assertions_zh`；
- `required_evidence_level`；
- `last_result`，未运行时必须为 `null`。

### 4.14 `failure_policy`

必须声明：

- 已知失败模式；
- 哪些错误允许自动重试；
- 哪些错误必须停止；
- fallback Skill 或 fallback 行为；
- 何时转人工；
- 是否允许部分结果。

不得用大模型“自行想办法”代替失败策略。

### 4.15 `personalization`

每个字段必须声明：

- `key`；
- `label_zh`；
- `type`；
- `default`；
- `allowed_values` 或约束；
- `affects`；
- `requires_new_skill_version`。

默认个性化只创建用户 Overlay。任何扩大权限、改变输入输出 Schema、增加外部工具或改变执行代码的修改，都必须转为 Fork 或新 Skill 版本。

## 5. 运行前强制校验

Skill 进入沙箱前，平台必须检查：

1. 清单结构和版本合法；
2. Skill 当前版本存在且未被撤回；
3. 输入符合 `input_schema`；
4. 下游可接受 `output_schema`；
5. 所需连接器已注册、已授权且区域可用；
6. 权限符合用户和组织策略；
7. 执行类别与沙箱能力匹配；
8. 数据等级与模型、地域策略兼容；
9. 许可证内部等级未阻断当前动作；
10. 当前证据等级满足推荐或试用门槛；
11. 预算、超时、重试和人工审批点已配置。

任何阻断项失败时，应返回结构化原因，不得降级为无约束聊天执行。

## 6. 首批工作流组合

“访谈 → 洞察 → PRD”黄金工作流建议按以下节点绑定：

1. `interview-material-normalizer`：把文本、文档、表格或转写结果统一为可引用材料；
2. `interview-evidence-extractor`：抽取原话、需求、行为、痛点和证据定位；
3. `user-insight-clusterer`：跨访谈聚类主题并保留反例；
4. `product-opportunity-synthesizer`：将主题转成机会判断、置信度和待验证假设；
5. `prd-draft-generator`：在人工确认机会后生成 PRD 草稿；
6. `deliverable-quality-reviewer`：检查证据、边界、结构和不当确定性。

竞品与周报能力由以下 Skill 提供：

- `competitor-change-analyzer`；
- `product-weekly-report-generator`。

需求池扩展能力：

- `requirement-prioritizer`。

所有首批清单均为 Skillflow Phase 1 平台示例，不代表已导入外部开源项目，也不具备 E2 以上运行证据。

## 7. Phase 1 进入下一阶段的门槛

单个 Skill 从 E0 进入可推荐/可试用前，至少需要：

- JSON 清单通过自动 Schema 校验；
- 作者和来源状态明确；
- 许可证状态不再是示例占位；
- 固定 Skill 版本与内容哈希；
- 正常与失败评测实际运行；
- 权限、连接器、地域和数据策略通过审查；
- 沙箱输出满足 `success_criteria_zh`；
- 失败和 fallback 可以被真实触发并观测。

在上述条件完成前，前台只能将其标记为平台示例或规划能力，不能显示“已验证”“可安全运行”或虚构成功率。
