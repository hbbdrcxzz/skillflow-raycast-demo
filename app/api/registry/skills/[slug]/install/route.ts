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
    // 安装交接前先读 manifest：上游标记 blocked 的 Skill 不提供任何交接命令。
    const manifest = normalizeRegistrySkill(await fetchRegistryJson<unknown>(`/api/registry/manifest/${slug}`));
    if (manifest.safety.blocked) {
      return Response.json(
        {
          error: {
            code: "SKILL_BLOCKED",
            message: "上游安全层已将该 Skill 标记为 blocked，Skillflow 不提供安装交接。",
          },
          source: registrySource,
          policy: { executeOnServer: false, arbitraryThirdPartyScripts: false },
        },
        { status: 451 },
      );
    }

    const install = await fetchRegistryJson<Record<string, unknown>>(`/api/skills/${slug}/install`);
    return Response.json({ install, source: registrySource, policy: { executeOnServer: false, arbitraryThirdPartyScripts: false } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "无法读取安装交接";
    const status = error instanceof RegistryUpstreamError ? error.status : 502;
    return Response.json({ error: { code: "INSTALL_HANDOFF_UNAVAILABLE", message } }, { status });
  }
}
