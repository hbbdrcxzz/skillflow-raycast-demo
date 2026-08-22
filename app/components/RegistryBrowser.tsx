"use client";

import { useEffect, useMemo, useState } from "react";

type RegistrySkill = {
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  author: { name: string; verified: boolean; url: string };
  stats: { stars: number; verifiedInstalls: number; outcomes: number; successfulRuns: number };
  quality: { score: number; label: string };
  trust: { score: number; label: string; warnings: string[]; installReady: boolean };
  safety: {
    score: number;
    tier: string;
    label: string;
    humanReviewRequired: boolean;
    blocked: boolean;
    permissionHints: { id: string; label: string; severity: string; reason: string }[];
  };
  install: { ready: boolean; command: string; targetCount: number };
  maintenance: { status: string; label: string };
  risk: { label: string };
  attribution: { status: string; label: string; sourceUrl: string; creatorUrl: string; publicNote: string };
  raw?: Record<string, unknown>;
};

type RegistryPayload = {
  query?: string;
  total?: number;
  skills?: RegistrySkill[];
  source?: { name: string; attribution: string; reviewNotice: string };
  error?: { message: string };
};

const taskChips = ["用户访谈与 PRD", "产品数据分析", "竞品研究", "运营内容", "PPT 与汇报", "网页采集"];

function compactNumber(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  return String(value || 0);
}

