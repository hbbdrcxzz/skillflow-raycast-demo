import { GateBContractError } from "./gate-b-interview";

export async function readGateBJson(request: Request, maxBytes = 64_000): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new GateBContractError("INVALID_INPUT", `请求内容不能超过 ${Math.round(maxBytes / 1_000)} KB`, 413);
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new GateBContractError("INVALID_INPUT", "无法读取请求内容", 400);
  }
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    throw new GateBContractError("INVALID_INPUT", `请求内容不能超过 ${Math.round(maxBytes / 1_000)} KB`, 413);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new GateBContractError("INVALID_INPUT", "请求内容必须是有效 JSON", 400);
  }
}
