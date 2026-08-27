# Task Plan: Skillflow Production Build

## Goal
Build a China-first, production-capable Skill marketplace and workbench for internet product and operations users. The acceptance bar is no longer a visual prototype: users must be able to discover real upstream Skills, inspect evidence and install handoffs, place Skills into a diagnosed workflow, run an allowlisted golden workflow against real user material, approve intermediate results, and download a real artifact.

## Current Phase
Gate D — provider-neutral sandbox runtime is code-complete, independently audited and privately deployed as Sites version 9; live-provider acceptance remains gated on server-side production Secrets

## Phases

### Phase 0: Contract Freeze
- [x] Preserve all previously confirmed product and visual decisions
- [x] Audit product, platform, and UX for irreversible gaps
- [x] Freeze hosted execution boundary
- [x] Freeze model and data-region boundary
- [x] Freeze first connector read/write boundary
- **Status:** complete

### Phase 1: Canonical Model and Platform Foundation
- [x] Define Account, Personal Workspace, Registry, SkillRelease, WorkflowVersion, Node, Artifact, Run, Approval, and Audit schemas
- [x] Define canonical Skill manifest, permission taxonomy, evidence levels, and adapter boundary
- [x] Establish production API boundary separate from the Sites prototype
- **Status:** complete

### Phase 2: Controlled Runtime and Golden Workflows
- [ ] Build a controlled task runner, server-side Model Gateway, Tool Broker, file sandbox, receipts, retry, and partial-success handling
- [ ] Implement official-sample run and private-user run modes
- [ ] Make the first golden workflow genuinely usable: `.txt`/`.md` or pasted interview material → evidence extraction → insight clustering → human approval → PRD generation → deterministic quality check → Markdown download
- [ ] Expose the real Skill instructions, model/provider, token usage, timings, warnings, and run receipt; never represent canned output as a completed run
- [ ] Implement the remaining two golden workflows with fixed evaluation sets only after the first path passes end-to-end acceptance
- **Status:** in_progress

### Phase 3: Registry, Import, and Connectors
- [ ] Add an OpenAgentSkill-compatible upstream registry adapter so the product has real public supply immediately while preserving source attribution
- [ ] Implement task resolve, search/filter, full Skill detail, trust/safety profile, compare, packs, rankings, install handoff, machine-readable manifest, creator submission/claim state, and outcome feedback
- [ ] Implement internal license classification, immutable releases, evidence attestations, and compatibility adapters; upstream indexing does not equal local review or runtime approval
- [ ] Implement file/URL inputs and Feishu connector to the frozen capability boundary
- [ ] Implement Jira Cloud connector only if included in the frozen MVP boundary
- **Status:** pending

### Phase 4: Product Experience Integration
- [ ] Convert the current prototype state into persisted production states
- [ ] Add a cached Chinese presentation/search layer for imported Skills while preserving original names, authorship, repositories, licenses, and source-language fields
- [x] Build dual entry: single Skill and AI workflow diagnosis
- [x] Replace the fixed three-question wizard with free-form multi-turn diagnosis, adaptive clarification, editable Task Contract, explicit assumptions, and a workflow graph generated from the confirmed contract
- [ ] Build Workflow Lab, Node Inspector, Skill comparison, Outcome Lens, structured Diff, Command Home, and Artifact views
- [ ] Make each node editable across two independent dimensions: human/AI execution mode and zero/one/multiple pinned SkillRelease implementations; connect node search, comparison, replacement, split/merge, ordering, and approval points to one WorkflowRevision
- [ ] Cover empty, denied, expired, partial-success, outcome-unknown, outdated, and risk states
- [ ] Preserve the OpenAgentSkill functional loop (discover → inspect → compare → install/enable → report outcome) while extending it with workflow diagnosis, node-level AI decisions, personalization Diff, controlled execution, and artifacts
- [ ] Replace all scripted success/save/version/dashboard claims with persisted backend-driven states; no UI may say “saved”, “run succeeded”, or “personal version” from local demo state alone
- [ ] Apply the Precision Intelligence design system: Chinese-capable self-hosted type, semantic type/spacing/color/motion tokens, no decision text below 12px, and a desktop conversation–graph–inspector studio layout
- **Status:** pending

