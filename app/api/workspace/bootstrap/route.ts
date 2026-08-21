import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensurePersonalWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getChatGPTUser();
  if (!user) {
    return Response.json(
      { error: { code: "AUTH_REQUIRED", message: "连接真实数据或保存工作流前需要登录" } },
      { status: 401 },
    );
  }

  try {
    const workspace = await ensurePersonalWorkspace(user);
    return Response.json({ workspace }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法初始化个人空间";
    return Response.json({ error: { code: "WORKSPACE_BOOTSTRAP_FAILED", message } }, { status: 500 });
  }
}

