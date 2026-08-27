# Progress Log

## Session: 2026-08-21

### Current Status
- **Phase:** 2–3 overlap — Controlled Runtime plus Real Registry Supply
- **State:** The shell-only acceptance failure has been corrected locally: real upstream Skill discovery works end to end, and the first model-backed golden workflow is implemented with a human approval gate and downloadable artifact. Production model execution remains intentionally disabled until server-side model credentials are provisioned.

### Actions Taken
- Built and published the high-fidelity Skillflow interactive prototype.
- Completed independent product, platform, and UX preflight audits.
- Consolidated irreversible decisions, safe defaults, implementation phases, and acceptance boundaries into persistent project planning files.
- Preserved the previously confirmed China-first, product/operations-first, free-Beta, dual-entry, workflow-node-decision, and Raycast-inspired interaction decisions.
- Recorded user confirmation that arbitrary third-party scripts are excluded, external models/cross-border processing are allowed, and the proposed connector boundary is accepted.
- Started parallel implementation of the D1 data schema, canonical Skill contract and seed manifests, and product/UI state contract.
- Implemented 18 D1/Drizzle tables and generated/validated the initial migration.
- Implemented Canonical Skill Contract 1.0, nine honest E0 product/operations manifests, and a public registry API that strips internal commercial-review metadata.
- Implemented controlled task compilation, structural workflow validation, system-boundary API, identity-aware Personal Workspace bootstrap, and D1/R2 hosting bindings.
- Added an interactive Node Audit panel to the existing Workflow Lab, including AI verdict, human responsibility, I/O contract, evidence level, permissions, and acceptance checks.
- Replaced placeholder 92% claims with E0/candidate language and clearly labeled prebuilt sample results.
- Published the Phase 1 foundation to the existing private Skillflow URL, including the Node Audit UI, controlled compiler APIs, Skill registry, and provisioned D1/R2 bindings.
- Audited the current public OpenAgentSkill product across homepage, directory, task catalog, packs, comparison, safety, submission, detail, install, outcome, and Agent API surfaces; converted the audit into an explicit compatibility/enhancement map.
- Added an upstream-compatible Registry adapter and live product UI for task search, real Skill cards, full trust/safety/permission evidence, author attribution, details, three-way comparison, install-command handoff, and placement into a workflow.
- Added a server-only OpenAI Responses API gateway with strict JSON Schema outputs, `store: false`, timeout/error mapping, and real provider/model/token receipts. API keys never enter client code or responses.
- Added one real seven-node product-manager workflow: deterministic normalization, evidence extraction, insight clustering, per-node AI-fit assessment, human theme approval, evidence-backed PRD generation, and deterministic PRD quality checks.
- Added a real `.txt`/`.md` and pasted-text runner UI. Without a server-side model configuration it refuses to show canned output; with configuration it exposes evidence, AI/human boundaries, approval, PRD, quality score, receipts, and Markdown download.

### Test Results
| Test | Expected | Actual | Status |
|---|---|---|---|
| Prototype production build | Successful Vinext production build | Build completed | pass |
| Prototype lint | No lint errors | Completed without errors | pass |
| Private Sites deployment | Online interaction demo available | Deployment succeeded | pass |
| Phase 1 lint | No lint errors across application, contracts, schema, manifests, and tests | Passed | pass |
| Phase 1 production build | All UI and API routes compile for Vinext/Workers | Passed; 5 API routes emitted | pass |
| Workflow behavior tests | Single-Skill path, controlled workflow path, high-risk approval boundary, and honest public registry evidence | 4/4 passed | pass |
| D1 migration | Creates all tables, indexes, and foreign keys in SQLite | Executed successfully in an in-memory SQLite database | pass |
| Real public Registry | Search current upstream supply, open details, inspect trust/safety/permissions and install handoff | Verified in the local browser against the live public API | pass |
| Model-runtime contract | No credentials means explicit refusal; structured model runs produce evidence, workflow assessment, PRD and real receipts | 4 runtime behavior tests plus schema/traceability checks passed | pass |
| Current full verification | Lint, Vinext/Workers build, and application tests | lint pass; build pass; 8/8 tests pass | pass |

