import { publishCreatorSubmission } from "@/lib/gate-e-store";
import { gateEErrorResponse, readGateEJson, requireGateEWorkspace } from "@/lib/gate-e-request";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ submissionId: string }> }) {
  try {
    const workspace = await requireGateEWorkspace();
    const { submissionId } = await context.params;
    const body = await readGateEJson(request, 30_000);
    const submission = await publishCreatorSubmission(workspace, submissionId, body as Parameters<typeof publishCreatorSubmission>[2]);
    return Response.json({ submission }, { status: 201, headers: { "cache-control": "no-store, private" } });
  } catch (error) {
    return gateEErrorResponse(error);
  }
}