### Phase 5: Evaluation, Security, and Verification
- [ ] Add structural workflow validation, permission regression, Skill/model regression tests, and abuse limits
- [ ] Verify zero hallucinated Skills/connectors and zero unapproved high-risk actions
- [ ] Measure Verified Task Completion for all golden paths
- **Status:** pending

### Phase 6: Private Beta Delivery
- [ ] Deploy production MVP privately
- [ ] Seed verified product/operations Skills and examples
- [ ] Document operator controls, import/licensing review, and iteration backlog
- **Status:** pending

## Decisions Made
| Decision | Rationale |
|---|---|
| Product is AI Skill store + workbench | User confirmed both discovery and ongoing execution are core |
| China-first; product/operations first, finance later | Avoids shallow cross-industry coverage |
| Direct single-Skill and AI workflow paths coexist | Users who know the needed Skill should not be forced through diagnosis |
| Workflow recommendations are node-level and evidence-based | Avoids decorative AI-generated flowcharts |
| Natural-language personalization produces structured Diff and versions | Preserves authorship, permissions, rollback, and trust |
| Beta is free; licensing classification remains internal | User deferred pricing and wants commercial-author communication handled separately |
| Raycast-inspired command-first interaction and persistent product window | Visual and interaction direction confirmed through the working demo |
| MVP does not execute arbitrary third-party scripts | Keeps hosted execution limited to instruction-only, built-in, and allowlisted capabilities |
| External/global models and cross-border processing are allowed | User explicitly prioritizes access to external models over mainland-only residency |
| Feishu CN limited read plus confirmed document creation; Jira Cloud later read-only | Provides a useful end-to-end loop without overwrite, delete, private deployment, or silent external actions |
| OpenAgentSkill is an upstream-compatible supply source, not a brand/template to clone | Copy the public product mechanisms and API-shaped capability while keeping source attribution, independent visual identity, local review state, and our own workflow/runtime layer |

## Errors Encountered
| Error | Resolution |
|---|---|
| `init-session.sh` was not executable when called directly | Ran the script explicitly through `sh`; planning files were created successfully |
| Local preview could not bind its inspector port in the sandbox | Restarted the existing dev command with the approved local-preview permission |
| Lint rejected a test variable named `module` | Renamed it to `workerBundle`; lint and all tests then passed |
| Product/visual audit could not inspect the stopped localhost preview and the private URL timed out | Used the user-supplied full-resolution screenshot, current source, tests, deployment records and official product references; did not claim a fresh live walkthrough |
| One audit-note patch missed the exact markdown context | Re-read the local section and applied a narrower verified patch |
| Sites capability references were first resolved from the plugin `skills/references` directory | Used the filesystem-discovered `skills/sites-building/references` paths and continued; no product files were affected |
| First Gate D lint pass found six unused/effect-state errors | Removed unused imports and eliminated synchronous effect state writes; rerun required |
| A combined delete-and-add patch for `InterviewRunner.tsx` was rejected by `apply_patch` | Deleted and re-added the file in two safe patch operations |
| First multi-model lint pass found an unused `emptyUsage` helper | Removed the unused helper; no runtime behavior depended on it |
| Multi-model local smoke expected the legacy generic 502 for a mocked upstream 400 | Updated the smoke to the new non-fallbackable configuration-error contract (503); canary redaction behavior was unchanged |
| First multi-model Red Team rerun was interrupted by the sub-agent account usage limit | Preserved the hard-gate policy and dispatched a fresh independent read-only Red Team instead of treating test success as audit success |