### Errors
| Error | Resolution |
|---|---|
| Planning initializer lacked executable permission | Invoked via `sh` and completed successfully |
| Local dev server inspector bind was blocked by the sandbox | Restarted with approved preview permission |
| Starter test lint used reserved variable name | Renamed the variable and reran lint/tests successfully |
| Two agents initially created overlapping shallow and full workflow schemas | Made the seven-node runtime Skill definition the unique contract source and imported its instructions, schemas and validators into the server runtime |
| UI initially assumed the earlier shallow response field names | Aligned the runner with evidence/theme/workflow/PRD fields from the final canonical runtime contract |

## Session: 2026-08-22 — Product/UX Completeness Audit

### Current Status
- **Phase:** cross-phase acceptance audit before further implementation
- **State:** Auditing every user-promised capability against current code, deployed behavior and visual evidence. No product code is being changed in this review pass.

### Audit Focus
- Chinese localization for imported Skill briefs and catalog surfaces.
- First-principles typography, visual hierarchy, layout density and technology feel.
- Replacing the rigid workflow questionnaire with conversational diagnosis and editable node-level composition.
- One-run sandbox experience and honest runtime readiness.
- Creator-space gap and phased implementation plan.

### Errors
- The ambient localhost preview was not running (`ERR_CONNECTION_REFUSED`). A follow-up attempt to inspect the private deployed URL exceeded the browser session timeout, so this audit relies on the supplied full-resolution screenshot, current source code, tests and deployment records rather than claiming a fresh live visual walkthrough.

### Verification
- Re-ran the current production build and all application tests against commit `9d4cde4`: build passed and 8/8 tests passed. This verifies code paths and contracts, not visual quality, production model credentials, creator flow or end-user usability.

### Audit Result
- Three independent reviews (product acceptance, AI workflow UX, and visual/interaction design) converge on the same diagnosis: technical foundations are materially ahead of the user-facing journey. The current product is a high-fidelity demo with a real Registry and one real runtime implementation, not the complete MVP previously described.
- Acceptance estimates are explicitly audit judgments rather than user analytics: technical/product foundation roughly 50–60%, current user-facing functional loop roughly 25–35%, and the conversation-to-editable-workflow-to-sandbox-to-save loop roughly 15–30% depending on whether code-only runtime readiness is counted.
- Delivery gates A–E have been added to `task_plan.md`; no production code changed in this audit turn.

## Session: 2026-08-22 — Gate A Implementation

### Frozen Acceptance Boundary
- Chinese users can understand every Registry candidate’s function, category, task fit and important risk/permission meaning without depending on the English source description; original name, author, repository, license/source attribution and original description remain inspectable.
- Direct Skill discovery routes into the Registry, and selecting a real Skill creates a Skill-specific handoff instead of falling through to the weekly-report compiler.
- No UI claims a draft, run, personal version or recent artifact was saved or completed unless backed by a real persisted/run response.
- Business and decision text is readable and semantically tiered: no required reading below 12 px, buttons/inputs at least 14 px, Chinese/Latin font use is intentional, and state motion represents actual system activity.
- Gate A is independently challenged by Red Team and privately deployed for user approval; Gate B does not start without explicit confirmation.

### Implemented
- Split Registry identity from Chinese presentation: canonical `name/description/category/tags`, author, repository, license and source URLs remain upstream facts; `briefZh/categoryZh/tagsZh` plus localization source/confidence/review metadata form the Chinese decision layer.
- Added deterministic Chinese task-intent expansion, capability taxonomy, permission/status localization and conservative long-tail fallback. Missing structured use cases, limitations, inputs and outputs now say the upstream did not provide them instead of being invented in the UI.
- Fixed direct discovery so “match one Skill” opens the real Registry. A selected Registry Skill now carries explicit slug/name/source identity into the compiler and produces `needs_configuration`, never a weekly-report or interview fallback.
- Added a safe clarification state for unknown free-form tasks. The compiler no longer maps every unknown task to the weekly-report template.
- Replaced the two hard-coded route diagrams with one graph derived from the same `workflowPlan` used by the node audit and CTA. Registry candidates are explicitly marked “not hosted / not run” and link back to the original source.
- Removed unsupported saved-draft, saved-combination, personal-version, run-success and recent-history claims; the workspace is an honest empty state until persistence exists.
- Applied the Precision Intelligence visual system: unified Chinese-capable font stack, semantic size/color/spacing tokens, decision text at least 12 px, controls at least 14 px, reduced decorative motion and stronger hierarchy across Registry, workflow audit, runner, artifact and workspace.
- Added stage-change scroll restoration so a detail-page scroll position cannot crop the next workflow view.

