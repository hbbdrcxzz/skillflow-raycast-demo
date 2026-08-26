import { getChatGPTUser } from "@/app/chatgpt-auth";
import { GateDContractError, assertSameOriginMutation, gateDErrorResponse } from "./gate-d-contracts";
import { gateDWorkspace } from "./gate-d-store";

export async function requireGateDWorkspace() {
  const user = await getChatGPTUser();
  if (!user) throw new GateDContractError("AUTH_REQUIRED", "保存工作流和使用私人材料前需要登录", 401);
  return gateDWorkspace(user);
}

export async function readBoundedJson(request: Request, maxBytes = 120_000) {
  assertSameOriginMutation(request);
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new GateDContractError("INPUT_TOO_LARGE", `请求内容不能超过 ${Math.floor(maxBytes / 1000)} KB`, 413);
  }
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("input limit exceeded");
        throw new GateDContractError("INPUT_TOO_LARGE", `请求内容不能超过 ${Math.floor(maxBytes / 1000)} KB`, 413);
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new GateDContractError("INVALID_UTF8", "当前只接受 UTF-8 文本", 400);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new GateDContractError("INVALID_JSON", "请求数据无法解析", 400);
  }
}

export { gateDErrorResponse };
