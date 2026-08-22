const DEFAULT_REGISTRY_ORIGIN = "https://www.openagentskill.com";

export const registrySource = {
  id: "openagentskill",
  name: "OpenAgentSkill public registry",
  attribution: "公开索引由 OpenAgentSkill 提供；仓库、作者与许可证归原权利人所有。",
  reviewNotice: "进入索引不等于已获 Skillflow 托管执行许可；MVP 不运行任意第三方脚本。",
};

export class RegistryUpstreamError extends Error {
  constructor(
    message: string,
    public readonly status = 502,
  ) {
    super(message);
    this.name = "RegistryUpstreamError";
  }
}

function registryOrigin() {
  return (process.env.OPENAGENTSKILL_ORIGIN || DEFAULT_REGISTRY_ORIGIN).replace(/\/$/, "");
}

export async function fetchRegistryJson<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(`${registryOrigin()}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        "user-agent": "Skillflow/0.2 registry-compatible-client",
        ...(init?.headers || {}),
      },
      signal: controller.signal,
      next: init?.method && init.method !== "GET" ? undefined : { revalidate: 300 },
    });

    if (!response.ok) {
      throw new RegistryUpstreamError(`上游 Registry 返回 ${response.status}`, response.status);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof RegistryUpstreamError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new RegistryUpstreamError("上游 Registry 响应超时", 504);
    }
    throw new RegistryUpstreamError(error instanceof Error ? error.message : "无法连接上游 Registry");
  } finally {
    clearTimeout(timeout);
  }
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function number(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function normalizeRegistrySkill(value: unknown) {
  const item = record(value);
  const author = record(item.author);
  const stats = record(item.stats);
  const quality = record(item.quality);
  const trust = record(item.trust);
  const safety = record(item.safety);
  const safetyTier = record(safety.safety_tier);
  const supply = record(item.supply_profile);
  const install = record(supply.install);
  const maintenance = record(supply.maintenance);
  const risk = record(supply.risk);
  const attribution = record(item.attribution);
  const audit = record(item.audit);

  return {
    slug: text(item.slug),
    name: text(item.name, "未命名 Skill"),
    description: text(item.description, text(item.tagline)),
    category: text(item.category, "other"),
    tags: strings(item.tags).slice(0, 8),
    author: {
      name: text(author.name, "Unknown"),
      verified: Boolean(author.verified),
      url: text(author.url),
    },
    stats: {
      stars: number(stats.stars),
      verifiedInstalls: number(stats.verified_installs),
      outcomes: number(stats.total_outcomes),
      successfulRuns: number(stats.successful_runs),
    },
    quality: { score: number(quality.score), label: text(quality.label, "待评估") },
    trust: {
      score: number(trust.score),
      label: text(trust.label, "待复核"),
      warnings: strings(trust.warnings).slice(0, 4),
      installReady: Boolean(record(trust.installReadiness).ready),
    },
    safety: {
      score: number(safety.score),
      tier: text(safetyTier.tier, "unreviewed"),
      label: text(safetyTier.label, text(safety.label, "未复核")),
      humanReviewRequired: safety.human_review_required !== false,
      blocked: Boolean(safety.blocked),
      permissionHints: Array.isArray(safety.permission_hints)
        ? safety.permission_hints.slice(0, 6).map((hint) => {
            const permission = record(hint);
            return {
              id: text(permission.id),
              label: text(permission.label),
              severity: text(permission.severity, "medium"),
              reason: text(permission.reason),
            };
          })
        : [],
    },
    install: {
      ready: Boolean(install.ready || record(trust.installReadiness).ready),
      command: text(install.command, text(record(trust.installReadiness).command)),
      targetCount: number(install.targetCount),
    },
    maintenance: {
      status: text(maintenance.status, "unknown"),
      label: text(maintenance.label, "未知"),
    },
    risk: { label: text(risk.label, text(audit.risk_label, "待评估")) },
    attribution: {
      status: text(attribution.status, "community_indexed"),
      label: text(attribution.statusLabel, "Community indexed"),
      sourceUrl: text(attribution.sourceUrl),
      creatorUrl: text(attribution.creatorUrl),
      publicNote: text(attribution.publicNote),
    },
    raw: item,
  };
}

export function safeRegistrySlug(value: string) {
  return /^[a-z0-9][a-z0-9-]{0,119}$/.test(value);
}