### Verification
- `npm run lint`: passed.
- Production build plus full behavior suite: 22/22 passed.
- New behavior coverage includes 20 Registry categories preserving selected identity, unknown-task clarification, fake-state source assertions, unsafe source-link rejection, complete canonical tags, 10 hostile/incomplete localization fixtures, semantic golden sets for research/RAG/interview/datasets/search infrastructure/decision stress testing/public-opinion analysis, Chinese intent expansion and runtime anti-hallucination checks.
- Live browser verification against the real public Registry loaded 16 current candidates, opened Chinese detail plus original source/author links, and handed GPT Researcher into a Skill-specific `needs_configuration` plan without a weekly-report fallback or fabricated source/audience/frequency.
- Real-snapshot localization corrections include Academic Research Skills, Last30days, Interview Guide, Sioyek, ESearch, eight distinct search products, Grill Me/Grill With Docs and BettaFish; canonical source fields remain separate and unknown semantics fall back to “暂无可靠中文说明”.
- Computed layout checks at 1440, 1024 and 390 px found no horizontal overflow; visible reading text was at least 12 px and visible buttons/inputs at least 14 px. A real 390×844 regression exposed and then verified the fix for clipped horizontal workflow nodes by switching the route to a full-width vertical stack.

### Awaiting
- Red Team issued PASS after the final canonical-tags correction and kept PASS after the delta-only review of blocked-Skill hardening, runtime configuration honesty, command keyboard navigation and upstream raw-field minimization. No P0/P1 remains in Gate A.
- Private Sites publication of the exact validated commit, followed by user approval before Gate B. Gate B has not started.

## Session: 2026-08-25 — Gate B AI Work Discovery

### Implemented
- Replaced the fixed three-question wizard with a free-form multi-turn work interview. Direct-task entry pre-fills only the task the user explicitly typed, while discovery starts with an empty composer.
- Added a structured fact memory separating user-confirmed, system-inferred, unknown and conflicted facts. Every fact preserves message/quote provenance; fabricated quotes and invalid model schemas are rejected server-side.
- Added dependency-graph validation for inferred facts. A system inference can contribute to readiness only when its complete acyclic dependency closure ends in user-confirmed facts; unknown and conflicted facts cannot silently support confirmation.
- Added editable fact operations with dependent-inference invalidation and atomic conflict resolution. The Task Contract is deterministically projected from the current fact set and never maintained as a second truth source.
- Added server-side sufficiency and explicit-confirmation gates. Negative statements such as “我不确认” are rejected before positive-keyword matching; only a user-confirmed contract can generate abstract work nodes.
- Kept Gate B inside its product boundary: abstract nodes expose evidence references, initial AI suitability, human/AI responsibilities and risk, but do not bind a SkillRelease, execute a task, claim persistence or invent a version.
- Added pre-send disclosure for external-model and possible cross-border processing, sensitive-data warnings, truthful current-session clearing, request-size and sequence protection, retry/cancel behavior, IME-safe keyboard handling and accessible live/error states.

### Verification
- `git diff --check`, `npm run lint`, production build and the full test command passed serially; the combined suite is 39/39 PASS.
- Gate B tests cover rich/ambiguous/unknown/corrected conversations, quote grounding, invalid dependency graphs, conflict replacement, negative and premature confirmation, stale sequence, missing model, malformed output, prompt injection, oversized requests, UI boundaries and decision-text sizing.
- Real-browser checks passed at 390 and 1440 px with no horizontal overflow. The discovery entry starts blank, direct entry preserves the explicit task, the model-not-configured path retains the unsent text and offers retry without claiming AI analysis, and the fixed questionnaire is absent.
- Final independent Red Team review passed B1–B8 with no P0/P1 blockers. Remaining P2 ideas are risk-tiered sufficiency for very small tasks, side-by-side conflict evidence, full modal focus trapping and clearer “initial AI judgment” wording.

