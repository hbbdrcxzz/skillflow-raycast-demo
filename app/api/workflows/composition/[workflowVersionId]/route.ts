import { loadWorkflowVersion } from "@/lib/gate-d-store";
import { gateDErrorResponse, requireGateDWorkspace } from "@/lib/gate-d-request";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ workflowVersionId: string }> }) {
  try {
    const workspace = await requireGateDWorkspace();
    const { workflowVersionId } = await context.params;
    return Response.json(
      { workflow: await loadWorkflowVersion(workspace.workspaceId, workflowVersionId) },
      { headers: { "cache-control": "no-store, private" } },
    );
  } catch (error) {
    return gateDErrorResponse(error);
  }
}
