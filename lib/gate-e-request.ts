import { getChatGPTUser } from "@/app/chatgpt-auth";
import { readBoundedJson } from "./gate-d-request";
import { GateEContractError, type GateEWorkspace } from "./gate-e-contracts";
import { ensurePersonalWorkspace } from "./workspace";
import { ModelGatewayError } from "./model-gateway";

export async function requireGateEWorkspace(): Promise<GateEWorkspace> {
  const user = await getChatGPTUser();
  if (!user) throw new GateEContractError("AUTH_REQUIRED", "进入创作者空间前需要登录", 401);
  const workspace = await ensurePersonalWorkspace(user);
  if (workspace.role !== "owner" && workspace.role !== "admin" && workspace.role !== "member") {
    throw new GateEContractError("CREATOR_FORBIDDEN", "当前工作区角色不能创建或发布 Skill", 403);
  }
  return {
    workspaceId: workspace.workspaceId,
    accountId: workspace.accountId,
    workspaceName: workspace.workspaceName,
    dataRegion: workspace.dataRegion,
  };
}

export async function readGateEJson(request: Request, maxBytes = 180_000) {
  return readBoundedJson(request, maxBytes);
}

export function gateEErrorResponse(error: unknown) {
  if (error instanceof GateEContractError) {
    return Response.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.httpStatus, headers: { "cache-control": "no-store, private" } },
    );
  }
  if (error instanceof ModelGatewayError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.httpStatus, headers: { "cache-control": "no-store, private" } },
    );
  }
  console.error("Gate E request failed", { name: error instanceof Error ? error.name : "UnknownError", code: "GATE_E_FAILED" });
  return Response.json(
    { error: { code: "CREATOR_FAILED", message: "创作者操作暂时失败，请稍后重试" } },
    { status: 500, headers: { "cache-control": "no-store, private" } },
  );
}