### Boundary Before Gate C
- The implementation is ready for user acceptance, but a deployed environment must have at least one verified OpenAI, DeepSeek or Anthropic server-side key/model pair and a valid task route before live inference can run. Without them, the intended honest 503/retry state is shown.
- Do not start concrete Skill recommendation, node binding, replacement, versioning or sandbox execution until the user approves Gate B and explicitly authorizes Gate C.

## Session: 2026-08-25 — Gate D Genuine Sandbox Loop

### Current Status
- **Phase:** Gate D contract freeze and architecture audit
- **State:** User approved Gate D implementation after Gate C passed independent Red Team review and was privately deployed as Sites version 7.

### Frozen Outcome
- One authenticated product/operations user can persist a Gate C composition, submit pasted or `.txt`/`.md` interview material, pass preflight, run the allowlisted interview-to-PRD workflow, approve evidence/themes, receive a real Markdown artifact and receipt, and reopen the run after refresh.
- No arbitrary third-party script execution, connector writes, fake progress, canned success or browser-local persistence claims are permitted.

### Actions Taken
- Re-read repository instructions, production decisions, prior gate contracts and the current runtime/persistence findings before code changes.
- Added the Gate D acceptance contract and frozen boundaries to the persistent project plan.
- Started independent product, persistence/runtime and Red Team baseline audits; subagents are read-only and cannot edit or deploy the Site.
- Product audit confirmed the runtime logic is reusable but the durable user loop is absent; it supplied the state-by-state UX acceptance matrix.
- Red Team baseline identified six P0 classes: identity collision, client-forged approval/evidence, object-level authorization, concurrent/idempotent execution, Release/adapter drift and D1/R2 split-brain. These are now implementation blockers, not backlog suggestions.

### Next
- Audit current schema, authentication, Gate C revision handoff, runtime APIs and runner UI; then publish the schema/API plan before implementation as required by repository instructions.

### Errors
- The Sites capability references were initially addressed under `skills/references`; filesystem discovery showed they live under `skills/sites-building/references`. Corrected the path without changing product code.
- The first repository file scan looked for a `migrations/` directory that does not exist. Drizzle migration files were found under `drizzle/`; no repeated scan of the wrong path.
- `apply_patch` does not allow delete and add operations for the same file in one patch. Replaced `InterviewRunner.tsx` with two explicit operations.
- The first Gate D lint pass reported unused imports and synchronous state writes inside effects. Removed those patterns before the next verification pass.
- A direct Miniflare harness against the generated production bundle could not parse Vinext's generated static JavaScript module shape. Switched to the supported `vinext dev` path rather than weakening the bundle or inventing a second runtime.
- The first local authenticated workspace request found an empty local D1 database. Stopped the dev process, applied the inspected `0000` and `0001` migrations to the exact local Miniflare database, then restarted; workspace bootstrap returned 201.

### Implemented Runtime Foundation
- Replaced the lossy account/workspace ID derivation with SHA-256 identities of the complete platform user ID. A live collision check using `a/b` and `a?b` now produces distinct private workspaces.
- Added persisted Gate C WorkflowVersions, a strict built-in interview adapter, one durable Run aggregate, seven step attempts, digest-bound approvals, D1 metadata plus R2 bytes, authenticated artifact download, cancellation, retry and Command Home reopen APIs.
- Removed the old stateless `/analyze` and `/prd` success paths with an explicit 410 contract so clients can no longer submit forged evidence or fabricate a human approval receipt.
- Corrected Run provisioning order: the non-runnable Run aggregate is now created before its input Artifact, then input metadata and all seven steps commit as a D1 batch. Duplicate submissions reuse one client-stable idempotency key and request digest.
- Added a decision token and batched approval transition so only the exact pending payload can advance the approval step and Run. Step completion now requires both the Run lease and step lease, and commits both relational states in one D1 batch after R2 digest verification.
- Sanitized generated Markdown fields against raw HTML and active URI schemes while keeping the source as a downloadable UTF-8 `.md` attachment.
- Generated and inspected `drizzle/0001_mute_rage.sql` and `drizzle/0002_overjoyed_night_nurse.sql`; current lint and production build pass.

