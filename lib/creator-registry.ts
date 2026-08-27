import type { GateEDraft, GateEE1Result, GateEE2Result } from "./gate-e-contracts";

type CreatorReleaseRecord = {
  skillId: string;
  slug: string;
  name?: string;
  summary?: string;
  tags?: string[] | null;
  releaseId: string;
  version: string;
  artifactDigest: string;
  artifactStorageKey?: string | null;
  manifest: unknown;
  permissions?: unknown;
  licenseSpdx: string | null;
  sourceUrl: string | null;
  containsExecutableScripts: boolean;
  publishedAt: string | null;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 20) : [];
}

export function creatorRegistrySkill(row: CreatorReleaseRecord) {
  const manifest = record(row.manifest);
  const draft = record(manifest.draft) as unknown as GateEDraft;
  const evidence = record(manifest.evidence);
  const e1 = record(evidence.e1) as unknown as GateEE1Result;
  const e2 = evidence.e2 ? record(evidence.e2) as unknown as GateEE2Result : null;
  const sourceUrl = typeof draft?.attribution?.sourceUrl === "string" ? draft.attribution.sourceUrl : row.sourceUrl || "";
  const originalAuthor = draft?.attribution?.originalAuthor || "创作者发布者";
  const publisher = record(manifest.publisher);
  const publisherName = typeof publisher.displayName === "string" && publisher.displayName.trim() ? publisher.displayName.trim() : "匿名发布者";
  const releaseName = typeof draft?.canonicalName === "string" && draft.canonicalName.trim() ? draft.canonicalName : "未命名 Creator Release";
  const releaseSummary = typeof draft?.briefZh === "string" && draft.briefZh.trim() ? draft.briefZh : "该历史 Release 未包含中文 Brief";
  const tags = stringList(draft?.tags);
  const permissionHints = Array.isArray(draft?.permissions) ? draft.permissions.map((permission, index) => ({
    id: `creator:${row.releaseId}:permission:${index}`,
    label: `${permission.action} · ${permission.object}`,
    severity: permission.risk === "critical" || permission.risk === "high" ? "high" : permission.risk,
    severityLabel: permission.risk === "critical" || permission.risk === "high" ? "高风险" : permission.risk === "medium" ? "中风险" : "低风险",
    reason: `${permission.purpose}；范围：${permission.scope}`,
  })) : [];
  const evidenceLevel = e2?.status === "passed" ? "E2" : "E1";
  return {
    registrySourceId: "skillflow_creator" as const,
    identityKey: `skillflow_creator:${row.releaseId}`,
    releaseId: row.releaseId,
    manifestDigest: row.artifactDigest,
    slug: row.slug,
    name: releaseName,
    description: draft?.description || releaseSummary,
    category: "creator",
    tags,
    briefZh: releaseSummary,
    categoryZh: "创作者发布",
    tagsZh: tags,
    semanticHints: [releaseName, releaseSummary, ...tags, ...stringList(draft?.inputs), ...stringList(draft?.outputs)],
    localization: {
      locale: "zh-CN",
      source: "creator",
      confidence: 1,
      needsReview: false,
      notice: "中文 Brief 由发布者提交，并通过当前 Release 的 E1 结构检查。",
      schemaVersion: "creator-registry.v1",
    },
    original: { name: releaseName, description: draft?.description || releaseSummary, tagline: releaseSummary, category: "creator", tags },
    author: { name: draft?.attribution?.originalAuthor || publisherName, verified: false, url: sourceUrl },
    stats: { stars: 0, verifiedInstalls: 0, outcomes: 0, successfulRuns: 0 },
    quality: { score: 0, label: e2?.status === "passed" ? "固定样例已通过，尚无真实效果数据" : "尚无独立质量实测" },
    trust: { score: 0, label: `${evidenceLevel} 证据 · 作者身份待核验`, warnings: ["发布者身份与实际效果尚未得到平台独立验证"], installReady: true },
    safety: {
      score: 0,
      tier: "directory_only",
      label: e1?.status === "passed" ? "E1 检查通过" : "E1 通过但带提示",
      humanReviewRequired: true,
      blocked: false,
      permissionHints,
    },
    install: { ready: Boolean(row.artifactStorageKey), command: "", downloadUrl: `/api/registry/skills/${encodeURIComponent(row.slug)}/download?source=skillflow_creator&releaseId=${encodeURIComponent(row.releaseId)}`, targetCount: 1 },
    maintenance: { status: "published", label: `不可变 Release · ${row.version}` },
    risk: { label: row.containsExecutableScripts ? "包含脚本引用 · 平台不托管执行" : "目录展示 · 使用前人工核验" },
    attribution: {
      status: "creator_published",
      label: "Skillflow 创作者 Release",
      sourceUrl,
      creatorUrl: "",
      publicNote: `此 Release 由 ${publisherName} 发布。${draft?.attribution?.originalAuthor ? `原作者字段保留为 ${originalAuthor}。` : ""}平台不代表已验证发布者身份或商业权利。`,
    },
    repository: { url: sourceUrl },
    license: { id: row.licenseSpdx || "", name: row.licenseSpdx || "许可证待核验", url: "" },
    fork: { available: true, exactContent: true, source: "skillflow_creator" as const, releaseId: row.releaseId, expectedDigest: row.artifactDigest },
    hostedExecution: "install_handoff_only" as const,
    evidenceLevel,
    raw: {
      use_when: stringList(draft?.inputs).length ? `当输入包含：${stringList(draft.inputs).join("、")}` : "发布者未单独声明适用输入。",
      not_for: stringList(draft?.limitations),
      inputs: stringList(draft?.inputs),
      outputs: stringList(draft?.outputs),
    },
  };
}
