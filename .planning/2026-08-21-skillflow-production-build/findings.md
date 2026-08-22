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

## OpenAgentSkill Compatibility Decision
- Copy functional mechanisms, not the brand, text, visual assets, proprietary ranking formula, or private implementation.
- Treat OpenAgentSkill as a source-attributed public upstream Registry. A listing is real supply, but it is not automatically a locally reviewed or hosted-runnable Skill.
- Functional parity is grouped into three states: implemented now (search/detail/trust/compare/install handoff/Agent-shaped APIs), contract/endpoint ready but UI incomplete (resolve/packs), and still pending (rankings/outcomes/submission/claim/creator profiles/text API). This distinction prevents another broad-looking but hollow release.
- Our durable differentiation remains downstream of discovery: workflow decomposition, node-level AI suitability, Skill combinations, human approval, personalization/Fork, controlled runs, traceable artifacts, and verified outcomes.
