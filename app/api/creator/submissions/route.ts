import { createCreatorSubmission, listCreatorSubmissions } from "@/lib/gate-e-store";
import { gateEErrorResponse, readGateEJson, requireGateEWorkspace } from "@/lib/gate-e-request";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const workspace = await requireGateEWorkspace();
    return Response.json({ submissions: await listCreatorSubmissions(workspace) }, { headers: { "cache-control": "no-store, private" } });
  } catch (error) {
    return gateEErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const workspace = await requireGateEWorkspace();
    const body = await readGateEJson(request, 180_000);
    const submission = await createCreatorSubmission(workspace, body as Parameters<typeof createCreatorSubmission>[1]);
    return Response.json({ submission }, { status: 201, headers: { "cache-control": "no-store, private" } });
  } catch (error) {
    return gateEErrorResponse(error);
  }
}