## Audit-Driven Delivery Gates (2026-08-22)
1. **Gate A — honest Chinese marketplace (complete, user approved):** Registry identity routing, canonical/Chinese presentation separation, truthful states, blocked-Skill enforcement, responsive typography and private Sites version 5 all passed Red Team review.
2. **Gate B — AI work discovery (complete, user approved, privately deployed as Sites version 6):** free-form conversation, adaptive clarification, editable and traceable Task Contract, explicit confirmation, and abstract work nodes generated only from the confirmed contract. Final independent Red Team review passed B1–B8 with no P0/P1 blockers; lint, production build, full 39/39 tests and 390/1440 real-browser checks passed.
3. **Gate C — editable Skill composition (complete, user approved, privately deployed as Sites version 7):** confirmed Gate B handoff or Registry single-Skill entry, node-level execution mode, authoritative Release pins, task-fit recommendations, zero/one/ordered-multiple Skill composition, permission review, semantic Diff and immutable session-only WorkflowRevision. Final independent Red Team review passed C1–C8 with no P0/P1 blockers; production build, full 60/60 tests, lint/diff-check and 390/720/1024/1440 real-browser checks passed.
4. **Gate D — one genuine sandbox loop (multi-model Sites version 9 privately deployed):** preflight, allowlisted seven-stage run, editable/versioned approval, partial-failure handling, real Artifact/quality receipt, persistence, retry/cancel and reopen from Command Home. The provider-neutral OpenAI, DeepSeek and Anthropic extension passed 80/80 tests, lint, production build, extended D1/R2 smoke and independent Red Team review with P0=0/P1=0, then deployed from exact source commit `bb851191c76db878d1bcfed3c127d020819b183c`. Hosted live-provider acceptance still requires real server-side Secrets and one successful canary per provider claimed active.
5. **Gate E — creator foundation:** submit/import/create draft, source/license/safety review, E1/E2 evaluation, immutable release and claim; analytics and one-time paid distribution remain post-traffic work.

## Gate B Acceptance Contract (Red Team hard gates)

1. Natural-language messages are the primary input. The next question is selected from the highest-value information gap, not a fixed index, option list or round count; a rich answer can fill multiple facts and “unknown” is valid.
2. Every fact separates `user_confirmed`, `system_inferred`, `unknown` and `conflicted`, keeps message/quote provenance, and rejects any quote that is not a literal substring of the corresponding user message.
3. The editable fact model covers the task goal, current steps, inputs/systems, output/audience, acceptance, frequency/volume/time, tools, human approval, exceptions and sensitive data as relevant. The Task Contract is a projection of these facts, never a second truth source.
4. Readiness is computed server-side. No critical missing/conflict may remain, and the user must explicitly confirm the summary; a forced early draft stays `unconfirmed_draft` and cannot claim to be runnable.
5. Gate B may output only abstract work nodes with fact references, AI suitability, human/AI responsibilities and risk. Specific SkillRelease binding, execution, persistence and versions belong to Gates C/D.
6. Unconfigured model, timeout, malformed schema, fabricated quote, prompt injection and oversized input fail honestly. No deterministic questionnaire may impersonate AI. Raw user messages remain local session data and are rendered as text.
7. Before the first send, the UI discloses external-model/cross-border processing, excludes files/connectors from diagnosis, warns against secrets/sensitive personal data, and offers a truthful current-session clear action. Keyboard, IME, aria-live and 390 px layouts are required.
8. Acceptance requires golden conversations, failure/abuse tests, edit invalidation, confirmation eligibility, Gate C boundary assertions, real browser keyboard/mobile checks, lint/build/diff-check and a final independent Red Team PASS.

## Gate C Acceptance Contract (Red Team hard gates)

