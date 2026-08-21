import { and, eq } from "drizzle-orm";
import type { ChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { accounts, memberships, workspaces } from "@/db/schema";

function stableId(prefix: string, userId: string) {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 96);
  return `${prefix}_${safe}`;
}

export async function ensurePersonalWorkspace(user: ChatGPTUser) {
  const db = getDb();
  const accountId = stableId("acct", user.userId);
  const workspaceId = stableId("ws", user.userId);
  const membershipId = stableId("mem", user.userId);

  await db
    .insert(accounts)
    .values({
      id: accountId,
      primaryEmail: user.email,
      displayName: user.fullName || user.displayName,
      locale: "zh-CN",
    })
    .onConflictDoUpdate({
      target: accounts.id,
      set: { primaryEmail: user.email, displayName: user.fullName || user.displayName },
    });

  await db
    .insert(workspaces)
    .values({
      id: workspaceId,
      type: "personal",
      name: `${user.fullName || user.displayName}的空间`,
      dataRegion: "global",
      crossBorderProcessingAllowed: true,
      settings: { modelPolicy: "external_allowed", language: "zh-CN" },
    })
    .onConflictDoNothing({ target: workspaces.id });

  await db
    .insert(memberships)
    .values({
      id: membershipId,
      workspaceId,
      accountId,
      role: "owner",
      status: "active",
      joinedAt: new Date().toISOString(),
    })
    .onConflictDoNothing({ target: memberships.id });

  const [membership] = await db
    .select({
      accountId: accounts.id,
      displayName: accounts.displayName,
      email: accounts.primaryEmail,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      dataRegion: workspaces.dataRegion,
      crossBorderProcessingAllowed: workspaces.crossBorderProcessingAllowed,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(accounts, eq(memberships.accountId, accounts.id))
    .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
    .where(and(eq(memberships.accountId, accountId), eq(memberships.workspaceId, workspaceId)))
    .limit(1);

  if (!membership) throw new Error("个人工作空间初始化失败");
  return membership;
}

