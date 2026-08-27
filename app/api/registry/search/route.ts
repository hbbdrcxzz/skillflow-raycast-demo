import {
  fetchRegistryJson,
  normalizeRegistrySkill,
  registrySource,
  RegistryUpstreamError,
} from "@/lib/upstream-registry";
import { expandRegistrySearchQuery } from "@/lib/registry-localization";
import { creatorRegistrySkill } from "@/lib/creator-registry";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const task = (url.searchParams.get("task") || url.searchParams.get("q") || "产品运营").trim().slice(0, 400);
  const searchInterpretation = expandRegistrySearchQuery(task);
  const requestedLimit = Number(url.searchParams.get("limit") || 12);
  const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 12, 24));
  const params = new URLSearchParams({ task: searchInterpretation.upstreamTask, limit: String(limit) });
  for (const key of ["category", "platform", "track", "safety"]) {
    const value = url.searchParams.get(key)?.trim();
    if (value) params.set(key, value.slice(0, 80));
  }

  const [creatorResult, upstreamResult] = await Promise.allSettled([
    import("@/lib/gate-e-store").then(({ searchCreatorReleases }) => searchCreatorReleases(task, Math.min(limit, 8))),
    fetchRegistryJson<{ total?: number; skills?: unknown[] }>(`/api/skills/search?${params.toString()}`),
  ]);
  const creatorSkills = creatorResult.status === "fulfilled" ? creatorResult.value.map(creatorRegistrySkill) : [];
  const upstreamSkills = upstreamResult.status === "fulfilled" ? (upstreamResult.value.skills || []).map((skill) => ({
    ...normalizeRegistrySkill(skill),
    registrySourceId: "openagentskill" as const,
    identityKey: `openagentskill:${normalizeRegistrySkill(skill).slug}`,
    releaseId: null,
    manifestDigest: null,
    fork: { available: false, exactContent: false, source: "openagentskill" as const },
  })) : [];
  if (creatorSkills.length || upstreamSkills.length) {
    const skills = [...creatorSkills, ...upstreamSkills].slice(0, limit);
    return Response.json({
      query: task,
      searchInterpretation: {
        strategy: searchInterpretation.strategy,
        englishTerms: searchInterpretation.englishTerms,
      },
      total: skills.length,
      skills,
      source: { ...registrySource, includes: ["skillflow_creator", "openagentskill"] },
      sourceStatus: {
        creator: creatorResult.status === "fulfilled" ? "ready" : "unavailable",
        openagentskill: upstreamResult.status === "fulfilled" ? "ready" : "unavailable",
      },
    });
  }
  const upstreamError = upstreamResult.status === "rejected" ? upstreamResult.reason : null;
  const message = upstreamError instanceof Error ? upstreamError.message : "真实 Skill 索引暂时不可用";
  const status = upstreamError instanceof RegistryUpstreamError ? upstreamError.status : 502;
  return Response.json({ error: { code: "REGISTRY_UNAVAILABLE", message }, source: registrySource }, { status });
}