export default function RegistryBrowser({ onUseInWorkflow }: { onUseInWorkflow: (skill: RegistrySkill) => void }) {
  const [query, setQuery] = useState("用户访谈 PRD 产品研究");
  const [skills, setSkills] = useState<RegistrySkill[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<RegistrySkill | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [compare, setCompare] = useState<string[]>([]);
  const [copied, setCopied] = useState("");

  async function search(nextQuery = query) {
    const trimmed = nextQuery.trim();
    if (!trimmed) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/registry/search?task=${encodeURIComponent(trimmed)}&limit=16`);
      const payload = (await response.json()) as RegistryPayload;
      if (!response.ok) throw new Error(payload.error?.message || "真实 Skill 索引暂时不可用");
      setSkills(payload.skills || []);
      setTotal(payload.total || payload.skills?.length || 0);
      setSelected(null);
    } catch (reason) {
      setSkills([]);
      setError(reason instanceof Error ? reason.message : "真实 Skill 索引暂时不可用");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch(`/api/registry/search?task=${encodeURIComponent("用户访谈 PRD 产品研究")}&limit=16`)
      .then(async (response) => {
        const payload = (await response.json()) as RegistryPayload;
        if (!response.ok) throw new Error(payload.error?.message || "真实 Skill 索引暂时不可用");
        if (!active) return;
        setSkills(payload.skills || []);
        setTotal(payload.total || payload.skills?.length || 0);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "真实 Skill 索引暂时不可用");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function openDetail(skill: RegistrySkill) {
    setSelected(skill);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/registry/skills/${encodeURIComponent(skill.slug)}`);
      const payload = (await response.json()) as { skill?: RegistrySkill };
      if (response.ok && payload.skill) setSelected(payload.skill);
    } finally {
      setDetailLoading(false);
    }
  }

  function toggleCompare(slug: string) {
    setCompare((current) => {
      if (current.includes(slug)) return current.filter((item) => item !== slug);
      if (current.length >= 3) return [...current.slice(1), slug];
      return [...current, slug];
    });
  }

  async function copyCommand(skill: RegistrySkill) {
    if (!skill.install.command) return;
    await navigator.clipboard.writeText(skill.install.command);
    setCopied(skill.slug);
    window.setTimeout(() => setCopied(""), 1800);
  }

  const compareSkills = useMemo(
    () => compare.map((slug) => skills.find((skill) => skill.slug === slug)).filter(Boolean) as RegistrySkill[],
    [compare, skills],
  );

  return (
    <div className="registry-shell stage-enter">
      <div className="registry-head">
        <div>
          <div className="micro-label">真实公开供给 · 上游兼容 Registry</div>
          <h2>先按工作找能力，再看证据决定是否采用。</h2>
          <p>检索结果来自实时公开索引；Skillflow 保留作者与仓库归属，并把“已收录”和“可托管运行”严格分开。</p>
        </div>
        <div className="registry-counter"><strong>{loading ? "…" : total.toLocaleString()}</strong><span>个匹配候选</span></div>
      </div>

      <form className="registry-search" onSubmit={(event) => { event.preventDefault(); void search(); }}>
        <span>⌕</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="描述任务，例如：把用户访谈整理成 PRD" aria-label="搜索真实 Skill" />
        <button type="submit" disabled={loading}>{loading ? "检索中" : "搜索真实 Skill"}</button>
      </form>
      <div className="registry-chips">
        {taskChips.map((chip) => <button key={chip} onClick={() => { setQuery(chip); void search(chip); }}>{chip}</button>)}
      </div>

      {error && <div className="registry-error"><strong>Registry 暂时不可用</strong><span>{error}</span><button onClick={() => void search()}>重试</button></div>}

      {compareSkills.length > 0 && (
        <section className="compare-dock">
          <div className="compare-title"><span>并排比较 · {compareSkills.length}/3</span><button onClick={() => setCompare([])}>清空</button></div>
          <div className="compare-grid">
            {compareSkills.map((skill) => (
              <article key={skill.slug}>
                <button className="compare-remove" onClick={() => toggleCompare(skill.slug)}>×</button>
                <small>{skill.category}</small><h3>{skill.name}</h3>
                <div className="compare-score"><span>匹配证据<strong>{skill.quality.score}</strong></span><span>信任<strong>{skill.trust.score}</strong></span><span>安全<strong>{skill.safety.score}</strong></span></div>
                <p>{skill.safety.label} · {skill.maintenance.label}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="registry-layout">
        <section className="registry-list" aria-busy={loading}>
          {loading && Array.from({ length: 6 }, (_, index) => <div className="skill-card skeleton" key={index} />)}
          {!loading && skills.map((skill, index) => (
            <article className={`skill-card ${selected?.slug === skill.slug ? "selected" : ""}`} key={skill.slug}>
              <button className="skill-card-main" onClick={() => void openDetail(skill)}>
                <span className="skill-rank">{String(index + 1).padStart(2, "0")}</span>
                <span className="skill-card-copy"><small>{skill.category} · {skill.attribution.label}</small><strong>{skill.name}</strong><em>{skill.description}</em></span>
                <span className="skill-card-scores"><b>{skill.trust.score}</b><small>TRUST</small></span>
              </button>
              <div className="skill-card-meta">
                <span>★ {compactNumber(skill.stats.stars)}</span><span>{skill.maintenance.label}</span><span>{skill.safety.label}</span>
                <button className={compare.includes(skill.slug) ? "active" : ""} onClick={() => toggleCompare(skill.slug)}>{compare.includes(skill.slug) ? "已比较" : "比较"}</button>
              </div>
            </article>
          ))}
        </section>

        <aside className="registry-detail">
          {!selected ? (
            <div className="detail-empty"><span>◇</span><strong>选择一个 Skill 查看完整证据</strong><p>详情包含作者归属、质量、信任、安全、权限提示、安装命令，以及能否放进 Skillflow 托管工作流。</p></div>
          ) : (
            <div className={detailLoading ? "detail-loading" : ""}>
              <div className="detail-status"><span>{selected.safety.tier.toUpperCase()}</span><em>{selected.attribution.label}</em></div>
              <h3>{selected.name}</h3><p>{selected.description}</p>
              <div className="detail-author"><span>by {selected.author.name}{selected.author.verified ? " ✓" : ""}</span><small>★ {compactNumber(selected.stats.stars)} · {selected.category}</small></div>
              <div className="detail-score-grid"><div><small>质量</small><strong>{selected.quality.score}</strong></div><div><small>信任</small><strong>{selected.trust.score}</strong></div><div><small>安全</small><strong>{selected.safety.score}</strong></div></div>
              <section className="detail-section"><b>权限与风险</b>{selected.safety.permissionHints.length ? selected.safety.permissionHints.map((hint) => <div className="permission-row" key={hint.id}><span className={hint.severity}>{hint.severity}</span><p><strong>{hint.label}</strong><small>{hint.reason}</small></p></div>) : <p>公开元数据中未发现高风险权限提示，仍需安装前复核源代码。</p>}</section>
              <section className="detail-section"><b>安装交接</b><code>{selected.install.command || "上游未提供安装命令"}</code><p>MVP 只复制交接命令，不会在服务器上执行第三方脚本。</p></section>
              <div className="detail-actions"><button disabled={!selected.install.command} onClick={() => void copyCommand(selected)}>{copied === selected.slug ? "已复制" : "复制安装命令"}</button><button className="primary" onClick={() => onUseInWorkflow(selected)}>放入我的工作流 ↗</button></div>
              <div className="source-note">{selected.attribution.publicNote || "公开来源已保留原作者与仓库归属。"}</div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
