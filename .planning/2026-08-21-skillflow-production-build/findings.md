# Findings & Decisions

## Requirements Already Confirmed
- China-first Skill marketplace and workbench for internet product and operations users.
- Direct Skill discovery/install/use and AI-assisted workflow decomposition are equally valid paths.
- User can bind chat to an existing Skill or workflow node, generate a semantic Diff, test it, and save a personal configuration or Fork.
- Open-source Skills and user-submitted Skills form the initial supply; authorship and licensing must remain traceable.
- Product is free during the current phase; pricing and revenue sharing are deferred.
- Runtime/sandbox sample demonstration, granular permission, human confirmation, results, workbench, creator tools, and governance remain in scope.

## Irreversible Gaps Found in Preflight Audit
1. Hosted execution boundary: arbitrary third-party scripts would turn the product into an untrusted-code execution platform and multiply infrastructure/security scope. Recommended MVP default: instruction-only Skills, built-in nodes, and explicitly allowlisted code only.
2. Region boundary: “China region” means Chinese users and product localization, not mainland-only residency. The user explicitly allows external models and cross-border processing. The platform must still minimize transmitted fields, isolate credentials, record actual model/region, and provide deletion controls.
3. Connector write boundary: the first Feishu/Jira capabilities must specify product region, cloud/private deployment, resource scope, and write actions. Recommended MVP default: Feishu CN user OAuth with selected-resource read plus explicit-confirmation creation of a new document; no overwrite/delete/bulk send. Jira Cloud is read-only if included; Jira Data Center is deferred.

## Confirmed Irreversible Boundaries
- Hosted runtime does not execute arbitrary third-party scripts. Only instruction-only Skills, built-in nodes, and explicitly allowlisted code are hosted.
- Global infrastructure and external models are allowed; no mainland-only storage promise will be made.
- Feishu CN supports selected-resource read plus explicit-confirmation creation of a new document. No overwrite, delete, or silent bulk send. Jira Cloud is a later read-only connector; Jira Data Center/private networking is deferred.

## Product Defaults That Do Not Need Further User Discussion
- Skillflow uses its own managed runtime for the MVP; external Agent export is complementary.
- Three golden workflows run for real; unsupported catalog breadth is not presented as executable.
- Anonymous users can use official sample data; login is required for private data, connections, saving, and real runs.
- Single Skill and workflows converge on a common Artifact/Outcome layer.
- “Try → Add to my abilities → Add to workflow → Run” replaces installation-centric consumer language.
- Workflows use controlled templates, nodes, and registered Skill releases; AI cannot invent runnable components.
- All high-risk or externally visible actions require explicit human approval.
- Free Beta still has configurable fair-use, time, file, model, network, and retry limits.
- Desktop Web is primary; mobile supports viewing and approval, not complex graph editing.
- The signed-in landing surface is a Command Home, not a generic KPI dashboard.

## Technical Defaults
- Canonical layers: source package → Skillflow manifest/release → internal versioned workflow plan → host adapters.
- Immutable SkillRelease and WorkflowVersion; workflows pin exact releases.
- PersonalConfiguration changes declared parameters; instruction, graph, schema, tool, permission, region, or write changes create a Fork/new version.
- Connector and model credentials never enter prompts or run containers; Tool Broker and Model Gateway mediate access.
- Public Skill import states: index-only, install-from-source, redistributable, hosted-runnable.
- Unknown licenses remain index-only and internally marked as requiring author communication.
- Module-oriented monolith first; Sites D1/R2 for the first hosted production slice, with Model Gateway, Connector Broker, and Run Orchestrator boundaries kept portable.

## UX Defaults
- One command-first homepage with two explicit actions: find one Skill or let AI compose a workflow.
- Homepage, diagnosis, capability route, and Outcome Lens remain one continuous product window; long-lived work moves into Command Home.
- Workflow states extend beyond loading/success/error to include configuration, permission, partial success, outcome unknown, outdated, and cancellation.
- Node Inspector exposes business purpose, AI verdict, human responsibility, selected Skill/release, score evidence, permissions, I/O contract, fallback, and acceptance criteria.
- Dark graphite brand stage; warm-light Artifact, permission, and long-reading surfaces.

## Existing Prototype Status
- The previously deployed version validates visual language and interaction direction only; it should be replaced by the current verified build.
- The current local build now has a real public Registry adapter and a real model-runtime implementation. Search/detail/compare/install-handoff are usable without a model key. The seven-node private workflow requires `OPENAI_API_KEY` and `OPENAI_MODEL` in the server environment and refuses fake fallback output when they are absent.
- Persistence, creator submission/claim, outcomes, ranking UI, connector OAuth, arbitrary file parsing beyond `.txt`/`.md`, and the remaining two golden workflows are not complete and must not be described as finished.

