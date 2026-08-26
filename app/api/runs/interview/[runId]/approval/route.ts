import { approveInterviewRun } from "@/lib/gate-d-runtime";
import { gateDErrorResponse, readBoundedJson, requireGateDWorkspace } from "@/lib/gate-d-request";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const workspace = await requireGateDWorkspace();
    const body = await readBoundedJson(request, 32_000) as Record<string, unknown>;
    const { runId } = await context.params;
    const selectedThemeIds = Array.isArray(body.selectedThemeIds) ? body.selectedThemeIds.filter((item): item is string => typeof item === "string") : [];
    const result = await approveInterviewRun({
      workspace,
      runId,
      expectedPayloadDigest: typeof body.expectedPayloadDigest === "string" ? body.expectedPayloadDigest : "",
      selectedThemeIds,
      themeEdits: body.themeEdits && typeof body.themeEdits === "object" ? body.themeEdits as Record<string, { title?: string; statement?: string; note?: string }> : undefined,
      evidenceDecisions: body.evidenceDecisions && typeof body.evidenceDecisions === "object" ? body.evidenceDecisions as Record<string, { decision?: string; interpretation?: string }> : undefined,
      addedEvidence: Array.isArray(body.addedEvidence) ? body.addedEvidence as { quote?: string; interpretation?: string; category?: string }[] : undefined,
      addedThemes: Array.isArray(body.addedThemes) ? body.addedThemes as { title?: string; statement?: string; supportingEvidenceIds?: string[]; productImplication?: string }[] : undefined,
    });
    return Response.json(result, { headers: { "cache-control": "no-store, private" } });
  } catch (error) {
    return gateDErrorResponse(error);
  }
}
