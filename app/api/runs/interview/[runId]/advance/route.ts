import { advanceInterviewRun } from "@/lib/gate-d-runtime";
import { gateDErrorResponse, readBoundedJson, requireGateDWorkspace } from "@/lib/gate-d-request";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const workspace = await requireGateDWorkspace();
    await readBoundedJson(request, 2_000);
    const { runId } = await context.params;
    const result = await advanceInterviewRun(workspace, runId);
    return Response.json(result, { headers: { "cache-control": "no-store, private" } });
  } catch (error) {
    return gateDErrorResponse(error);
  }
}
