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
- The current local build now has a real public Registry adapter and a real provider-neutral model-runtime implementation. Search/detail/compare/install-handoff are usable without a model key. The seven-node private workflow requires at least one verified OpenAI, DeepSeek or Anthropic server-side key/model pair and refuses fake output when no valid runtime route is configured.
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

## 2026-08-25 Gate D Start Findings
- Gate C is approved and privately deployed as Sites version 7 from exact commit `76e82d6c4439d5bb7214194f24fa92d40234bb6d`; the Site remains owner-only with no external visitors or groups.
- Gate D must connect three foundations that already exist but are not yet one truthful loop: Gate C session-only WorkflowRevision, the allowlisted interview runtime, and the D1/R2 platform schema. The risk is not missing UI; it is duplicate sources of truth and scripted state between these layers.
- The first real sandbox is deliberately a controlled workflow runner rather than an untrusted-code VM. Success means a private user input produces evidence-backed, approved, persisted output with a receipt and reopen path.
- Hosted model credentials are an acceptance dependency, not a development shortcut. Missing credentials must remain an honest 503 state; a true production run cannot be claimed until a server-side secret is configured and exercised.
- Sites capability guidance confirms the storage split: D1 owns relational workflow/run/approval/receipt and file metadata; R2 owns uploaded copies and generated Artifact bytes. Browser storage may hold only non-authoritative UI preferences.
- Every authenticated API mutation must resolve the platform user server-side from ChatGPT/Sites headers; client-provided workspace or owner IDs are untrusted. Protected identity-dependent rendering must remain request-dynamic in Vinext.
- D1 access should stay behind a narrow helper and use one prepared statement per query; multi-statement operations use `batch`. Schema changes require an inspected Drizzle migration and query-driven indexes, followed by representative query-plan verification where useful.
- The existing 18-table schema already has the right nouns (`workflow_versions`, `workflow_nodes`, `runs`, `run_steps`, `artifacts`, `approvals`, `audit_events`) and workspace-scoped indexes, so Gate D should extend and operationalize it instead of creating a parallel persistence model.
- Existing run enums use `waiting_approval` and omit `partial_failed`; the frozen Gate D product contract uses `awaiting_approval`/`partial_failed`. This is a schema/API compatibility decision that must be resolved consistently through migration and tests rather than translated ad hoc in the UI.
- Existing approvals store action payload but no explicit immutable payload digest/version, creating approval-replay and stale-decision risk. Runs also lack updated/revision/lease fields needed for safe cancellation, resume and concurrent dispatch.
- Drizzle migrations live under `drizzle/`, not `migrations/`; the initial file is `drizzle/0000_bent_millenium_guard.sql`.
- Authentication and Personal Workspace bootstrap already derive stable account/workspace identity from server headers. Gate D API handlers must call those helpers and scope every read/write by the returned workspace; no new auth stack is needed.
- The current runtime APIs are stateless two-call endpoints: `/analyze` returns all analysis in one response and `/prd` accepts client-returned evidence/themes, creates a second unrelated run ID, and fabricates a successful human-gate receipt from submission alone. This is the central Gate D truthfulness defect.
- The current `InterviewRunner` keeps analysis, checkbox approvals and PRD only in React state; upload bytes are read in the browser and neither input nor result is persisted. The dashboard is an explicit honest empty state, so it can become the Command Home without removing fake content.
- Gate C currently has no persistence CTA or parent callback: CompositionStudio retains its immutable revisions in component state and explicitly says “未保存 · 未运行”. Gate D needs one server-side save/preflight boundary that accepts the authoritative revision and returns a persisted WorkflowVersion ID before the runner can start.
- The existing runtime has strong reusable safeguards: transcript limits, normalization, strict structured outputs, literal quote validation, allowed Skill slug checks, prompt-injection framing, deterministic PRD quality checks and actual model receipts. Gate D should orchestrate these steps durably rather than rewrite the 1,457-line Skill implementation.
- The only existing persistence API is Personal Workspace bootstrap; no run, approval, artifact, upload or history API exists yet.
- Product audit estimates the existing runtime algorithm at roughly 60–70% but the durable Gate D user loop at 0% under the decisive reopen-after-refresh criterion. Gate C, runner, D1/R2 and Command Home are four disconnected surfaces.
- Red Team P0: `stableId()` currently uses lossy replacement/truncation, so distinct platform IDs can collide and overwrite account identity. Account/workspace IDs must use a cryptographic digest of the original platform user ID before any private persistence route ships.
- Red Team P0: all object routes require server-derived workspace scoping in the same query and must return non-enumerating 404 for cross-workspace workflow/run/approval/artifact IDs. Client workspace IDs and storage keys are never authorization inputs.
- Red Team P0: idempotency needs request digest plus atomic state/revision/lease claims; cancellation must prevent a late worker from overwriting `cancelled`. Approval needs exact payload digest/revision/expiry and cannot be replayed after edits.
- Red Team P0: only exact built-in allowlisted adapter releases may run. Valid Gate C `manifest_snapshot` or `install_handoff_only` bindings remain non-executable. The run freezes adapter ID/version/code digest and every Release Pin.
- Red Team P0: D1 metadata and R2 bytes require a pending→committed protocol, opaque server-generated keys, digest/size verification and orphan handling. No Artifact or run success is visible before both sides commit.
- Red Team P1 tests must cover upload actual bytes/UTF-8/NUL/name abuse, model timeout/malformed output, prompt injection, quote grounding, Markdown/raw-HTML neutralization, partial failure/retry, approval replay/expiry, CSRF/origin, refresh and four responsive sizes.
- D1 foreign-key direction matters in the D1/R2 commit protocol: an Artifact cannot be inserted before the Run it references. The corrected protocol creates a `provisioning` aggregate, writes and verifies R2 bytes, then batches the Artifact reference and initial step rows before exposing `queued`.
- A random idempotency key per button click only protects one HTTP request, not a lost-response retry. The runner now retains one key across retries until the server returns the created/replayed Run.
- Approval and step output need two independent protections: immutable content digests stop stale semantic decisions, while decision/lease tokens decide which concurrent request owns the state transition. Either mechanism alone is insufficient.
- Official OpenAI Responses documentation confirms the existing structured-output request shape uses `text.format.type=json_schema`, and the current gateway keeps `store:false`; the browser receives only configuration state, never the API key or model request.
- Gate C's session `revisionNumber` describes mutations inside one browser session, not a globally unique permanent WorkflowVersion. The database version must be assigned under the Workflow aggregate; the persisted graph identity must include the exact runtime plan or a Release/adapter change can be hidden behind the same business graph digest.
- D1's per-statement bind-variable limit can be reached surprisingly early by wide multi-row inserts. `batch` is the atomicity boundary, but each statement inside it still needs bounded row chunks.
- A deterministic local model fixture is valuable only when its status is explicit: it can verify schema handling, quote grounding, retries and state transitions, but it is not evidence of real model quality, latency or production readiness.
- Approval revision continuity needs both UX hydration and semantic freshness. Vn+1 now points to Vn's committed `approved_analysis`, gets a distinct digest that an old page cannot replay, and initializes the editor from prior accept/reject/interpretation/evidence/theme choices.
- Gate C can keep mutation sessions ephemeral while Gate D persistence remains cross-isolate reliable. The persistence boundary rechecks the entire self-contained envelope, derived nodes, authoritative Releases and the exact fixed-Pack compiler without requiring the originating in-memory session; ordinary Gate C mutations still require session head/token ownership.
- `maxActiveRuns` means unfinished tasks, not tasks younger than one day. Active quota claims therefore remain until success/final partial/cancel or explicit recovery; hourly rate claims retain bounded expiry.
- Browser source-size assertions missed a touch ergonomics defect that computed layout caught. A control can have 14px text and still expose a 32px target; mobile acceptance therefore needs both typographic and hit-area checks.
- Gate D fault injection found a real provisioning-recovery bug: a Drizzle `returning()` row was destructured and then incorrectly checked as an array, leaving stale runs blocked after a successful claim. The fix preserves the executable stale-provisioning regression in the local smoke suite.
- “Three active runs” must include reopening a terminal run for a new approval revision, not merely fresh Run creation. A unique `(run_id, scope)` quota claim plus an active-slot claim before reopen closes that semantic bypass and serializes concurrent reopen requests.
- A passing deterministic contract-model smoke proves orchestration, schemas, grounding, persistence and failure recovery; it does not prove hosted model quality, latency or production availability. Gate D must retain the frozen distinction between implementation-complete and production-run-complete.
# 2026-08-26 Multi-Model Gateway Findings

