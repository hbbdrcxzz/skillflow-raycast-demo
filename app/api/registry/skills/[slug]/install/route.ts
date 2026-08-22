import {
  fetchRegistryJson,
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
    const install = await fetchRegistryJson<Record<string, unknown>>(`/api/skills/${slug}/install`);
    return Response.json({ install, source: registrySource, policy: { executeOnServer: false, arbitraryThirdPartyScripts: false } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法读取安装交接";
    const status = error instanceof RegistryUpstreamError ? error.status : 502;
    return Response.json({ error: { code: "INSTALL_HANDOFF_UNAVAILABLE", message } }, { status });
  }
}
