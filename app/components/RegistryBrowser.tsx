"use client";

import { useEffect, useMemo, useState } from "react";

export type RegistrySkill = {
  registrySourceId: "openagentskill" | "skillflow_creator";
  identityKey: string;
  releaseId: string | null;
  manifestDigest: string | null;
  slug: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  briefZh: string;
  categoryZh: string;
  tagsZh: string[];
  localization: {
    locale: string;
    source: string;
    confidence: number;
    needsReview: boolean;
    notice: string;
    schemaVersion: string;
  };
  original?: { name: string; description: string; tagline: string; category: string; tags: string[] };
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
    permissionHints: { id: string; label: string; severity: string; severityLabel?: string; reason: string; originalLabel?: string; originalReason?: string }[];
  };
  install: { ready: boolean; command: string; downloadUrl?: string; targetCount: number };
  maintenance: { status: string; label: string };
  risk: { label: string };
  attribution: { status: string; label: string; sourceUrl: string; creatorUrl: string; publicNote: string };
  repository?: { url: string };
  license?: { id: string; name: string; url: string };
  fork?: { available: boolean; exactContent: boolean; source: "openagentskill" | "skillflow_creator"; releaseId?: string; expectedDigest?: string };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rawText(raw: Record<string, unknown> | undefined, keys: string[]) {
  if (!raw) return "";
  const pools = [raw, isRecord(raw.i18n) ? raw.i18n : {}, isRecord(raw.presentation) ? raw.presentation : {}];
  const zhPool = isRecord(pools[1].zh) ? pools[1].zh : {};
  pools.unshift(zhPool);
  for (const pool of pools) {
    for (const key of keys) {
      const value = pool[key];
      if (typeof value === "string" && value.trim()) return value.trim();
      if (Array.isArray(value)) {
        const joined = value.filter((item): item is string => typeof item === "string").join("、");
        if (joined) return joined;
        if (value.length) return "上游提供了结构化字段，待中文核验；请结合原始说明检查。";
      }
      if (isRecord(value)) return "上游提供了结构化字段，待中文核验；请结合原始说明检查。";
    }
  }
  return "";
}

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function structuredUpstreamField(skill: RegistrySkill, keys: string[], emptyLabel: string) {
  const value = rawText(skill.raw, keys);
  return value || `上游未提供结构化${emptyLabel}，待核验。`;
}

function compactNumber(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  return String(value || 0);
}

