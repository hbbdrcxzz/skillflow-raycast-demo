export const dynamic = "force-dynamic";

export async function POST() {
  return Response.json({
    error: {
      code: "LEGACY_RUNTIME_REMOVED",
      message: "匿名无状态分析接口已停用；请从已保存的 WorkflowVersion 创建同一个持久化 Run。",
    },
  }, { status: 410, headers: { "cache-control": "no-store" } });
}
