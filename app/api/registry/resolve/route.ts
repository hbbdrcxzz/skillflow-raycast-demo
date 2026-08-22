import { fetchRegistryJson, registrySource, RegistryUpstreamError } from "@/lib/upstream-registry";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as { task?: string; agent?: string; constraints?: Record<string, unknown> };
    const task = input.task?.trim().slice(0, 800);
    if (!task || task.length < 3) {
      return Response.json({ error: { code: "TASK_REQUIRED", message: "请至少用 3 个字描述任务" } }, { status: 400 });
    }
    const result = await fetchRegistryJson<Record<string, unknown>>("/api/agent/resolve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        task,
        agent: input.agent || "codex",
        constraints: { max_risk: "medium", needs_install_command: true, ...(input.constraints || {}) },
      }),
    });
    return Response.json({ result, source: registrySource });
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法解析任务";
    const status = error instanceof RegistryUpstreamError ? error.status : 502;
    return Response.json({ error: { code: "RESOLVE_UNAVAILABLE", message } }, { status });
  }
}
