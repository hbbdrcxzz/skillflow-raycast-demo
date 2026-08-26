import { persistComposition } from "@/lib/gate-d-store";
import { gateDErrorResponse, readBoundedJson, requireGateDWorkspace } from "@/lib/gate-d-request";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const workspace = await requireGateDWorkspace();
    const body = await readBoundedJson(request, 500_000) as { revision?: unknown };
    const result = await persistComposition(body?.revision, workspace);
    return Response.json({
      workflowId: result.workflowId,
      workflowVersionId: result.workflowVersionId,
      runtimePlan: result.plan,
      saved: true,
    }, { status: 201, headers: { "cache-control": "no-store, private" } });
  } catch (error) {
    return gateDErrorResponse(error);
  }
}
