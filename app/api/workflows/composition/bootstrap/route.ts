import { bootstrapComposition, compositionErrorResponse, readCompositionJson } from "@/lib/gate-c-composition";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const revision = await bootstrapComposition(await readCompositionJson(request));
    return Response.json({
      revision,
      flags: { persistence: "session_only", saved: false, runnable: false },
    }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return compositionErrorResponse(error);
  }
}
