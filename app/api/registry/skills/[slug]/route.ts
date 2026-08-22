import {
  fetchRegistryJson,
  normalizeRegistrySkill,
  registrySource,
  RegistryUpstreamError,
  safeRegistrySlug,
} from "@/lib/upstream-registry";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!safeRegistrySlug(slug)) {
    return Response.json({ error: { code: "INVALID_SLUG", message: "Skill 标识不合法" } }, { status: 400 });
  }
  try {
    const payload = await fetchRegistryJson<unknown>(`/api/registry/manifest/${slug}`);
    return Response.json({ skill: normalizeRegistrySkill(payload), source: registrySource });
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法读取 Skill 详情";
    const status = error instanceof RegistryUpstreamError ? error.status : 502;
    return Response.json({ error: { code: "REGISTRY_SKILL_UNAVAILABLE", message } }, { status });
  }
}
