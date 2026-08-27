import { modelConfigured } from "@/lib/openai-responses";
import { validateAnalysisInput } from "@/lib/interview-runtime";
import { GateDContractError } from "@/lib/gate-d-contracts";
import { createInterviewRun } from "@/lib/gate-d-store";
import { gateDErrorResponse, readBoundedJson, requireGateDWorkspace } from "@/lib/gate-d-request";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const workspace = await requireGateDWorkspace();
    if (!modelConfigured("runtime")) throw new GateDContractError("MODEL_NOT_CONFIGURED", "真实运行层尚未配置可用的服务端模型路由", 503);
    const body = await readBoundedJson(request, 120_000) as Record<string, unknown>;
    let validated: ReturnType<typeof validateAnalysisInput>;
    try {
      validated = validateAnalysisInput({ transcript: body.transcript, researchGoal: body.researchGoal });
    } catch (error) {
      const message = error instanceof Error ? error.message : "访谈材料或研究目标无效";
      throw new GateDContractError("INVALID_INPUT", message, /超过|不能超过/.test(message) ? 413 : 422);
    }
    if (typeof body.fileName === "string" && body.fileName.trim().length > 180) throw new GateDContractError("INVALID_FILE_NAME", "文件名不能超过 180 个字符", 422);
    const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "访谈材料.txt";
    if (!/\.(txt|md)$/i.test(fileName)) throw new GateDContractError("UNSUPPORTED_FILE", "当前只支持 .txt 与 .md", 415);
    if (validated.transcript.includes("\u0000")) throw new GateDContractError("INVALID_TEXT", "访谈材料包含不支持的 NUL 字符", 400);
    if (typeof body.productContext === "string" && body.productContext.trim().length > 4000) throw new GateDContractError("INVALID_INPUT", "产品背景不能超过 4000 个字符", 413);
    if (typeof body.idempotencyKey === "string" && body.idempotencyKey.length > 160) throw new GateDContractError("INVALID_IDEMPOTENCY_KEY", "提交标识不能超过 160 个字符", 422);
    const result = await createInterviewRun({
      workspace,
      workflowVersionId: typeof body.workflowVersionId === "string" ? body.workflowVersionId : "",
      idempotencyKey: typeof body.idempotencyKey === "string" && body.idempotencyKey.length <= 160 ? body.idempotencyKey : crypto.randomUUID(),
      researchGoal: validated.researchGoal,
      productContext: typeof body.productContext === "string" ? body.productContext.trim() : "",
      transcript: validated.transcript,
      fileName,
      mimeType: /\.md$/i.test(fileName) ? "text/markdown" : "text/plain",
      disclosureAccepted: body.disclosureAccepted === true,
    });
    return Response.json({ run: result.run, replayed: result.replayed }, {
      status: result.replayed ? 200 : 201,
      headers: { "cache-control": "no-store, private" },
    });
  } catch (error) {
    return gateDErrorResponse(error);
  }
}
