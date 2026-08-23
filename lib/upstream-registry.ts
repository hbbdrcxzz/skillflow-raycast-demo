import {
  localizeRegistryPermission,
  localizeRegistrySkill,
  localizeRegistryStatus,
  localizeRegistryWarning,
} from "@/lib/registry-localization";

const DEFAULT_REGISTRY_ORIGIN = "https://www.openagentskill.com";

export const registrySource = {
  id: "openagentskill",
  name: "OpenAgentSkill public registry",
  attribution: "公开索引由 OpenAgentSkill 提供；仓库、作者与许可证归原权利人所有。",
  reviewNotice: "进入索引不等于已获 Skillflow 托管执行许可；MVP 不运行任意第三方脚本。",
  localization: {
    locale: "zh-CN",
    policy: "中文功能说明与上游原文分层保存；规则本地化不标记为人工翻译。",
    schemaVersion: "registry-localization.v2",
  },
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

function semanticStrings(value: unknown, depth = 0): string[] {
  if (typeof value === "string") {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized ? [normalized.slice(0, 240)] : [];
  }
  if (depth >= 3) return [];
  if (Array.isArray(value)) return value.flatMap((item) => semanticStrings(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.values(value as UnknownRecord).flatMap((item) => semanticStrings(item, depth + 1));
  }
  return [];
}

export function extractRegistrySemanticHints(value: unknown) {
  const item = record(value);
  const supply = record(item.supply_profile);
  const trust = record(item.trust);
  const decision = record(item.decision);
  const agentReadable = record(item.agent_readable_metadata);
  const machineMetadata = record(item.machine_metadata);
  const candidates = [
    supply.track,
    supply.scenario,
    trust.bestFor,
    trust.best_for,
    decision.primary_fit,
    decision.best_for,
    agentReadable.suited_tasks,
    machineMetadata.suited_tasks,
    item.use_cases,
    item.useCases,
    supply.use_cases,
  ].flatMap((entry) => semanticStrings(entry));
  const seen = new Set<string>();
  return candidates
    .filter((hint) => {
      const key = hint.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 32);
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
  const originalName = text(item.name, "未命名 Skill");
  const originalDescription = text(item.description, text(item.tagline));
  const originalTagline = text(item.tagline);
  const originalCategory = text(item.category, "other");
  const originalTags = strings(item.tags);
  const semanticHints = extractRegistrySemanticHints(item);
  const slug = text(item.slug);
  const localization = localizeRegistrySkill({
    slug,
    name: originalName,
    description: originalDescription,
    tagline: originalTagline,
    category: originalCategory,
    tags: originalTags,
    semanticHints,
  });
  const originalQualityLabel = text(quality.label);
  const originalTrustLabel = text(trust.label);
  const originalSafetyLabel = text(safetyTier.label, text(safety.label));
  const originalMaintenanceLabel = text(maintenance.label);
  const originalRiskLabel = text(risk.label, text(audit.risk_label));
  const originalAttributionLabel = text(attribution.statusLabel);
  const originalWarnings = strings(trust.warnings).slice(0, 4);
  const license = record(item.license);
  const repository = record(item.repository);
  const licenseId =
    typeof item.license === "string"
      ? item.license
      : text(license.spdx, text(license.id, text(license.name)));

  return {
    slug,
    // The canonical name remains untouched because users install and discuss Skills by this identifier.
    name: originalName,
    // Canonical upstream fields stay exact; locale-specific presentation is opt-in through the `*Zh` fields.
    description: originalDescription,
    category: originalCategory,
    tags: originalTags,
    briefZh: localization.brief,
    categoryZh: localization.category,
    tagsZh: localization.tags,
    semanticHints,
    localization,
    original: {
      name: originalName,
      description: originalDescription,
      tagline: originalTagline,
      category: originalCategory,
      tags: originalTags,
    },
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
    quality: {
      score: number(quality.score),
      label: localizeRegistryStatus("quality", originalQualityLabel, originalQualityLabel, "待评估"),
      originalLabel: originalQualityLabel,
    },
    trust: {
      score: number(trust.score),
      label: localizeRegistryStatus("trust", originalTrustLabel, originalTrustLabel, "待复核"),
      originalLabel: originalTrustLabel,
      warnings: originalWarnings.map(localizeRegistryWarning),
      originalWarnings,
      installReady: Boolean(record(trust.installReadiness).ready),
    },
    safety: {
      score: number(safety.score),
      tier: text(safetyTier.tier, "unreviewed"),
      label: localizeRegistryStatus(
        "safety",
        text(safetyTier.tier, text(safety.status, "unreviewed")),
        originalSafetyLabel,
        "未复核",
      ),
      originalLabel: originalSafetyLabel,
      humanReviewRequired: safety.human_review_required !== false,
      blocked: Boolean(safety.blocked),
      permissionHints: Array.isArray(safety.permission_hints)
        ? safety.permission_hints.slice(0, 6).map((hint) => {
            const permission = record(hint);
            const originalLabel = text(permission.label);
            const originalReason = text(permission.reason);
            const localized = localizeRegistryPermission(text(permission.id), originalLabel, originalReason);
            return {
              id: text(permission.id),
              label: localized.label,
              severity: text(permission.severity, "medium"),
              severityLabel: localizeRegistryStatus(
                "safety",
                text(permission.severity, "medium"),
                "",
                "中等风险",
              ),
              reason: localized.reason,
              localizationSource: localized.source,
              originalLabel,
              originalReason,
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
      label: localizeRegistryStatus(
        "maintenance",
        text(maintenance.status, "unknown"),
        originalMaintenanceLabel,
        "维护状态未知",
      ),
      originalLabel: originalMaintenanceLabel,
    },
    risk: {
      label: localizeRegistryStatus(
        "risk",
        text(risk.status, text(risk.level, "unknown")),
        originalRiskLabel,
        "待评估",
      ),
      originalLabel: originalRiskLabel,
    },
    attribution: {
      status: text(attribution.status, "community_indexed"),
      label: localizeRegistryStatus(
        "attribution",
        text(attribution.status, "community_indexed"),
        originalAttributionLabel,
        "社区公开索引",
      ),
      originalLabel: originalAttributionLabel,
      sourceUrl: text(attribution.sourceUrl),
      creatorUrl: text(attribution.creatorUrl),
      publicNote: "公开来源已保留原作者、仓库与许可证归属；收录不等于 Skillflow 已获托管执行许可。",
      originalPublicNote: text(attribution.publicNote),
    },
    repository: {
      url: text(
        item.repositoryUrl,
        text(item.repository_url, text(repository.url, text(attribution.sourceUrl))),
      ),
      original: item.repository ?? item.repositoryUrl ?? item.repository_url ?? null,
    },
    license: {
      id: licenseId,
      name: text(license.name, licenseId),
      url: text(license.url),
      original: item.license ?? null,
    },
    raw: item,
  };
}

export function safeRegistrySlug(value: string) {
  return /^[a-z0-9][a-z0-9-]{0,119}$/.test(value);
}