1. Diagnosed composition must bootstrap only from a confirmed Gate B snapshot, confirmed Task Contract and matching AbstractWorkflow. The first revision preserves the contract/fact digests, source node IDs, source fact IDs and boundaries; it never rebuilds the task from a goal keyword.
2. Execution mode and Skill implementation are independent decisions. Human-only and deterministic nodes may use zero Skills; AI modes without an eligible binding remain unconfigured; high-risk approval or external-action nodes cannot become unattended automation.
3. Every binding is resolved authoritatively on the server. A Release Pin preserves provider, canonical identity, author/source/license, permission and compatibility facts plus an immutable runtime/source release or a normalized Manifest snapshot digest. Snapshot-only pins never pretend to be author versions or hosted runtime releases; blocked Skills cannot be candidates or bindings.
4. Node recommendations separate current-task fit from Registry quality/trust/safety signals. Deterministic hard constraints filter first; evidence-backed assessment then explains fit, non-fit, unknowns and why a primary candidate ranks above at most two alternatives. Model ranking may only reference a server candidate allowlist.
5. Zero, one and multiple Skills are all valid outcomes. Multi-Skill MVP is a strict in-node sequence with explicit roles and continuous order; adjacent input/output compatibility, duplicate responsibility, permission union, side effects and fallback must be validated. Unknown compatibility is unresolved, not compatible.
6. Direct controls may create a revision immediately; natural-language correction creates a structured proposal and preview Diff before application. Personalization modifies node constraints/configuration, never upstream authorship, license or source implementation. Requests for core implementation or permission expansion become an unresolved variant requirement.
7. Every mutation produces an immutable session-only WorkflowRevision with parent, contract digest, graph/content digest, semantic Diff and validation. Old revisions never change; undo creates a new inverse revision; stale parents and client-forged Diffs are rejected. UI must say “current-session revision · not saved”.
8. Gate C never installs, executes, authorizes connectors, creates Artifacts, claims results, or persists a workspace version. Registry/model/network/release failures preserve the current revision and offer retry/manual/human paths. Acceptance requires responsive 390/720/1024/1440 behavior, keyboard/IME/focus checks, failure/abuse tests, full lint/build/diff-check and final independent Red Team PASS with no P0/P1.

### Gate C Frozen Boundaries
- OpenAgentSkill entries without a trustworthy author version/commit may be bound only as `manifest_snapshot` pins. Their digest proves the observed metadata snapshot, not source code immutability or hosted executability.
- Gate C revisions are immutable but session-only. D1 persistence, reopen across refresh/devices and conversion to `workflow_versions` belong to Gate D.
- Multiple Skills are limited to a linear ordered sequence inside one business node. Branches, parallelism, loops and arbitrary graph authoring are outside this Gate.

## Gate D Acceptance Contract (frozen implementation target)

1. The only private-data golden path in this Gate is product/operations interview material to reviewable PRD. It accepts pasted text and bounded `.txt`/`.md` copies, uses the allowlisted built-in runtime, and never executes arbitrary upstream or user-supplied code.
2. A run starts only from a persisted, validated WorkflowVersion derived from a Gate C revision. Preflight freezes exact node configuration and SkillRelease/manifest snapshot pins, validates input, permissions, model availability and run limits, and discloses external-model processing before dispatch.
3. Runs and steps use backend-owned states: `queued`, `running`, `awaiting_approval`, `succeeded`, `partial_failed`, `failed`, and `cancelled`. UI progress must be derived from persisted state/receipts; timers or canned output cannot impersonate execution.
4. Evidence extraction must preserve literal source traceability. Users can edit, reject or add evidence/themes at the approval gate; approval is explicit, immutable and tied to the exact run payload. Editing approved upstream material creates a new approval/revision and invalidates downstream output.
5. The final Artifact is a real Markdown PRD plus deterministic quality report and node-level receipt. A completed claim requires persisted artifact metadata, model/provider/token/timing facts when available, warnings and exact run/workflow/release provenance.
6. Refresh/reopen must restore the persisted workflow, run, current approval state, completed steps, artifacts and failures through Command Home. Retry creates an auditable new attempt and cannot silently overwrite a previous receipt.
7. Missing model configuration, timeout, malformed model output, unsupported/oversized input, stale approval, persistence failure, cancellation and partial failure must fail honestly while preserving already committed data and offering a bounded retry/resume path.
8. Gate D acceptance requires D1 migration review, API/auth/access-control tests, runtime and idempotency tests, responsive/keyboard/IME browser checks, lint/build/diff-check, a true end-to-end run with server-side model configuration, and independent Red Team PASS with no P0/P1 blockers. Without hosted model credentials, implementation may be code-complete but Gate D cannot be reported as production-run complete.

