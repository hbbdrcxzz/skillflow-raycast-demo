export const dynamic = "force-dynamic";

export async function POST() {
  return Response.json({
    error: {
      code: "LEGACY_RUNTIME_REMOVED",
      message: "客户端回传证据生成 PRD 的接口已停用；PRD 只能消费同一 Run 的不可变 Approval。",
    },
  }, { status: 410, headers: { "cache-control": "no-store" } });
}