## 2026-08-22 Product and Visual Audit — User-Reported Gaps
- The latest screenshot confirms a hierarchy failure rather than a simple “make the font larger” issue: labels, evidence, status, body copy and node titles occupy a narrow 12–16 px-like band with insufficient contrast, while large containers consume most of the viewport. The result is low information salience despite high spatial cost.
- The current workflow visualization begins from a predeclared task context and fixed nodes. It visualizes a recommendation, but it does not yet provide the requested conversational discovery loop: free-form work narration → adaptive clarification → intent confirmation → node proposal → node-level human/AI/Skill choices → graph editing → one sandbox run.
- Public upstream Skill supply is real, but upstream English names/descriptions are passed too directly into the Chinese product. The catalog and brief require a Chinese presentation layer with source-language preservation and an explicit “machine translated / creator verified” state.
- The current dark grid and mint glow establish a technical tone, but the page reads as a static operations console. The next visual pass must improve semantic type hierarchy, density, contrast, progressive disclosure, interaction motion and warm artifact surfaces rather than adding more glow or decorative gradients.
- Creator submission/claim, author workspace, release/version management, testing, analytics and revenue controls remain future work. The current Beta is free, but authorship and internal license/commercial-review classification must stay in the data model.
- The 18-table platform schema already includes Skill ownership, immutable releases, PersonalConfigurations, SkillForks, WorkflowVersions, Runs, RunSteps, Artifacts, Approvals and AuditEvents. It does not yet include a complete creator submission/claim/review queue, creator profile, evaluation dashboard, download/adoption analytics or payout ledger, so creator readiness is “foundation only,” not a hidden finished backend.
- Current official-product references reinforce three transferable patterns: Raycast exposes focused extensions through search, category filters, details, screenshots, author information and instant install, while its AI surface lets users invoke and chain tools in natural-language chat with explicit approvals; Linear’s 2026 UI refresh deliberately made headers/navigation consistent and sidebars dimmer so primary content scans faster; Lovable combines conversational iteration with direct visual editing instead of forcing users to choose one mode. These are interaction principles, not a visual template to copy.
- The current CSS has systematic sub-readable text in business-critical areas: several node/status/detail styles are 6–10 px, Skill card titles are 11 px, and many explanatory lines are 8 px. This directly explains the user’s “不匀称、内容太小” judgment; it is not a device-specific rendering anomaly.
- A whitespace-tolerant mechanical audit found 198 explicit pixel `font-size` declarations in `app/globals.css`; 155 are below 12 px, 117 are below 10 px, and 142 are 10 px or smaller. This is source-code evidence, not a usability-study metric, but it establishes that tiny typography is systemic and requires tokenization/refactoring rather than isolated fixes.
- The workflow diagnosis and execution flows are currently conflated. The deployed experience uses a free-form home input only as a preface to three fixed multiple-choice questions, while the real model-backed `InterviewRunner` analyzes interview material for PRD production. A user-facing work-discovery conversation, adaptive clarification loop, editable Task Contract and graph generated from that contract are still absent.
- Natural-language personalization in Outcome Lens is a scripted visual state (`adjustment` → hard-coded Diff → local `v2` toast). It does not currently call a model, generate a semantic Diff from the user’s request, persist a Personal Overlay/Fork, or re-run the changed Skill. It must be classified as interaction prototype, not working personalization.
- The correct node model must separate two decisions: execution mode (`human`, `AI assist`, `AI draft + human approval`, `deterministic/connector`) and implementation (`zero/one/multiple SkillRelease`). A graph is only sandbox-ready after both are explicitly resolved and version-pinned.
- Sandboxing should be a no-side-effect rehearsal with a visible preflight, node-level status, approval gates, partial-success recovery and a real Artifact. The existing seven-node allowlisted runtime is a strong adapter foundation, but it is not yet connected to arbitrary diagnosis-generated workflows or online model credentials.

## OpenAgentSkill Compatibility Decision
- Copy functional mechanisms, not the brand, text, visual assets, proprietary ranking formula, or private implementation.
- Treat OpenAgentSkill as a source-attributed public upstream Registry. A listing is real supply, but it is not automatically a locally reviewed or hosted-runnable Skill.
- Functional parity is grouped into three states: implemented now (search/detail/trust/compare/install handoff/Agent-shaped APIs), contract/endpoint ready but UI incomplete (resolve/packs), and still pending (rankings/outcomes/submission/claim/creator profiles/text API). This distinction prevents another broad-looking but hollow release.
- Our durable differentiation remains downstream of discovery: workflow decomposition, node-level AI suitability, Skill combinations, human approval, personalization/Fork, controlled runs, traceable artifacts, and verified outcomes.

## 2026-08-23 Gate A Findings
- Registry localization must be a decision layer, not a destructive translation layer. The stable contract keeps every upstream identity and source field canonical and adds locale-specific fields with provenance; this lets the Chinese UI evolve without breaking installation, attribution or later source refreshes.
- A missing capability fact is product information. Showing “upstream did not provide this” is more useful than a plausible generic input/output because it tells the user exactly what must be verified before adopting a Skill.
- Explicit selected-Skill identity outranks keyword routing. Slug/source identity is now resolved before built-in template keywords, so a Skill named “PRD Reviewer” cannot accidentally become the internal interview-to-PRD workflow.
- A workflow diagram is a projection of one plan, not a second source of truth. Route canvas, node audit, explanation and CTA now all read the same `workflowPlan`.
- “Advanced” visual quality came from fewer decorative layers and clearer decision hierarchy, not more glow. Live checks show the redesign can preserve dense technical information while keeping all decision text readable.
- Browser QA found a state-transition bug that static tests missed: switching from a deeply scrolled Registry detail to a workflow kept the old scroll offset. Stage changes now reset to the top; this is included in Gate A verification.
- “中文字段存在”不等于中文化完成。真实样本证明分类级通用文案会把学术研究、近期研究、搜索基础设施、计划压力测试和舆情分析错误合并；Gate A 因此采用“上游中文 → 人工规则覆盖 → 结构化语义 → 确定性分类 → 明确缺失”的证据优先顺序，并用真实噪声快照锁定语义。
- Canonical 与 presentation 的边界不仅适用于 description，也适用于 tags：上游 tags 必须全量保留，展示层再自行限制数量。任何源事实截断都不能被称为 canonical exact。
- 响应式图不是把桌面流程图缩小。390 px 下横向节点虽没有造成 document-level overflow，仍会被容器裁切；移动端必须把 source、Skill、output 转为纵向信息流并保留完整可读文本。
