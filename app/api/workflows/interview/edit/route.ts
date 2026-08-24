import { applyInterviewEdit, gateBErrorResponse } from "@/lib/gate-b-interview";
import { readGateBJson } from "@/lib/gate-b-request";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const snapshot = applyInterviewEdit(await readGateBJson(request));
    return Response.json({ snapshot }, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return gateBErrorResponse(error);
  }
}