export default function RegistryBrowser({ onUseInWorkflow, onForkSkill }: { onUseInWorkflow: (skill: RegistrySkill) => void; onForkSkill: (skill: RegistrySkill) => void }) {
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
      const detailQuery = new URLSearchParams({ source: skill.registrySourceId });
      if (skill.releaseId) detailQuery.set("releaseId", skill.releaseId);
      const response = await fetch(`/api/registry/skills/${encodeURIComponent(skill.slug)}?${detailQuery.toString()}`);
      const payload = (await response.json()) as { skill?: RegistrySkill };
      if (response.ok && payload.skill) setSelected(payload.skill);
    } finally {
      setDetailLoading(false);
    }
  }

  function toggleCompare(identityKey: string) {
    setCompare((current) => {
      if (current.includes(identityKey)) return current.filter((item) => item !== identityKey);
      if (current.length >= 3) return [...current.slice(1), identityKey];
      return [...current, identityKey];
    });
  }

  async function copyCommand(skill: RegistrySkill) {
    if (!skill.install.command || skill.safety.blocked) return;
    await navigator.clipboard.writeText(skill.install.command);
    setCopied(skill.slug);
    window.setTimeout(() => setCopied(""), 1800);
  }

  const compareSkills = useMemo(
    () => compare.map((identityKey) => skills.find((skill) => skill.identityKey === identityKey)).filter(Boolean) as RegistrySkill[],
    [compare, skills],
  );
  const selectedGuide = selected ? {
    useWhen: structuredUpstreamField(selected, ["use_when", "when_to_use", "useWhen"], "适用场景"),
    notFor: structuredUpstreamField(selected, ["not_for", "limitations", "notFor"], "限制条件"),
    input: structuredUpstreamField(selected, ["input", "inputs", "input_description"], "输入"),
    output: structuredUpstreamField(selected, ["output", "outputs", "output_description"], "输出"),
  } : null;
  const selectedTags = selected ? Array.from(new Set([selected.categoryZh || "待分类", ...(selected.tagsZh || [])])) : [];
  const selectedLicenseUrl = selected ? safeExternalUrl(selected.license?.url || "") : "";

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
        {taskChips.map((chip) => <button type="button" key={chip} onClick={() => { setQuery(chip); void search(chip); }}>{chip}</button>)}
      </div>

      {error && <div className="registry-error"><strong>Registry 暂时不可用</strong><span>{error}</span><button type="button" onClick={() => void search()}>重试</button></div>}

      {compareSkills.length > 0 && (
        <section className="compare-dock">
          <div className="compare-title"><span>并排比较 · {compareSkills.length}/3</span><button type="button" onClick={() => setCompare([])}>清空</button></div>
          <div className="compare-grid">
            {compareSkills.map((skill) => (
              <article key={skill.identityKey}>
                <button type="button" className="compare-remove" aria-label={`移除 ${skill.name}`} onClick={() => toggleCompare(skill.identityKey)}>×</button>
                <small>{skill.categoryZh || "待分类"}</small><h3 lang="en">{skill.name}</h3>
                <p className="compare-brief">{skill.briefZh || "中文功能说明待补充。"}</p>
                <div className="compare-score"><span>上游质量信号<strong>{skill.quality.score}</strong></span><span>信任<strong>{skill.trust.score}</strong></span><span>安全<strong>{skill.safety.score}</strong></span></div>
                <p>{skill.safety.label} · {skill.maintenance.label}</p>
                <small className="compare-note">质量信号不是当前任务适配分</small>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="registry-layout">
        <section className="registry-list" aria-busy={loading}>
          {loading && Array.from({ length: 6 }, (_, index) => <div className="skill-card skeleton" key={index} />)}
          {!loading && skills.map((skill, index) => (
            <article className={`skill-card ${selected?.identityKey === skill.identityKey ? "selected" : ""}`} key={skill.identityKey}>
              <button type="button" className="skill-card-main" onClick={() => void openDetail(skill)}>
                <span className="skill-rank">{String(index + 1).padStart(2, "0")}</span>
                <span className="skill-card-copy">
                  <small>{skill.categoryZh || "待分类"} · {skill.attribution.label}</small>
                  <strong lang="en">{skill.name}</strong>
                  <em>{skill.briefZh || "中文功能说明待补充。"}</em>
                  <span className="skill-card-tags">{(skill.tagsZh || []).slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}{skill.localization.needsReview && <span className="localization-review">中文待核验</span>}</span>
                </span>
                <span className="skill-card-scores"><b>{skill.trust.score}</b><small>信任</small></span>
              </button>
              <div className="skill-card-meta">
                <span>★ {compactNumber(skill.stats.stars)}</span><span>{skill.maintenance.label}</span><span>{skill.safety.label}</span>
                {skill.safety.blocked && <span className="blocked-badge">已阻断 · 不提供安装交接</span>}
                <button type="button" className={compare.includes(skill.identityKey) ? "active" : ""} onClick={() => toggleCompare(skill.identityKey)}>{compare.includes(skill.identityKey) ? "已加入比较" : "加入比较"}</button>
              </div>
            </article>
          ))}
        </section>

        <aside className="registry-detail">
          {!selected ? (
            <div className="detail-empty"><span>◇</span><strong>选择一个 Skill 查看完整证据</strong><p>详情包含作者归属、质量、信任、安全、权限提示、安装命令，以及能否放进 Skillflow 托管工作流。</p></div>
          ) : (
            <div className={detailLoading ? "detail-loading" : ""}>
              <div className="detail-status"><span className={selected.safety.blocked ? "blocked" : ""}>{selected.safety.blocked ? "已阻断" : selected.safety.label}</span><em>{selected.attribution.label}</em></div>
              <h3 lang="en">{selected.name}</h3>
              <p className="detail-brief">{selected.briefZh || "中文功能说明待补充。"}</p>
              <div className="detail-tags">{selectedTags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <div className={`localization-note ${selected.localization.needsReview ? "needs-review" : ""}`}><strong>{selected.localization.needsReview ? "中文说明待核验" : "中文说明来源"}</strong><p>{selected.localization.notice || "上游尚未标注中文说明来源。"}</p></div>
              {(selected.original?.description || selected.description) && (
                <details className="detail-original">
                  <summary>查看原始说明</summary>
                  <p>{selected.original?.description || selected.description}</p>
                </details>
              )}
              <div className="detail-author">
                <span>作者：{safeExternalUrl(selected.author.url) ? <a href={safeExternalUrl(selected.author.url)} target="_blank" rel="noreferrer">{selected.author.name}</a> : selected.author.name}{selected.author.verified ? " · 已验证" : ""}</span>
                <small>★ {compactNumber(selected.stats.stars)} · {selected.categoryZh || "待分类"}</small>
              </div>
              <div className="detail-score-grid">
                <div><small>上游质量信号</small><strong>{selected.quality.score}</strong><span>{selected.quality.label} · 非任务适配分</span></div>
                <div><small>信任</small><strong>{selected.trust.score}</strong><span>{selected.trust.label}</span></div>
                <div><small>安全</small><strong>{selected.safety.score}</strong><span>{selected.safety.label}</span></div>
              </div>
              <section className="detail-section detail-decision">
                <b>采用前先判断</b>
                <div className="decision-grid">
                  <div><small>适合在</small><p>{selectedGuide?.useWhen}</p></div>
                  <div><small>不适合</small><p>{selectedGuide?.notFor}</p></div>
                  <div><small>需要输入</small><p>{selectedGuide?.input}</p></div>
                  <div><small>预期输出</small><p>{selectedGuide?.output}</p></div>
                </div>
              </section>
              <section className="detail-section">
                <b>权限与风险</b>
                {selected.safety.permissionHints.length ? selected.safety.permissionHints.map((hint) => {
                  return <div className="permission-row" key={hint.id || hint.label}><span className={hint.severity}>{hint.severityLabel || "需确认"}</span><p><strong>{hint.label}</strong><small>{hint.reason}</small></p></div>;
                }) : <p>公开元数据未给出具体权限提示。这不等于零风险，安装前仍需核对仓库与源代码。</p>}
              </section>
              <section className="detail-section">
                <b>安装交接</b>
                {selected.safety.blocked ? (
                  <>
                    <p className="blocked-note">上游安全层已将该 Skill 标记为 blocked（已阻断）。Skillflow 不提供复制安装命令，也不会把它放入工作流。</p>
                    <code>安装交接已禁用</code>
                  </>
                ) : (
                  <>
                    <code>{selected.install.command || "上游未提供安装命令"}</code>
                    <p>MVP 只复制交接命令，不会在服务器上执行第三方脚本。</p>
                  </>
                )}
              </section>
              <div className="detail-actions">{selected.install.downloadUrl ? <a className="registry-download" href={selected.install.downloadUrl}>下载不可变 Release</a> : <button type="button" disabled={!selected.install.command || selected.safety.blocked} onClick={() => void copyCommand(selected)}>{copied === selected.slug ? "已复制" : "复制安装命令"}</button>}<button type="button" disabled={!selected.fork?.available || !selected.fork.exactContent} onClick={() => onForkSkill(selected)}>{selected.fork?.available && selected.fork.exactContent ? "按我的需求修改" : "需提供完整源文件后修改"}</button><button type="button" className="primary" disabled={selected.safety.blocked} onClick={() => onUseInWorkflow(selected)}>{selected.safety.blocked ? "已阻断 · 不可适配" : "适配到我的工作 ↗"}</button></div>
              <div className="source-note">
                <p>{selected.attribution.publicNote || "公开来源已保留原作者、仓库与许可证归属；进入索引不代表已获托管执行授权。"}</p>
                <p>许可证：{selectedLicenseUrl ? <a href={selectedLicenseUrl} target="_blank" rel="noreferrer">{selected.license?.id || selected.license?.name || "查看许可证说明"}</a> : <span>{selected.license?.id || selected.license?.name ? `${selected.license?.id || selected.license?.name} · 许可证链接待核验` : "上游未提供许可证链接，待核验"}</span>}</p>
                <div>{safeExternalUrl(selected.repository?.url || selected.attribution.sourceUrl) && <a href={safeExternalUrl(selected.repository?.url || selected.attribution.sourceUrl)} target="_blank" rel="noreferrer">查看仓库或来源</a>}{safeExternalUrl(selected.attribution.creatorUrl) && <a href={safeExternalUrl(selected.attribution.creatorUrl)} target="_blank" rel="noreferrer">查看作者主页</a>}</div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
