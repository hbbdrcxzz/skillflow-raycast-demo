import { modelConfigurationStatus } from "@/lib/openai-responses";

export const dynamic = "force-dynamic";

// 公共前置探测只返回当前功能是否可用；提供商拓扑、模型名与密钥均留在服务端。
export async function GET() {
  const status = modelConfigurationStatus();
  return Response.json(
    {
      configured: status.routes.runtime.configured,
      requirement: "至少配置一组服务端模型凭据与模型；支持 OpenAI、DeepSeek、Anthropic。",
      policy: "真实提供商、模型、Token、耗时与降级路径进入运行回执；未配置时拒绝伪造结果。",
    },
    { headers: { "cache-control": "no-store, private" } },
  );
}