### Gate D Verification So Far
- Full local HTTP contract smoke passed through Gate B handoff → Gate C native binding and permission acknowledgement → persisted WorkflowVersion → Run creation → seven step attempts → digest-bound approval → quality-reviewed Markdown Artifact → authenticated download → history/reopen.
- The passing real D1/R2 smoke produced Run `run_e077846a-1bd2-46fc-9ab4-97e12b43396f` with seven steps and Artifact `art_3fe2f81e-435f-46e0-9492-4681b4a83aad`. These IDs refer only to local Miniflare test data, not a production run.
- Negative smoke passed for exact idempotent replay, idempotency conflict, cross-workspace Run and Artifact 404, stale approval digest, approval replay, cancel followed by late advance, and malicious Markdown title/background neutralization.
- The local model was a deterministic schema-contract stub. It proves orchestration and validators, not model quality. It was removed after testing; the app was restarted without credentials and returned `configured:false` plus honest `MODEL_NOT_CONFIGURED` 503.
- Browser QA passed at 1440×900, 1024×768, 768×1024 and 390×844 with zero horizontal overflow, visible reading text ≥12px and control text ≥14px. A mobile touch-target audit found several 32–42px controls; the CSS now raises critical mobile controls to a 44px target and the delta was rechecked.
- Final serial verification is 65/65 tests PASS plus lint, production build and `git diff --check` PASS.

### Additional Errors Resolved
- The first permanent-version save reused Gate C's session-local revision number and collided across sessions. Persistent versions now use a server-generated monotonic `Vn`, while identity combines the composition graph and frozen runtime plan.
- The first Run provisioning batch inserted all seven wide step rows in one SQL statement and exceeded D1's variable limit. The same atomic batch now uses three bounded insert chunks.
- The first workflow-assessment contract stub emitted a non-allowlisted Skill slug. The runtime validator correctly failed the step and preserved partial state; the fixture was corrected and a new attempt recovered successfully.
- The first Gate D boundary-test draft imported identity routes in Node and reached the `cloudflare:` module scheme. Replaced that unsupported harness with source-boundary assertions; D1/R2 behavior remains covered by the real local HTTP smoke.
## 2026-08-26 Gate D Candidate

- Replaced the stateless analyze/PRD success paths with authenticated WorkflowVersion save, server-owned run/step states, immutable approvals, workspace-scoped artifacts and Command Home history/reopen.
- Compiled the one executable MVP adapter into seven exact pinned stages: normalization, evidence extraction, insight clustering, node-level AI/Skill assessment, human approval, PRD generation and deterministic quality review. Arbitrary third-party scripts and external writes remain disabled.
- Added D1 migrations for runtime state and atomic quota claims, including a unique run/scope claim so a completed run cannot bypass the three-active-run ceiling when approval is reopened.
- Added D1→R2 pending/verify/CAS commit semantics, literal quote grounding, bounded fatal-UTF8 requests, Markdown neutralization, provider-error redaction, hashed account identity and non-enumerating cross-workspace access control.
- Added approval expiry rotation, evidence/theme edits and additions, approval revision reopen, downstream supersession, lease expiry recovery, append-only retry attempts, cancellation guards, provisioning crash recovery and full quality-report receipt artifacts.
- Verification passed: lint, production build, 66/66 automated tests, migration-from-legacy test, diff check, 390 px browser layout check, and local HTTP/D1/R2 smoke covering idempotency, approval replay/expiry, identity collision, CSRF, invalid UTF-8, active quota, malformed-model retry, lease expiry, upstream-error canary redaction and stale provisioning recovery.
- Local development model credentials were removed and test processes stopped after verification. No commit, push or deployment was performed. Independent Red Team review and hosted real-model execution remain the two acceptance boundaries.
- Second Red Team delta fixed five P1s: manual-theme-only approval, cancellable interrupted provisioning, expiry inside the approval CAS, Vn approved-analysis hydration into Vn+1 with a distinct revision digest, and cross-isolate Gate D persistence validation without weakening Gate C mutation sessions. Active-run claims now persist until a terminal transition rather than expiring after 24 hours.
- Final verification after those fixes passed lint, production build, 67/67 automated tests, diff check and the extended local HTTP/D1/R2 smoke. The smoke additionally asserts prior human-added themes reopen, approval revision digests differ, and a provisioning Run can be cancelled after refresh-style state loss. Temporary mock credentials and both local processes were removed again.
- Final Red Team found one last quota-leak ordering issue; the implementation now validates the prior approved Artifact and computes the revision digest before claiming an active slot, with the claim immediately enclosed by exact-ID failure cleanup. A new executable smoke corrupts the approved Artifact reference, verifies reopen fails before claiming quota, then proves all three active slots remain available. The final independent delta verdict is P0=0, P1=0, code/local contract PASS. No commit, push or deployment has occurred; hosted real-model acceptance is still explicitly open.

