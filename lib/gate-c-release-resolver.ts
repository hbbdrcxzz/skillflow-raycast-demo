import { seedSkillManifests } from "@/data/skills";
import { interviewProductManagerSkills } from "@/runtime/skills";
import {
  fetchRegistryJson,
  normalizeRegistrySkill,
  RegistryUpstreamError,
  safeRegistrySlug,
} from "./upstream-registry";
import type {
  PermissionRequirement,
  ReleasePin,
  ReleaseSelector,
} from "./gate-c-contracts";

type UnknownRecord = Record<string, unknown>;

export class ReleaseResolutionError extends Error {
  constructor(
    public readonly code:
      | "INVALID_RELEASE_SELECTOR"
      | "RELEASE_NOT_FOUND"
      | "RELEASE_BLOCKED"
      | "RELEASE_CHANGED"
      | "REGISTRY_UNAVAILABLE",
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "ReleaseResolutionError";
  }
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringList(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (Array.isArray(value)) {
    return value.flatMap((item) => stringList(item)).filter((item, index, all) => all.indexOf(item) === index).slice(0, 32);
  }
  if (value && typeof value === "object") {
    return Object.values(value as UnknownRecord).flatMap((item) => stringList(item)).slice(0, 32);
  }
  return [];
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as UnknownRecord)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]),
  );
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export async function contentDigest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function safeUrl(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function accessFromPermission(id: string): PermissionRequirement["access"] {
  if (/delete|remove|destructive/i.test(id)) return "delete";
  if (/send|publish|message/i.test(id)) return "send";
  if (/create/i.test(id)) return "create";
  if (/write|update|edit/i.test(id)) return "write";
  if (/read|list|search|view/i.test(id)) return "read";
  return "unknown";
}

function riskValue(value: string): PermissionRequirement["risk"] {
  if (/critical|high|高/i.test(value)) return "high";
  if (/low|低/i.test(value)) return "low";
  if (/medium|中/i.test(value)) return "medium";
  return "unknown";
}

function nativePermissionList(manifest: UnknownRecord): PermissionRequirement[] {
  const permissions = record(manifest.permissions);
  const risk = riskValue(text(permissions.risk_level) ?? "unknown");
  const result: PermissionRequirement[] = [];
  for (const access of ["read", "write"] as const) {
    for (const item of stringList(permissions[access])) {
      result.push({
        capability: `${access}.${item}`.slice(0, 180),
        access,
        risk,
        reason: item,
      });
    }
  }
  for (const item of stringList(permissions.external_actions)) {
    result.push({ capability: item.slice(0, 180), access: "unknown", risk: "high", reason: item });
  }
  return result.slice(0, 24);
}

function manifestForSlug(slug: string): UnknownRecord | null {
  const manifest = seedSkillManifests.find((item) => item.skill.slug === slug);
  return manifest ? manifest as unknown as UnknownRecord : null;
}

type RuntimeDefinition = (typeof interviewProductManagerSkills)[keyof typeof interviewProductManagerSkills];

function runtimeDefinitions(): RuntimeDefinition[] {
  return Object.values(interviewProductManagerSkills);
}

export async function nativeReleasePins(): Promise<ReleasePin[]> {
  return Promise.all(runtimeDefinitions().map(async (definition) => {
    const manifest = manifestForSlug(definition.slug);
    const skill = record(manifest?.skill);
    const task = record(manifest?.task);
    const contracts = record(manifest?.contracts);
    const versioning = record(manifest?.versioning);
    const runtimeSnapshot = {
      id: definition.id,
      slug: definition.slug,
      version: definition.version,
      control: definition.control,
      systemInstruction: definition.systemInstruction,
      inputSchema: definition.inputSchema,
      outputSchema: definition.outputSchema,
      limitationsZh: definition.limitationsZh,
      qualityRulesZh: definition.qualityRulesZh,
    };
    const manifestDigest = await contentDigest(runtimeSnapshot);
    const sourceVersion = text(versioning.current_version);
    const versionMismatch = sourceVersion && sourceVersion !== definition.version;
    return {
      source: "skillflow_runtime",
      sourceSkillKey: definition.id,
      releaseId: `runtime:${definition.id}@${definition.version}+${manifestDigest.slice(7, 19)}`,
      slug: definition.slug,
      canonicalName: definition.nameZh,
      version: definition.version,
      manifestDigest,
      sourceCommit: null,
      artifactDigest: manifestDigest,
      pinKind: "immutable_runtime_release",
      resolutionStatus: "resolved",
      author: {
        name: text(record(skill.author).display_name) ?? "Skillflow runtime",
        url: safeUrl(record(skill.author).source_url),
        verified: null,
      },
      sourceUrl: null,
      license: { id: null, name: null, url: null },
      safety: { blocked: false, label: "内建受控能力", tier: "built_in", humanReviewRequired: true },
      evidenceLevel: (text(record(manifest?.evidence).current_level) ?? "unknown") as ReleasePin["evidenceLevel"],
      hostedExecution: "built_in",
      inputs: stringList(contracts.input_schema).length ? stringList(contracts.input_schema) : ["结构化输入（Schema 见运行时定义）"],
      outputs: stringList(contracts.output_schema).length ? stringList(contracts.output_schema) : ["结构化输出（Schema 见运行时定义）"],
      semanticHints: [
        definition.nameZh,
        definition.descriptionZh,
        definition.slug,
        ...stringList(task),
      ].filter((item, index, all) => all.indexOf(item) === index).slice(0, 32),
      limitations: [
        ...definition.limitationsZh,
        ...(versionMismatch ? [`平台示例 Manifest 为 ${sourceVersion}，与真实 runtime ${definition.version} 不同；本绑定只固定 runtime。`] : []),
      ],
      permissions: manifest ? nativePermissionList(manifest) : [],
      registrySignals: {
        quality: { value: null, label: "尚无独立质量实测" },
        trust: { value: null, label: "平台内建，仍需任务级验证" },
        safety: { value: null, label: "受控运行边界" },
      },
    } satisfies ReleasePin;
  }));
}

function upstreamVersion(raw: UnknownRecord): { version: string | null; commit: string | null; artifact: string | null } {
  const release = record(raw.release);
  const versioning = record(raw.versioning);
  const repository = record(raw.repository);
  return {
    version: text(raw.version) ?? text(raw.current_version) ?? text(release.version) ?? text(versioning.current_version),
    commit: text(raw.source_commit) ?? text(raw.commit) ?? text(release.commit) ?? text(repository.commit),
    artifact: text(raw.artifact_digest) ?? text(raw.package_digest) ?? text(release.artifact_digest),
  };
}

// Only volatile indexing/attention fields are excluded. Capability, version,
// permission, compatibility, source and any unknown upstream fields remain in
// the pin so a newly introduced material field also changes the digest.
const volatileUpstreamManifestFields = new Set([
  "stats",
  "ranking",
  "rank",
  "fetched_at",
  "indexed_at",
  "last_seen_at",
  "view_count",
  "download_count",
]);

export async function digestUpstreamManifest(raw: unknown): Promise<string> {
  const source = record(raw);
  const sanitized = Object.fromEntries(
    Object.entries(source).filter(([key]) => !volatileUpstreamManifestFields.has(key)),
  );
  return contentDigest(sanitized);
}

async function upstreamReleasePin(raw: unknown): Promise<ReleasePin> {
  const normalized = normalizeRegistrySkill(raw);
  if (!safeRegistrySlug(normalized.slug)) {
    throw new ReleaseResolutionError("INVALID_RELEASE_SELECTOR", "上游 Skill 缺少合法 slug", 422);
  }
  if (normalized.safety.blocked) {
    throw new ReleaseResolutionError("RELEASE_BLOCKED", "该 Skill 已被上游安全层阻断", 451);
  }
  const rawRecord = record(raw);
  const releaseFacts = upstreamVersion(rawRecord);
  // The release pin covers the full server-side manifest, not the trimmed
  // presentation payload exposed by normalizeRegistrySkill().
  const manifestDigest = await digestUpstreamManifest(rawRecord);
  const immutableSource = Boolean(releaseFacts.version || releaseFacts.commit || releaseFacts.artifact);
  const limitations = stringList(rawRecord.limitations ?? rawRecord.not_for ?? rawRecord.notFor);
  const inputs = stringList(rawRecord.inputs ?? rawRecord.input ?? rawRecord.input_description);
  const outputs = stringList(rawRecord.outputs ?? rawRecord.output ?? rawRecord.output_description);
  const semanticHints = stringList([
    rawRecord.description,
    rawRecord.brief,
    rawRecord.summary,
    rawRecord.semantic_hints,
    rawRecord.semanticHints,
    rawRecord.tags,
    rawRecord.categories,
    rawRecord.use_cases,
    rawRecord.tasks,
  ]);
  const permissions = normalized.safety.permissionHints.map((permission) => ({
    capability: permission.id || permission.originalLabel || permission.label,
    access: accessFromPermission(permission.id || permission.originalLabel),
    risk: riskValue(permission.severity),
    reason: permission.reason || permission.originalReason || "上游仅提供权限提示",
  }));
  const sourceUrl = safeUrl(normalized.attribution.sourceUrl) ?? safeUrl(normalized.repository.url);
  return {
    source: "openagentskill",
    sourceSkillKey: normalized.slug,
    releaseId: `openagentskill:${normalized.slug}:${immutableSource ? "release" : "snapshot"}:${manifestDigest.slice(7, 19)}`,
    slug: normalized.slug,
    canonicalName: normalized.name,
    version: releaseFacts.version,
    manifestDigest,
    sourceCommit: releaseFacts.commit,
    artifactDigest: releaseFacts.artifact,
    pinKind: immutableSource ? "immutable_source_release" : "manifest_snapshot",
    resolutionStatus: immutableSource ? "resolved" : "snapshot_only",
    author: {
      name: normalized.author.name,
      url: safeUrl(normalized.author.url),
      verified: normalized.author.verified,
    },
    sourceUrl,
    license: {
      id: normalized.license.id || null,
      name: normalized.license.name || null,
      url: safeUrl(normalized.license.url),
    },
    safety: {
      blocked: false,
      label: normalized.safety.label,
      tier: normalized.safety.tier,
      humanReviewRequired: normalized.safety.humanReviewRequired,
    },
    evidenceLevel: "unknown",
    hostedExecution: "install_handoff_only",
    inputs,
    outputs,
    semanticHints,
    limitations,
    permissions,
    registrySignals: {
      quality: { value: normalized.quality.score > 0 ? normalized.quality.score : null, label: normalized.quality.label },
      trust: { value: normalized.trust.score > 0 ? normalized.trust.score : null, label: normalized.trust.label },
      safety: { value: normalized.safety.score > 0 ? normalized.safety.score : null, label: normalized.safety.label },
    },
  };
}

export async function resolveRelease(selector: ReleaseSelector): Promise<ReleasePin> {
  if (!selector || !safeRegistrySlug(selector.slug)) {
    throw new ReleaseResolutionError("INVALID_RELEASE_SELECTOR", "Skill 选择器无效", 400);
  }
  let release: ReleasePin;
  if (selector.source === "skillflow_runtime") {
    const releases = await nativeReleasePins();
    const found = releases.find((candidate) => candidate.slug === selector.slug);
    if (!found) throw new ReleaseResolutionError("RELEASE_NOT_FOUND", "没有找到这个本地 Runtime Release", 404);
    release = found;
  } else if (selector.source === "openagentskill") {
    try {
      const raw = await fetchRegistryJson<unknown>(`/api/registry/manifest/${selector.slug}`);
      release = await upstreamReleasePin(raw);
    } catch (error) {
      if (error instanceof ReleaseResolutionError) throw error;
      const status = error instanceof RegistryUpstreamError ? error.status : 502;
      throw new ReleaseResolutionError("REGISTRY_UNAVAILABLE", error instanceof Error ? error.message : "上游 Registry 不可用", status);
    }
  } else {
    throw new ReleaseResolutionError("INVALID_RELEASE_SELECTOR", "不支持的 Release 来源", 400);
  }
  if (selector.expectedManifestDigest && selector.expectedManifestDigest !== release.manifestDigest) {
    throw new ReleaseResolutionError("RELEASE_CHANGED", "该 Skill 自选择后已发生变化，请重新核验", 409);
  }
  return release;
}

export async function searchReleasePins(task: string, limit = 8): Promise<{
  native: ReleasePin[];
  registry: ReleasePin[];
  registryError: string | null;
}> {
  const native = await nativeReleasePins();
  let registry: ReleasePin[] = [];
  let registryError: string | null = null;
  try {
    const params = new URLSearchParams({ task: task.slice(0, 600), limit: String(Math.max(1, Math.min(limit, 12))) });
    const payload = await fetchRegistryJson<{ skills?: unknown[] }>(`/api/skills/search?${params.toString()}`);
    const slugs = (payload.skills ?? [])
      .map((candidate) => normalizeRegistrySkill(candidate).slug)
      .filter((slug) => safeRegistrySlug(slug))
      .slice(0, 12);
    const settled = await Promise.allSettled(slugs.map((slug) => resolveRelease({ source: "openagentskill", slug })));
    registry = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
    const rejected = settled.filter((result) => result.status === "rejected").length;
    if (rejected) registryError = `${rejected} 个 Registry 候选无法完成权威 Release 解析`;
  } catch (error) {
    registryError = error instanceof Error ? error.message : "上游 Registry 不可用";
  }
  return { native, registry, registryError };
}
