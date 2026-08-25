import {
  compositionErrorResponse,
  readCompositionJson,
  reviseComposition,
  revisionForProposal,
} from "@/lib/gate-c-composition";
import { proposeNaturalRevision } from "@/lib/gate-c-recommendation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = await readCompositionJson(request);
    if (input && typeof input === "object" && (input as { mode?: unknown }).mode === "propose") {
      const { revision, instruction } = await revisionForProposal(input);
      const result = await proposeNaturalRevision(revision, instruction);
      return Response.json({
        ...result,
        revisionPreserved: true,
        revisionId: revision.revisionId,
        flags: { persistence: "session_only", saved: false, runnable: false },
      }, { status: 200, headers: { "cache-control": "no-store" } });
    }
    const result = await reviseComposition(input);
    return Response.json({
      ...result,
      flags: { persistence: "session_only", saved: false, runnable: false },
    }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return compositionErrorResponse(error);
  }
}
