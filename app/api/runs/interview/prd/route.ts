import { generatePrd, validatePrdInput } from "@/lib/interview-runtime";
import { modelErrorResponse } from "@/lib/openai-responses";

export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 120_000;

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return Response.json(
      { error: { code: "INPUT_TOO_LARGE", message: "请求内容不能超过 120 KB" } },
      { status: 413 },
    );
  }

  let input: ReturnType<typeof validatePrdInput>;
  try {
    input = validatePrdInput(await request.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "请求数据无法解析";
    return Response.json({ error: { code: "INVALID_INPUT", message } }, { status: 400 });
  }

  try {
    const result = await generatePrd(input);
    return Response.json(result, {
      status: 201,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return modelErrorResponse(error);
  }
}
