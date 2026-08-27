import { createCreatorClaim } from "@/lib/gate-e-store";
import { gateEErrorResponse, readGateEJson, requireGateEWorkspace } from "@/lib/gate-e-request";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ submissionId: string }> }) {
  try {
    const workspace = await requireGateEWorkspace();
    const { submissionId } = await context.params;
    const body = await readGateEJson(request, 20_000);
    const claim = await createCreatorClaim(workspace, submissionId, body);
    return Response.json({ claim }, { status: 201, headers: { "cache-control": "no-store, private" } });
  } catch (error) {
    return gateEErrorResponse(error);
  }
}
