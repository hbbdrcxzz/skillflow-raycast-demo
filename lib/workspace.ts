import { and, eq } from "drizzle-orm";
import type { ChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { accounts, memberships, workspaces } from "@/db/schema";

export async function stableWorkspaceIdentity(prefix: "acct" | "ws" | "mem", userId: string) {
  if (!userId) throw new Error("平台用户身份缺失");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`skillflow:${prefix}:${userId}`));
  const encoded = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${encoded}`;
}

export async function ensurePersonalWorkspace(user: ChatGPTUser) {
  const db = getDb();
  const [accountId, workspaceId, membershipId] = await Promise.all([
    stableWorkspaceIdentity("acct", user.userId),
    stableWorkspaceIdentity("ws", user.userId),
    stableWorkspaceIdentity("mem", user.userId),
  ]);
  const emailOwner = user.email
    ? await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.primaryEmail, user.email)).limit(1)
    : [];
  // Never adopt Version 7's lossy sanitized subject IDs: two distinct platform
  // subjects could map to the same row. If that old row owns the same unique
  // email, create the SHA identity without an email attribute; asset migration
  // requires a separate, explicit and audited proof flow.
  const safeEmail = !emailOwner[0] || emailOwner[0].id === accountId ? user.email : null;

  await db
    .insert(accounts)
    .values({
      id: accountId,
      primaryEmail: safeEmail,
      displayName: user.fullName || user.displayName,
      locale: "zh-CN",
    })
    .onConflictDoUpdate({
      target: accounts.id,
      set: { primaryEmail: safeEmail, displayName: user.fullName || user.displayName },
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
      accountStatus: accounts.status,
      workspaceStatus: workspaces.status,
      membershipStatus: memberships.status,
    })
    .from(memberships)
    .innerJoin(accounts, eq(memberships.accountId, accounts.id))
    .innerJoin(workspaces, eq(memberships.workspaceId, workspaces.id))
    .where(and(eq(memberships.accountId, accountId), eq(memberships.workspaceId, workspaceId)))
    .limit(1);

  if (!membership) throw new Error("个人工作空间初始化失败");
  if (membership.accountStatus !== "active" || membership.workspaceStatus !== "active" || membership.membershipStatus !== "active") {
    throw new Error("个人工作空间已停用");
  }
  return membership;
}
