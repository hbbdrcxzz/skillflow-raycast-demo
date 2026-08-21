import { executionModes, nodeKinds } from "@/lib/contracts";

export async function GET() {
  return Response.json({
    version: "2026-08-21",
    boundaries: {
      hostedExecution: ["instruction_only", "built_in_nodes", "allowlisted_code"],
      arbitraryThirdPartyScripts: false,
      dataRegion: "global_allowed",
      externalModels: true,
      feishu: { region: "cn", read: "selected_resources", create: "explicit_confirmation", overwrite: false, delete: false },
      jira: { edition: "cloud", phase: "later", readOnly: true, dataCenter: false },
    },
    nodeKinds,
    executionModes,
    evidenceLevels: ["E0", "E1", "E2", "E3", "E4"],
    workflowStates: [
      "draft", "clarifying", "generating_plan", "plan_ready", "needs_configuration", "needs_permission",
      "ready", "running", "paused", "partially_succeeded", "succeeded", "failed", "cancelled", "outcome_unknown", "outdated",
    ],
  });
}

