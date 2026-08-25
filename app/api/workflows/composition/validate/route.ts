import { compositionErrorResponse, readCompositionJson, validateCompositionRevision } from "@/lib/gate-c-composition";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { revision, validation } = await validateCompositionRevision(await readCompositionJson(request));
    return Response.json({
      revisionId: revision.revisionId,
      graphDigest: revision.graphDigest,
      validation,
      revisionPreserved: true,
      flags: { persistence: "session_only", saved: false, runnable: false },
    }, { status: 200, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return compositionErrorResponse(error);
  }
}
