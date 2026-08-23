import {
  fetchRegistryJson,
  normalizeRegistrySkill,
  registrySource,
  RegistryUpstreamError,
} from "@/lib/upstream-registry";
import { expandRegistrySearchQuery } from "@/lib/registry-localization";

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

  try {
    const payload = await fetchRegistryJson<{ total?: number; skills?: unknown[] }>(
      `/api/skills/search?${params.toString()}`,
    );
    return Response.json({
      query: task,
      searchInterpretation: {
        strategy: searchInterpretation.strategy,
        englishTerms: searchInterpretation.englishTerms,
      },
      total: payload.total ?? payload.skills?.length ?? 0,
      skills: (payload.skills || []).map(normalizeRegistrySkill),
      source: registrySource,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "真实 Skill 索引暂时不可用";
    const status = error instanceof RegistryUpstreamError ? error.status : 502;
    return Response.json({ error: { code: "REGISTRY_UNAVAILABLE", message }, source: registrySource }, { status });
  }
}
