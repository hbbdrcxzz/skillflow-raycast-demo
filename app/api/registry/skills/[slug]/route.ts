import {
  fetchRegistryJson,
  normalizeRegistrySkill,
  registrySource,
  RegistryUpstreamError,
  safeRegistrySlug,
} from "@/lib/upstream-registry";
import { creatorRegistrySkill } from "@/lib/creator-registry";
import { digestUpstreamManifest } from "@/lib/gate-c-release-resolver";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!safeRegistrySlug(slug)) {
    return Response.json({ error: { code: "INVALID_SLUG", message: "Skill 标识不合法" } }, { status: 400 });
  }
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("source") === "skillflow_creator") {
      const releaseId = url.searchParams.get("releaseId") || "";
      if (!/^release_[A-Za-z0-9_:-]{8,240}$/.test(releaseId)) {
        return Response.json({ error: { code: "INVALID_RELEASE_ID", message: "创作者 Release 标识不合法" } }, { status: 400 });
      }
      const { creatorReleaseByIdentity } = await import("@/lib/gate-e-store");
      const release = await creatorReleaseByIdentity(releaseId);
      if (!release || release.slug !== slug) return Response.json({ error: { code: "RELEASE_NOT_FOUND", message: "没有找到这个公开 Release" } }, { status: 404 });
      return Response.json({ skill: creatorRegistrySkill(release), source: { id: "skillflow_creator", name: "Skillflow Creator Registry" } });
    }
    const payload = await fetchRegistryJson<unknown>(`/api/registry/manifest/${slug}`);
    const normalized = normalizeRegistrySkill(payload);
    const raw = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const nested = raw.manifest && typeof raw.manifest === "object" ? raw.manifest as Record<string, unknown> : {};
    const hasExactContent = [raw.skill_markdown, raw.skillMarkdown, raw.instructions, raw.content, nested.skill_markdown, nested.instructions].some((value) => typeof value === "string" && value.trim());
    const manifestDigest = hasExactContent ? await digestUpstreamManifest(payload) : null;
    return Response.json({ skill: { ...normalized, registrySourceId: "openagentskill", identityKey: `openagentskill:${normalized.slug}`, releaseId: null, manifestDigest, fork: { available: hasExactContent, exactContent: hasExactContent, source: "openagentskill", expectedDigest: manifestDigest || undefined } }, source: registrySource });
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法读取 Skill 详情";
    const status = error instanceof RegistryUpstreamError ? error.status : 502;
    return Response.json({ error: { code: "REGISTRY_SKILL_UNAVAILABLE", message } }, { status });
  }
}