## 2026-08-26 Gate D Multi-Model Extension

- User requested server-side model APIs beyond OpenAI, specifically DeepSeek and Claude/Anthropic.
- Froze a provider-neutral gateway boundary: explicit auditable routing, actual-provider receipts, conservative fallback, server-only secrets and no arbitrary third-party base URLs.
- Next: audit current gateway call sites and persistence contract, verify current official provider APIs, implement adapters and tests, run Red Team, then deploy only after the complete Gate D regression passes.
- Implemented one provider-neutral structured-response gateway for OpenAI Responses, DeepSeek Responses and Anthropic Messages. Task-class routes support an explicit primary/fallback order; unsupported or partial configurations fail before user material is sent.
- Cloudflare text/secret bindings are copied through an allowlist into the server runtime and covered by a compiled-Worker test. The public readiness endpoint exposes only a boolean capability, not provider topology, model IDs or secrets.
- Receipts now distinguish a request attempt from confirmed provider response, mark failed-attempt usage as unavailable, label aggregate usage complete/partial, preserve prior attempts when the total budget expires and retain the successful provider receipt when downstream business validation rejects the output.
- Gate D persists both successful and failed attempt chains. A semantically invalid but billable model response now contributes known Token usage to the Run aggregate, remains a failed step and never becomes an Artifact. The UI exposes provider/model/fallback plus expandable success and failure receipts.
- First Red Team verdict was FAIL with four P1 receipt-truthfulness gaps; the first delta then found two deeper validation/usage-accounting edges. All six now have code and regression-test fixes. Final serial verification is 80/80 tests, lint, production build and diff-check PASS. Extended D1/R2 smoke passed all seven stages plus provider-error redaction, semantic-failure receipt persistence, deep-validator TypeError wrapping and known Token aggregation for 200+invalid-JSON failures, producing only local test Run `run_22e91fd6-cf8f-40df-bcb3-617607b61db9` and Artifact `art_dbe452ca-197e-44a9-bdf2-a0ed17a3773d`.
- Temporary `.dev.vars` and both local processes were removed after smoke verification. No production secret has been configured, so real-provider connectivity and hosted model quality remain explicitly unverified.
- Final independent Red Team delta verdict is PASS with P0=0 and P1=0 after the UI Token total was aligned with the backend's no-double-count rule. The multi-model extension may enter the user checkpoint; production connectivity remains unverified until real server-side Secrets are configured and live calls pass.
- On 2026-08-27 the user authorized completing the remaining Gate D publication work: commit the reviewed implementation, push `main`, and deploy a new owner-only private Sites version. This authorization does not waive the real-provider canary requirement.
- Publication completed on 2026-08-27: source commit `bb851191c76db878d1bcfed3c127d020819b183c` was pushed to both GitHub `main` and the Sites source repository, packaged from a fresh successful production build, saved as Sites version 9 and deployed successfully to the existing private URL. Access remained custom owner-only with zero external visitors and zero groups. The production environment contains no model variables or Secrets, so the honest `MODEL_NOT_CONFIGURED` path remains active until provider credentials are supplied through server-side Secret management.

## 2026-08-27 Gate E Creator Foundation Start

- User asked to continue after the Gate D completion audit. Started Gate E rather than expanding the runtime or adding finance scope.
- Froze a creator acceptance contract before schema/API edits: authenticated workspace ownership, bounded Skill text/manual and model-assisted drafting, revision CAS, deterministic E1, honest optional E2, immutable publication, pending upstream claims, Registry discovery and continued prohibition on arbitrary scripts.
- Dispatched independent read-only product, backend/security and creator-UX audits. The Site-owning agent remains the only agent allowed to edit, build or deploy.

