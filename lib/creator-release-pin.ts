import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { skillReleases, skills } from "@/db/schema";
import type { PermissionRequirement, ReleasePin } from "./gate-c-contracts";
import type { GateEDraft, GateEE1Result, GateEE2Result } from "./gate-e-contracts";

function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function safeUrl(value: unknown): string | null { try { const url = new URL(String(value || "")); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null; } catch { return null; } }

export async function resolveCreatorReleasePin(slug: string, releaseId: string): Promise<ReleasePin> {
  const db = getDb();
  const [row] = await db.select({ skillId: skills.id, slug: skills.slug, releaseId: skillReleases.id, version: skillReleases.version, artifactDigest: skillReleases.artifactDigest, sourceCommit: skillReleases.sourceCommit, sourceUrl: skillReleases.sourceUrl, licenseSpdx: skillReleases.licenseSpdx, manifest: skillReleases.manifest })
    .from(skillReleases).innerJoin(skills, eq(skillReleases.skillId, skills.id)).where(and(eq(skillReleases.id, releaseId), eq(skillReleases.status, "published"), eq(skills.status, "published"), eq(skills.visibility, "public"))).limit(1);
  if (!row || row.slug !== slug) throw new Error("没有找到这个公开创作者 Release");
  const manifest = record(row.manifest);
  const draft = record(manifest.draft) as unknown as GateEDraft;
  const evidence = record(manifest.evidence);
  const e1 = record(evidence.e1) as unknown as GateEE1Result;
  const e2 = evidence.e2 ? record(evidence.e2) as unknown as GateEE2Result : null;
  const publisher = record(manifest.publisher);
  const releaseName = typeof draft.canonicalName === "string" && draft.canonicalName.trim() ? draft.canonicalName : null;
  if (!releaseName) throw new Error("该公开创作者 Release 的不可变 Manifest 缺少 canonicalName");
  const publisherName = typeof publisher.displayName === "string" && publisher.displayName.trim() ? publisher.displayName.trim() : "创作者发布者";
  const permissions: PermissionRequirement[] = Array.isArray(draft.permissions) ? draft.permissions.map((item) => ({
    capability: `${item.action}.${item.object}`.slice(0, 180),
    access: item.action === "update" ? "write" : item.action === "read" || item.action === "create" || item.action === "delete" || item.action === "send" ? item.action : "unknown",
    risk: item.risk === "critical" ? "high" : item.risk,
    reason: `${item.purpose}；范围：${item.scope}`,
  })) : [];
  return { source: "skillflow_creator", sourceSkillKey: row.skillId, releaseId: row.releaseId, slug: row.slug, canonicalName: releaseName, version: row.version, manifestDigest: row.artifactDigest, sourceCommit: row.sourceCommit, artifactDigest: row.artifactDigest, pinKind: "immutable_source_release", resolutionStatus: "resolved", author: { name: draft.attribution?.originalAuthor || publisherName, url: safeUrl(row.sourceUrl), verified: false }, sourceUrl: safeUrl(row.sourceUrl), license: { id: row.licenseSpdx, name: row.licenseSpdx, url: null }, safety: { blocked: false, label: e1.status === "passed" ? "E1 检查通过" : "E1 通过但带提示", tier: "directory_only", humanReviewRequired: true }, evidenceLevel: e2?.status === "passed" ? "E2" : "E1", hostedExecution: "install_handoff_only", inputs: Array.isArray(draft.inputs) ? draft.inputs : [], outputs: Array.isArray(draft.outputs) ? draft.outputs : [], semanticHints: [releaseName, draft.briefZh, draft.description, ...(draft.tags || [])].filter(Boolean).slice(0, 32), limitations: Array.isArray(draft.limitations) ? draft.limitations : [], permissions, registrySignals: { quality: { value: null, label: e2?.status === "passed" ? "固定样例已通过，尚无真实效果数据" : "尚无独立质量实测" }, trust: { value: null, label: "作者身份与实际效果待核验" }, safety: { value: null, label: "E1 结构、来源与风险检查" } } };
}

export async function searchCreatorReleasePins(task: string, limit: number): Promise<ReleasePin[]> {
  const terms = task.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((item) => item.length > 1).slice(0, 24);
  const db = getDb();
  const rows = await db.select({ releaseId: skillReleases.id, slug: skills.slug, name: skills.name, summary: skills.summary, manifest: skillReleases.manifest }).from(skillReleases).innerJoin(skills, eq(skillReleases.skillId, skills.id)).where(and(eq(skillReleases.status, "published"), eq(skills.status, "published"), eq(skills.visibility, "public"), eq(skills.defaultReleaseId, skillReleases.id))).limit(48);
  const selected = rows.filter((row) => { const haystack = `${row.name} ${row.summary} ${JSON.stringify(row.manifest)}`.toLowerCase(); return !terms.length || terms.some((term) => haystack.includes(term)); }).slice(0, limit);
  return Promise.all(selected.map((row) => resolveCreatorReleasePin(row.slug, row.releaseId)));
}
