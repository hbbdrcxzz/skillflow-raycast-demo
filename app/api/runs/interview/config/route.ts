import { modelConfigured } from "@/lib/openai-responses";

export const dynamic = "force-dynamic";

// 前置探测：只返回布尔状态，绝不回传密钥或模型名等敏感配置。
export async function GET() {
  return Response.json(
    {
      configured: modelConfigured(),
      requirement: "OPENAI_API_KEY + OPENAI_MODEL（仅服务端）",
      policy: "未配置时真实运行会返回 MODEL_NOT_CONFIGURED，拒绝伪造结果。",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