### Gate D Frozen Boundaries
- No arbitrary third-party scripts, connector writes, scheduled runs, payments, creator publishing, branches/loops or general-purpose graph execution.
- The built-in interview-to-PRD runtime is the first execution adapter; the architecture must permit later allowlisted adapters without claiming they are already executable.
- Anonymous/sample exploration may remain session-only, but private material, saving and real runs require authenticated Personal Workspace identity.
- D1 is authoritative for workflow/run/approval/receipt metadata; R2 stores uploaded copies and Artifact bodies where appropriate. Browser storage is not evidence of persistence.

### Gate D Multi-Model Extension (2026-08-26)
- One server-only gateway must expose a provider-neutral structured-response contract to all Gate B/D business code; provider-specific authentication, URL, request/response shape and errors stay inside adapters.
- MVP providers are OpenAI Responses API, DeepSeek Responses API and Anthropic Messages API. No browser-visible API keys, arbitrary user-supplied base URLs or silent provider switching.
- Routing is explicit and auditable: a server policy selects a configured provider/model by task class and allowed fallback order; every receipt records the actual provider, model, upstream request ID, usage, duration and fallback reason.
- A fallback may occur only for bounded transient/unavailable failures and must never hide invalid structured output, policy rejection, authentication/configuration failure or user cancellation. The final UI must disclose which provider actually processed the data.
- Provider configuration is validated without exposing secret values. A missing provider fails honestly and does not make the product claim multi-model readiness.
- Acceptance requires official-contract fixtures for all three providers, provider-specific error/redaction tests, fallback and no-fallback tests, full existing Gate B/D regression, production build, independent Red Team PASS and at least one hosted real-provider run for every provider claimed active.

### Gate D Schema and API Plan (frozen before code changes)
- `workflow_versions` stores separate immutable Gate C composition and compiled runtime-plan snapshots plus adapter ID/version/digest; node Skill order and full Release Pins remain inside the validated snapshot for this Gate.
- `runs` is the single aggregate root and gains request/preflight digests, state version, lease, cancellation, adapter provenance and updated time. The only terminal success is backed by a committed Artifact; quality-blocked output is `partial_failed`.
- `run_steps` stores stable step key, attempt, exact Skill pin/digests, per-step input/output digests, model receipt, lease and update time. Attempts append; old receipts are never overwritten.
- `approvals` stores immutable upstream/payload digests, revision and optional supersession. It is decided by the server-derived account and consumed only by the same workspace-scoped Run.
- `artifacts` adds a pending/ready/failed/deleted commit state. Bytes are written to an opaque server-generated R2 key and verified before D1 exposes `ready` metadata.
- API sequence: authenticated composition save → authenticated preflight/create queued Run → one-step CAS `advance` calls → immutable approval → further `advance` calls → workspace-scoped Run reopen/history and authenticated Artifact download. Every mutation rejects foreign Origin when present and never accepts client workspace/storage identity.
- Execution eligibility is an explicit `internet_product_interview_v1` compiler. Ordinary Gate C revisions, OpenAgentSkill snapshots and install-handoff bindings return `WORKFLOW_NOT_EXECUTABLE`; the server never silently substitutes the fixed runtime for an unrelated composition.