## 2026-08-27 Gate E Implementation Candidate

- Implemented authenticated creator submissions for pasted `SKILL.md`, natural-language generation and exact Registry Release forks. Original bytes are stored through a D1 pending → verified R2 → ready protocol; drafts use append-only Revision snapshots and optimistic CAS.
- Added explicit public publisher names as unverified declarations, preserved upstream author/source/license fields, exposed a pending claim workflow and kept internal commercial-use classification out of the public free-beta UI.
- Added conversational AI changes as before/after proposals that require explicit acceptance, deterministic E1 checks, honest optional no-tool E2 samples, immutable Release manifests, exact Registry download/detail and Gate C creator-Release binding.
- Added same-Skill next-version drafts and preserved old Release resolution after the default Release advances. Identical-content version bumps are rejected with `NO_MATERIAL_CHANGE` rather than manufacturing a new version label.
- Hardened publish concurrency with a pre-R2 D1 lease claim, R2 lease metadata, a Release insert fencing trigger and exact-lease cleanup. Hardened Revision concurrency with a parent/head fencing trigger inside the atomic D1 batch.
- Verification candidate: lint PASS, production build PASS, 88/88 tests PASS, local D1/R2 HTTP smoke PASS for creation, cross-workspace isolation, stale edit rejection, E1, honest blocked E2, concurrent publish, Registry, download, Gate C pin, fork, 1.1.0 publication and post-upgrade 1.0.0 resolution. Real-browser Creator checks passed at desktop and 390 px; final independent Red Team reruns remain pending before commit/deployment.

## 2026-08-27 Gate E First Red Team Remediation

- The independent review correctly failed the first candidate: its generated migrations rebuilt `skill_releases`, stale same-Skill branches could replace the default head, old Release views reused mutable Skill metadata, exact Fork reconstructed lossy Markdown, publish commits did not enforce lease expiry in D1 and a failed first R2 write could not resume through the original idempotency key.
- Replaced the migration chain with one additive transaction-safe migration that preserves legacy Release foreign-key references. Added database triggers for live publish leases, current default-head ownership, immutable Release material, valid lifecycle transitions, append-only revisions/evaluations and default-release integrity.
- Added API SemVer ordering and base-head validation, immutable-manifest Registry/pin projections, digest-verified exact R2 Forks, lease-specific public artifact keys and recoverable idempotent source writes. Publisher attestations remain separate from the immutable generated-source snapshot.
- Extended migration and real HTTP tests to prove legacy `personal_configurations` survive upgrade, expired leases and stale heads fail, a version lower than its base fails, exact Fork digest matches its Release, and a renamed 1.1.0 cannot mutate the 1.0.0 detail or Gate C pin.
- Serial verification now passes production build and 95/95 automated tests; the extended live local HTTP/D1/R2 smoke also passes. No commit, push or deployment has occurred. A final independent delta review is now the only Gate E code-acceptance blocker.

## 2026-08-27 Gate E Local Acceptance PASS

- Repeated Red Team deltas closed the complete D1/R2 recovery protocol, including ambiguous D1 commits, timed-out attempt takeover, exact stateVersion/request/source fences, audit fencing and the final shared-key deletion race. Retryable private creator-source keys are never deleted by an attempt; public Release artifact cleanup remains safe because its key contains a unique publish lease token.
- AI proposal acceptance is now recorded honestly as creator-confirmed `manual_edit`; clients cannot forge an `ai_diff` provenance label. Exact historical Registry and Gate C pin surfaces no longer fall back to mutable latest-Skill metadata.
- Final serial verification passes production build, lint, diff-check and 96/96 automated tests. The extended local HTTP/D1/R2 smoke passes creation, isolation, Revision CAS, E1, honest E2 blocking, concurrent publication, exact download/Fork, Gate C binding, lower-version rejection, stale-head rejection, 1.0.0→1.1.0 publication and immutable 1.0.0 presentation after the newer default.
- Final independent Red Team verdict: PASS, P0=0, P1=0, P2=0. Gate E is ready for the user checkpoint. No commit, push, migration application to production or Sites deployment has been performed.
