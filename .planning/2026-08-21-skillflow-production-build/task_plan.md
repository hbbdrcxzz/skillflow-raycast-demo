# Task Plan: Skillflow Production Build

## Goal
Build a China-first, production-capable Skill marketplace and workbench for internet product and operations users, with single-Skill discovery, workflow diagnosis, evidence-based node decisions, sandboxed runs, personalization, and three real golden workflows.

## Current Phase
Phase 2 — Controlled Runtime and Golden Workflows

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
- [ ] Build a controlled task runner, Model Gateway, Tool Broker, file sandbox, receipts, retry, and partial-success handling
- [ ] Implement official-sample run and private-user run modes
- [ ] Implement three golden workflows with fixed evaluation sets
- **Status:** in_progress

### Phase 3: Registry, Import, and Connectors
- [ ] Implement open-source Skill indexing, license classification, immutable releases, evidence attestations, and compatibility adapters
- [ ] Implement file/URL inputs and Feishu connector to the frozen capability boundary
- [ ] Implement Jira Cloud connector only if included in the frozen MVP boundary
- **Status:** pending

### Phase 4: Product Experience Integration
- [ ] Convert the current prototype state into persisted production states
- [ ] Build dual entry: single Skill and AI workflow diagnosis
- [ ] Build Workflow Lab, Node Inspector, Skill comparison, Outcome Lens, structured Diff, Command Home, and Artifact views
- [ ] Cover empty, denied, expired, partial-success, outcome-unknown, outdated, and risk states
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

## Errors Encountered
| Error | Resolution |
|---|---|
| `init-session.sh` was not executable when called directly | Ran the script explicitly through `sh`; planning files were created successfully |
| Local preview could not bind its inspector port in the sandbox | Restarted the existing dev command with the approved local-preview permission |
| Lint rejected a test variable named `module` | Renamed it to `workerBundle`; lint and all tests then passed |
