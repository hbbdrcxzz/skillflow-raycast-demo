import { loadRun, runArtifactsByPurpose } from "@/lib/gate-d-store";
import { gateDErrorResponse, requireGateDWorkspace } from "@/lib/gate-d-request";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const workspace = await requireGateDWorkspace();
    const { runId } = await context.params;
    const bundle = await loadRun(workspace.workspaceId, runId);
    const outputs = await runArtifactsByPurpose(workspace.workspaceId, runId, [
      "normalized_interview", "extracted_evidence", "clustered_insights", "workflow_assessment",
      "approved_analysis", "prd_draft", "prd_result", "quality_report",
    ]);
    const data = Object.fromEntries(Object.entries(outputs).map(([purpose, value]) => [
      purpose,
      purpose === "prd_result" ? value.body : JSON.parse(value.body),
    ]));
    return Response.json({ ...bundle, data }, { headers: { "cache-control": "no-store, private" } });
  } catch (error) {
    return gateDErrorResponse(error);
  }
}
