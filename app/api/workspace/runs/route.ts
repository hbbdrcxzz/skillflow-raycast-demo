import { listWorkspaceRuns } from "@/lib/gate-d-store";
import { gateDErrorResponse, requireGateDWorkspace } from "@/lib/gate-d-request";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workspace = await requireGateDWorkspace();
    return Response.json({ runs: await listWorkspaceRuns(workspace.workspaceId) }, { headers: { "cache-control": "no-store, private" } });
  } catch (error) {
    return gateDErrorResponse(error);
  }
}
