import { confirmInterview, gateBErrorResponse } from "@/lib/gate-b-interview";
import { readGateBJson } from "@/lib/gate-b-request";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const result = confirmInterview(await readGateBJson(request));
    return Response.json(result, {
      status: 201,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return gateBErrorResponse(error);
  }
}
