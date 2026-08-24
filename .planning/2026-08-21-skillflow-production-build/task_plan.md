# Task Plan: Skillflow Production Build

## Goal
Build a China-first, production-capable Skill marketplace and workbench for internet product and operations users. The acceptance bar is no longer a visual prototype: users must be able to discover real upstream Skills, inspect evidence and install handoffs, place Skills into a diagnosed workflow, run an allowlisted golden workflow against real user material, approve intermediate results, and download a real artifact.

## Current Phase
Gate B — AI Work Discovery complete and independently accepted; awaiting user approval before Gate C

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

## Audit-Driven Delivery Gates (2026-08-22)
1. **Gate A — honest Chinese marketplace (complete, user approved):** Registry identity routing, canonical/Chinese presentation separation, truthful states, blocked-Skill enforcement, responsive typography and private Sites version 5 all passed Red Team review.
2. **Gate B — AI work discovery (complete, awaiting user approval):** free-form conversation, adaptive clarification, editable and traceable Task Contract, explicit confirmation, and abstract work nodes generated only from the confirmed contract. Final independent Red Team review passed B1–B8 with no P0/P1 blockers; lint, production build, full 39/39 tests and 390/1440 real-browser checks passed.
3. **Gate C — editable Skill composition:** node-level execution mode, real SkillRelease recommendations/replacement/combination, semantic Diff and immutable WorkflowRevision.
4. **Gate D — one genuine sandbox loop:** preflight, allowlisted run, approval, partial-failure handling, real Artifact/receipt, persistence and reopen from Command Home.
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
