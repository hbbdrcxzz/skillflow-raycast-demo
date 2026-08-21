import {
  publicSkillDetail,
  publicSkillSummary,
  seedSkillManifests,
} from "@/data/skills";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug")?.trim();
  const query = url.searchParams.get("q")?.trim().toLocaleLowerCase("zh-CN") || "";

  if (slug) {
    const manifest = seedSkillManifests.find((skill) => skill.skill.slug === slug);
    if (!manifest) {
      return Response.json({ error: { code: "SKILL_NOT_FOUND", message: "没有找到这个 Skill" } }, { status: 404 });
    }
    return Response.json({ skill: publicSkillDetail(manifest) });
  }

  const skills = seedSkillManifests
    .filter((manifest) => {
      if (!query) return true;
      const haystack = [
        manifest.skill.name_zh,
        manifest.skill.summary_zh,
        ...manifest.skill.tags,
        manifest.task.definition_zh,
      ]
        .join(" ")
        .toLocaleLowerCase("zh-CN");
      return haystack.includes(query);
    })
    .map(publicSkillSummary);

  return Response.json({
    skills,
    meta: {
      total: skills.length,
      evidenceNotice: "E0 表示平台候选或作者声明；达到 E2 前不作为已验证推荐。",
      arbitraryThirdPartyScriptsHosted: false,
    },
  });
}

