import { compositionErrorResponse, readCompositionJson, revisionForRecommendation } from "@/lib/gate-c-composition";
import { recommendForNode } from "@/lib/gate-c-recommendation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { revision, nodeId, limit } = await revisionForRecommendation(await readCompositionJson(request));
    const recommendation = await recommendForNode(revision, nodeId, limit);
    return Response.json({
      recommendation,
      revisionPreserved: true,
      revisionId: revision.revisionId,
      flags: { persistence: "session_only", saved: false, runnable: false },
    }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return compositionErrorResponse(error);
  }
}
