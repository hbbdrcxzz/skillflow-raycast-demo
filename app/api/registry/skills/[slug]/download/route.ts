import { env } from "cloudflare:workers";
import { safeRegistrySlug } from "@/lib/upstream-registry";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const releaseId = new URL(request.url).searchParams.get("releaseId") || "";
  if (!safeRegistrySlug(slug) || !/^release_[A-Za-z0-9_:-]{8,240}$/.test(releaseId)) return Response.json({ error: { code: "INVALID_RELEASE_SELECTOR", message: "Release 标识不合法" } }, { status: 400 });
  const { creatorReleaseByIdentity } = await import("@/lib/gate-e-store");
  const release = await creatorReleaseByIdentity(releaseId);
  if (!release || release.slug !== slug || !release.artifactStorageKey) return Response.json({ error: { code: "RELEASE_NOT_FOUND", message: "没有找到可下载的公开 Release" } }, { status: 404 });
  const object = await env.FILES.get(release.artifactStorageKey);
  if (!object) return Response.json({ error: { code: "ARTIFACT_UNAVAILABLE", message: "Release 文件暂时不可用" } }, { status: 503 });
  return new Response(object.body, { headers: {
    "content-type": "application/json; charset=utf-8",
    "content-disposition": `attachment; filename="${slug}-${release.version}.skill.json"`,
    "cache-control": "public, max-age=31536000, immutable",
    "etag": `"${release.artifactDigest}"`,
    "x-content-type-options": "nosniff",
  } });
}
