import { readArtifact } from "@/lib/gate-d-store";
import { gateDErrorResponse, requireGateDWorkspace } from "@/lib/gate-d-request";

export const dynamic = "force-dynamic";

function downloadName(value: string) {
  return value.replace(/[\r\n"\\/:*?<>|\u202e\u202d]/g, "-").slice(0, 160) || "Skillflow-Artifact.md";
}

export async function GET(_request: Request, context: { params: Promise<{ artifactId: string }> }) {
  try {
    const workspace = await requireGateDWorkspace();
    const { artifactId } = await context.params;
    const { record, body } = await readArtifact(workspace.workspaceId, artifactId);
    return new Response(body, {
      headers: {
        "content-type": record.mimeType,
        "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(downloadName(record.name))}`,
        "x-content-type-options": "nosniff",
        "cache-control": "no-store, private",
      },
    });
  } catch (error) {
    return gateDErrorResponse(error);
  }
}
