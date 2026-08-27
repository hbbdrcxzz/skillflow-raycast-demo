import { evaluateCreatorE2 } from "@/lib/gate-e-store";
import { gateEErrorResponse, readGateEJson, requireGateEWorkspace } from "@/lib/gate-e-request";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ submissionId: string }> }) {
  try {
    const workspace = await requireGateEWorkspace();
    const { submissionId } = await context.params;
    const body = await readGateEJson(request, 40_000) as { expectedRevision?: number; expectedContentDigest?: string; sampleInput?: string; criteria?: string[] };
    const evaluation = await evaluateCreatorE2(workspace, submissionId, Number(body.expectedRevision), String(body.expectedContentDigest || ""), body);
    return Response.json({ evaluation }, { status: 201, headers: { "cache-control": "no-store, private" } });
  } catch (error) {
    return gateEErrorResponse(error);
  }
}
