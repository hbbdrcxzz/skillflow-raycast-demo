import { readCreatorSubmission, updateCreatorSubmission } from "@/lib/gate-e-store";
import { gateEErrorResponse, readGateEJson, requireGateEWorkspace } from "@/lib/gate-e-request";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ submissionId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const workspace = await requireGateEWorkspace();
    const { submissionId } = await context.params;
    return Response.json({ submission: await readCreatorSubmission(workspace, submissionId) }, { headers: { "cache-control": "no-store, private" } });
  } catch (error) {
    return gateEErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const workspace = await requireGateEWorkspace();
    const { submissionId } = await context.params;
    const body = await readGateEJson(request, 180_000);
    const submission = await updateCreatorSubmission(workspace, submissionId, body as Parameters<typeof updateCreatorSubmission>[2]);
    return Response.json({ submission }, { headers: { "cache-control": "no-store, private" } });
  } catch (error) {
    return gateEErrorResponse(error);
  }
}
