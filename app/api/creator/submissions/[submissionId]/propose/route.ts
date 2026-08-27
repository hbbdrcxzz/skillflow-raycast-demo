import { proposeCreatorDraftChange } from "@/lib/gate-e-store";
import { gateEErrorResponse, readGateEJson, requireGateEWorkspace } from "@/lib/gate-e-request";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ submissionId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const workspace = await requireGateEWorkspace();
    const { submissionId } = await context.params;
    const body = await readGateEJson(request, 32_000);
    return Response.json({ proposal: await proposeCreatorDraftChange(workspace, submissionId, body) }, { headers: { "cache-control": "no-store, private" } });
  } catch (error) {
    return gateEErrorResponse(error);
  }
}