- The current product has one `lib/openai-responses.ts` gateway already shared by Gate B diagnosis, Gate C natural-language composition and all four model-backed stages of the Gate D interview-to-PRD runtime. Replacing this boundary can add providers without rewriting business validators.
- The persisted receipt shape already stores `model_provider`, `model_name`, request ID, timing and token usage in run-step data, but its TypeScript contract currently hard-codes `provider: "openai"`; this must become an explicit provider union and preserve the actual provider selected after any fallback.
- DeepSeek's current official API supports an OpenAI-shaped `/responses` endpoint with JSON Schema structured output, but that endpoint currently supports a narrower model set than its chat endpoint. The adapter must not assume every configured DeepSeek model supports `/responses`; MVP should use the documented Responses-capable model or reject incompatible configuration before execution.
- DeepSeek's official JSON-mode documentation warns that chat JSON output can occasionally be empty. Because Skillflow requires schema-grounded workflow facts and evidence, using prompt-only JSON mode as a silent substitute is below the acceptance bar; the MVP adapter should use documented schema-constrained Responses output and keep empty/malformed output non-fallbackable.
- Anthropic's current official Claude Platform uses `POST /v1/messages`, `x-api-key`, `anthropic-version: 2023-06-01`, and JSON structured output under `output_config.format`. The old beta `output_format` shape is transitional and should not be used for new code.
- Anthropic structured outputs are model-capability dependent and compile/cache each schema. Configuration must choose a compatible model; a provider health check cannot prove every schema will compile, so each business call retains strict downstream semantic validation.
- Provider-level JSON Schema guarantees syntax/shape, not truth, source grounding or safe workflow decisions. Existing Gate B literal-quote/dependency checks and Gate D evidence/permission/approval validators remain authoritative after provider expansion.
- Conservative fallback boundary: retry/fallback only on timeout, connection failure, 429 and provider 5xx. Never fallback on missing/invalid credentials, unsupported model/schema, safety/policy refusal, truncated or malformed structured output, or a semantic validator rejection, because switching models would hide a deterministic product/configuration problem.
- A request attempt is not proof of data delivery. HTTP responses prove the provider received enough of the request to answer, while DNS/TLS/abort/timeout paths can leave delivery unknown; receipts must preserve that uncertainty instead of claiming `requestSent: true`.
- Fallback makes cost accounting intrinsically partial when a failed provider does not return usage. Skillflow therefore records the successful provider's reported Token use as confirmed usage and explicitly labels the aggregate partial; the operator must use provider invoices for the unknown portion.
- Provider-constrained JSON is only the first validation layer. If literal quote grounding, Skill allowlists or business semantics reject an otherwise successful provider response, the run still needs the provider/model/request/usage receipt because the call processed data and may be billed even though no product result is accepted.
- Cloudflare Worker bindings must reach deep server modules. Current Workers can populate `process.env` under Node compatibility, but the Worker entry also copies only the explicit model allowlist so Sites compatibility-date differences cannot silently turn a configured deployment into `MODEL_NOT_CONFIGURED`.
