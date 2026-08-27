"use client";

import { useEffect, useMemo, useState } from "react";
import type { GateEDraft } from "@/lib/gate-e-contracts";
import type { RegistrySkill } from "./RegistryBrowser";

type Evaluation = { id: string; level: "e1" | "e2"; status: string; result: Record<string, unknown> };
type Claim = { id: string; claimType: string; sourceUrl: string; subjectName: string; status: string; createdAt: string };
type Submission = {
  id: string; status: string; revision: number; currentRevisionId: string; name: string; slug: string;
  publisherName: string; targetSkillId: string | null; baseReleaseId: string | null;
  draft: GateEDraft; contentDigest: string; evaluations: Evaluation[]; claims: Claim[];
  source: { url: string | null; releaseDigest: string | null };
  published: { skillId: string; releaseId: string; publishedAt: string } | null;
  updatedAt: string;
};
type Proposal = { proposalId: string; baseRevision: number; baseContentDigest: string; instruction: string; draft: GateEDraft; diff: { field: string; before: unknown; after: unknown }[] };

function uid(prefix: string) { return `${prefix}:${Date.now()}:${crypto.randomUUID()}`; }
function list(value: string) { return value.split(/[\n,，]/).map((item) => item.trim()).filter(Boolean); }
function nextMinor(value: string) { const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value); return match ? `${match[1]}.${Number(match[2]) + 1}.0` : "1.1.0"; }
function message(value: unknown, fallback: string) {
  const error = value && typeof value === "object" ? (value as { error?: { message?: string } }).error : null;
  return error?.message || fallback;
}

export default function CreatorStudio({ initialFork, onBack, onUseRelease }: {
  initialFork: RegistrySkill | null;
  onBack: () => void;
  onUseRelease: (skill: { source: "skillflow_creator"; slug: string; releaseId: string }) => void;
}) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [current, setCurrent] = useState<Submission | null>(null);
  const [draft, setDraft] = useState<GateEDraft | null>(null);
  const [mode, setMode] = useState<"skill_text" | "natural_language">("skill_text");
  const [sourceText, setSourceText] = useState("---\nname: weekly-insight\ndescription: 将结构化工作记录整理为面向管理层的中文洞察摘要\nlicense: MIT\ntags: 周报, 洞察\n---\n\n# Weekly Insight\n\n根据用户提供的工作记录，提取进展、风险、关键数字和下一步。不得编造未提供的事实；输出中文，先给结论，再列证据与待确认项。");
  const [brief, setBrief] = useState("我想把每周的产品和运营工作记录整理成管理层能快速判断的周报，输入是飞书或粘贴文本，输出要有结论、数字、风险和下一步，不能编造数据。");
  const [slug, setSlug] = useState("weekly-insight");
  const [license, setLicense] = useState("MIT");
  const [publisherName, setPublisherName] = useState("");
  const [rights, setRights] = useState(false);
  const [changeRequest, setChangeRequest] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [sampleInput, setSampleInput] = useState("本周完成注册流程改版，上线后注册完成率从 42% 提升到 51%；支付页仍有 18% 用户退出；下周验证价格文案。");
  const [criteria, setCriteria] = useState("结论先行\n保留原始数字\n明确风险和下一步");
  const [version, setVersion] = useState("1.0.0");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [forkRights, setForkRights] = useState(false);
  const [ignoreFork, setIgnoreFork] = useState(false);
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const [claimSubject, setClaimSubject] = useState("");
  const [claimNote, setClaimNote] = useState("");

  async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(message(payload, `请求失败（${response.status}）`));
    return payload as T;
  }
  async function reload(selectId?: string) {
    const payload = await request<{ submissions: Submission[] }>("/api/creator/submissions");
    setSubmissions(payload.submissions);
    const next = payload.submissions.find((item) => item.id === (selectId || current?.id)) || (initialFork && !ignoreFork && !selectId ? null : payload.submissions[0] || null);
    setCurrent(next); setDraft(next?.draft || null); setProposal(null);
  }
  useEffect(() => {
    const timer = window.setTimeout(() => { void reload().catch((error) => setNotice(error.message)); }, 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function createFork() {
    if (!initialFork?.fork?.available || !initialFork.releaseId || !forkRights) return;
    setBusy("fork"); setNotice("正在固定源 Release 并建立可编辑派生草稿…");
    try {
      const { submission } = await request<{ submission: Submission }>("/api/creator/submissions", { method: "POST", body: JSON.stringify({
        inputKind: "registry_fork", idempotencyKey: uid("creator-fork"), slug: `${initialFork.slug}-personal`, rightsAttested: true, publisherName,
        fork: { source: initialFork.registrySourceId, slug: initialFork.slug, releaseId: initialFork.releaseId, expectedDigest: initialFork.manifestDigest },
      }) });
      await reload(submission.id);
      setNotice("已建立精确派生草稿。权利状态记录为你的发布者声明，不代表平台验证。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "无法建立派生草稿"); } finally { setBusy(""); }
  }

  async function create() {
    setBusy("create"); setNotice("");
    try {
      const payload = await request<{ submission: Submission }>("/api/creator/submissions", { method: "POST", body: JSON.stringify({
        inputKind: mode, skillText: mode === "skill_text" ? sourceText : undefined, brief: mode === "natural_language" ? brief : undefined,
        slug, licenseSpdx: license, rightsAttested: rights, publisherName, idempotencyKey: uid("creator-create"),
      }) });
      await reload(payload.submission.id);
    } catch (error) { setNotice(error instanceof Error ? error.message : "创建失败"); } finally { setBusy(""); }
  }
  async function save(nextDraft: GateEDraft) {
    if (!current) return;
    setBusy("save"); setNotice("");
    try {
      const payload = await request<{ submission: Submission }>(`/api/creator/submissions/${current.id}`, { method: "PATCH", body: JSON.stringify({ expectedRevision: current.revision, expectedContentDigest: current.contentDigest, mutationKind: "manual_edit", draft: nextDraft }) });
      setCurrent(payload.submission); setDraft(payload.submission.draft); setSubmissions((items) => items.map((item) => item.id === payload.submission.id ? payload.submission : item)); setProposal(null); setPublishConfirmed(false);
    } catch (error) { setNotice(error instanceof Error ? error.message : "保存失败"); } finally { setBusy(""); }
  }
  async function propose() {
    if (!current) return;
    setBusy("propose"); setNotice(""); setProposal(null);
    try {
      const payload = await request<{ proposal: Proposal }>(`/api/creator/submissions/${current.id}/propose`, { method: "POST", body: JSON.stringify({ expectedRevision: current.revision, expectedContentDigest: current.contentDigest, instruction: changeRequest }) });
      setProposal(payload.proposal);
    } catch (error) { setNotice(error instanceof Error ? error.message : "无法生成修改提案"); } finally { setBusy(""); }
  }
  async function evaluate(level: "e1" | "e2") {
    if (!current) return;
    setBusy(level); setNotice("");
    try {
      await request(`/api/creator/submissions/${current.id}/evaluations/${level}`, { method: "POST", body: JSON.stringify({ expectedRevision: current.revision, expectedContentDigest: current.contentDigest, sampleInput, criteria: list(criteria) }) });
      await reload(current.id);
    } catch (error) { setNotice(error instanceof Error ? error.message : "检查失败"); } finally { setBusy(""); }
  }
  async function publish() {
    if (!current) return;
    const e1 = current.evaluations.find((item) => item.level === "e1" && item.status === "passed");
    const e2 = current.evaluations.find((item) => item.level === "e2" && item.status === "passed");
    if (!e1) { setNotice("当前 Revision 需要先通过 E1 才能发布。"); return; }
    setBusy("publish");
    try {
      const payload = await request<{ submission: Submission }>(`/api/creator/submissions/${current.id}/publish`, { method: "POST", body: JSON.stringify({ expectedRevision: current.revision, expectedContentDigest: current.contentDigest, e1EvaluationId: e1.id, e2EvaluationId: e2?.id || null, version, idempotencyKey: uid("creator-publish") }) });
      setCurrent(payload.submission); setDraft(payload.submission.draft); await reload(payload.submission.id);
    } catch (error) { setNotice(error instanceof Error ? error.message : "发布失败"); } finally { setBusy(""); }
  }

  async function createNextVersion() {
    if (!current?.published) return;
    setBusy("next-version"); setNotice("正在从当前不可变 Release 建立下一版本草稿…");
    try {
      const payload = await request<{ submission: Submission }>("/api/creator/submissions", { method: "POST", body: JSON.stringify({
        inputKind: "registry_fork", idempotencyKey: uid("creator-next-version"), slug: current.slug,
        publisherName: current.publisherName, rightsAttested: true, publishAsNextVersion: true,
        fork: { source: "skillflow_creator", slug: current.slug, releaseId: current.published.releaseId },
      }) });
      setVersion(nextMinor(version));
      await reload(payload.submission.id);
      setNotice("下一版本草稿已建立；旧 Release 仍可按原 ID 下载和用于既有工作流。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "无法建立下一版本"); } finally { setBusy(""); }
  }

  async function submitClaim() {
    if (!current?.source.url) return;
    setBusy("claim"); setNotice("");
    try {
      await request(`/api/creator/submissions/${current.id}/claims`, { method: "POST", body: JSON.stringify({
        claimType: "repository_owner", evidenceType: "maintainer_note", sourceUrl: current.source.url,
        subjectName: claimSubject, note: claimNote,
      }) });
      await reload(current.id);
      setNotice("认领申请已记录为待审核；在人工核验前，商店不会显示为已认证作者。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "无法提交认领"); } finally { setBusy(""); }
  }

  const e1 = current?.evaluations.find((item) => item.level === "e1");
  const e2 = current?.evaluations.find((item) => item.level === "e2");
  const issueList = useMemo(() => Array.isArray(e1?.result?.issues) ? e1.result.issues as { code: string; severity: string; message: string }[] : [], [e1]);
  const e2Criteria = useMemo(() => Array.isArray(e2?.result?.criteria) ? e2.result.criteria as { criterion: string; passed: boolean; evidence: string }[] : [], [e2]);
  const immutable = current?.status === "published";
  const preview = (value: unknown) => { const text = typeof value === "string" ? value : JSON.stringify(value); return text.length > 220 ? `${text.slice(0, 220)}…` : text; };
  return (
    <div className="creator-shell stage-enter">
      <header className="creator-head"><button onClick={onBack}>← 返回</button><div><span className="micro-label">CREATOR FOUNDATION · Gate E</span><h2>把一个想法或现有 Release，变成可核验的 Skill。</h2><p>先固定来源与草稿，再由 AI 提出结构化修改；只有你确认的 Diff 才会形成新 Revision。</p></div><span className="creator-boundary">instruction-only · 不运行第三方脚本</span></header>
      {notice && <div className="creator-notice">{notice}</div>}
      <div className="creator-grid">
        <aside className="creator-left">
          <div className="creator-panel-title"><b>草稿与 Release</b><button onClick={() => { setIgnoreFork(true); setCurrent(null); setDraft(null); setProposal(null); }}>＋ 新建</button></div>
          {submissions.map((item) => <button key={item.id} className={`creator-draft-row ${current?.id === item.id ? "active" : ""}`} onClick={() => { setCurrent(item); setDraft(item.draft); setProposal(null); }}><strong>{item.name}</strong><span>r{item.revision} · {item.status}</span></button>)}
          {!current && initialFork?.fork?.available && !ignoreFork ? <section className="creator-create creator-fork-create">
            <span className="micro-label">EXACT RELEASE FORK</span><h3>{initialFork.name}</h3><p>{initialFork.briefZh}</p><code>{initialFork.releaseId}</code>
            <label>公开发布署名<input value={publisherName} onChange={(event) => setPublisherName(event.target.value)} placeholder="个人姓名、团队名或品牌名" /><small>这是发布者声明，不代表平台已验证为上游作者。</small></label>
            <label className="creator-check"><input type="checkbox" checked={forkRights} onChange={(event) => setForkRights(event.target.checked)} />我确认有权基于这个 Release 创建并公开派生版本；原作者、来源和许可证字段会继续保留。此声明不等于平台验证。</label>
            <button className="primary" disabled={Boolean(busy) || !forkRights || publisherName.trim().length < 2} onClick={() => void createFork()}>{busy === "fork" ? "正在固定源 Release…" : "建立可编辑派生草稿"}</button>
          </section> : !current && <section className="creator-create">
            <div className="creator-tabs"><button className={mode === "skill_text" ? "active" : ""} onClick={() => setMode("skill_text")}>粘贴 SKILL.md</button><button className={mode === "natural_language" ? "active" : ""} onClick={() => setMode("natural_language")}>自然语言生成</button></div>
            {mode === "skill_text" ? <textarea value={sourceText} onChange={(event) => setSourceText(event.target.value)} aria-label="Skill 原始文本" /> : <textarea value={brief} onChange={(event) => setBrief(event.target.value)} aria-label="自然语言创建需求" />}
            <label>英文标识<input value={slug} onChange={(event) => setSlug(event.target.value)} /></label><label>许可证<input value={license} onChange={(event) => setLicense(event.target.value)} placeholder="MIT" /></label><label>公开发布署名<input value={publisherName} onChange={(event) => setPublisherName(event.target.value)} placeholder="个人姓名、团队名或品牌名" /><small>对外展示为发布者声明；作者认证需要另行核验。</small></label>
            <label className="creator-check"><input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} />我确认有权提交与公开此内容；这是发布者声明，不是平台验证。</label>
            <button className="primary" disabled={Boolean(busy) || !rights || publisherName.trim().length < 2} onClick={() => void create()}>{busy === "create" ? "正在建立不可变源快照…" : "建立草稿"}</button>
          </section>}
        </aside>
        <main className="creator-editor">
          {!current || !draft ? <div className="creator-empty"><span>✦</span><h3>选择草稿，或从左侧建立一个新的 Skill。</h3><p>从商店“按我的需求修改”进入时，系统只对有完整内容快照的 Release 建立精确派生。</p></div> : <>
            <div className="creator-revision"><span>{immutable ? "Immutable Release source" : `Draft Revision ${current.revision}`}</span><code>{current.contentDigest.slice(0, 18)}…</code><em>{current.status}</em></div>
            <fieldset disabled={immutable} className="creator-fields">
            <label>Canonical name<input value={draft.canonicalName} onChange={(e) => setDraft({ ...draft, canonicalName: e.target.value })} /></label>
            <label>中文 Brief<textarea className="short" value={draft.briefZh} onChange={(e) => setDraft({ ...draft, briefZh: e.target.value })} /></label>
            <label>原始功能说明<textarea className="short" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
            <label>Skill 指令<textarea className="instructions" value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} /></label>
            <div className="creator-two"><label>输入（每行一项）<textarea value={draft.inputs.join("\n")} onChange={(e) => setDraft({ ...draft, inputs: list(e.target.value) })} /></label><label>输出（每行一项）<textarea value={draft.outputs.join("\n")} onChange={(e) => setDraft({ ...draft, outputs: list(e.target.value) })} /></label></div>
            <div className="creator-two"><label>标签<input value={draft.tags.join("、")} onChange={(e) => setDraft({ ...draft, tags: list(e.target.value) })} /></label><label>限制<input value={draft.limitations.join("、")} onChange={(e) => setDraft({ ...draft, limitations: list(e.target.value) })} /></label></div>
            </fieldset>
            <div className="creator-editor-actions"><span>来源、许可证、作者、派生关系与执行策略不能由 AI 或普通编辑覆盖。</span><button disabled={Boolean(busy) || JSON.stringify(draft) === JSON.stringify(current.draft)} onClick={() => void save(draft)}>保存为新 Revision</button></div>
          </>}
        </main>
        <aside className="creator-right">
          <section><span className="micro-label">AI CHANGESET</span><h3>对话修改，不直接写入</h3><textarea value={changeRequest} onChange={(e) => setChangeRequest(e.target.value)} placeholder="例如：把它改成适合产品运营周复盘，并要求保留指标出处…" /><button disabled={!current || Boolean(busy) || changeRequest.trim().length < 4} onClick={() => void propose()}>{busy === "propose" ? "正在生成 Diff…" : "生成修改提案"}</button>
          {proposal && <div className="creator-diff"><b>{proposal.diff.length} 处变化</b>{proposal.diff.map((item) => <article key={item.field}><strong>{item.field}</strong><del>{preview(item.before)}</del><ins>{preview(item.after)}</ins></article>)}<div><button onClick={() => setProposal(null)}>放弃</button><button className="primary" disabled={current?.revision !== proposal.baseRevision} onClick={() => void save(proposal.draft)}>确认并生成 Revision</button></div></div>}</section>
          <section><span className="micro-label">EVIDENCE GATES</span><h3>先检查，再发布</h3><button disabled={!current || Boolean(busy)} onClick={() => void evaluate("e1")}>① 运行 E1 结构/来源/风险检查</button><div className={`creator-eval ${e1?.status || "idle"}`}><b>{e1 ? `E1 · ${String(e1.result?.status || e1.status)}` : "E1 · 未检查"}</b>{issueList.map((item) => <p key={item.code}>{item.severity} · {item.message}</p>)}</div>
          <label>固定样例输入<textarea value={sampleInput} onChange={(e) => setSampleInput(e.target.value)} /></label><label>验收标准<textarea value={criteria} onChange={(e) => setCriteria(e.target.value)} /></label><button disabled={!current || !e1 || e1.status !== "passed" || Boolean(busy)} onClick={() => void evaluate("e2")}>② 运行 E2 无工具样例</button><div className={`creator-eval ${e2?.status || "idle"}`}><b>{e2 ? `E2 · ${e2.status}` : "E2 · 可选"}</b><p>{e2?.status === "blocked" ? "生产模型尚未配置；系统如实阻断，不伪造 Demo。" : String(e2?.result?.verdict || "E2 只验证固定样例，不等于真实效果。")}</p>{typeof e2?.result?.output === "string" && <details><summary>查看样例输出</summary><pre>{e2.result.output}</pre></details>}{e2Criteria.map((item) => <p key={item.criterion}>{item.passed ? "通过" : "未通过"} · {item.criterion}：{item.evidence}</p>)}</div></section>
          <section className="creator-publish"><span className="micro-label">IMMUTABLE RELEASE</span><label>版本号<input value={version} onChange={(e) => setVersion(e.target.value)} /></label>{current && !immutable && <div className="publish-preview"><b>{current.draft.canonicalName}</b><p>{current.draft.briefZh}</p><span>发布署名：{current.publisherName}（未认证）</span><span>来源：{current.draft.attribution.sourceUrl || "发布者原创声明"}</span><span>许可证：{current.draft.attribution.licenseSpdx || "缺失"}</span><span>作者/来源归属：{current.draft.attribution.originalAuthor || "发布者声明"}</span></div>}<label className="creator-check"><input type="checkbox" checked={publishConfirmed} disabled={!current || immutable} onChange={(event) => setPublishConfirmed(event.target.checked)} />我已核对名称、中文 Brief、发布署名、来源、作者归属和许可证；确认公开为不可变 Release。</label><button className="primary" disabled={!current || immutable || e1?.status !== "passed" || !publishConfirmed || Boolean(busy)} onClick={() => void publish()}>{immutable ? "已发布，不可修改" : busy === "publish" ? "原子发布中…" : "确认并发布公开 Release"}</button>{current?.published && <><button disabled={Boolean(busy)} onClick={() => onUseRelease({ source: "skillflow_creator", slug: current.slug, releaseId: current.published!.releaseId })}>重新核验并放进工作流 ↗</button><button disabled={Boolean(busy)} onClick={() => void createNextVersion()}>{busy === "next-version" ? "正在建立…" : "基于此 Release 创建下一版本"}</button></>}</section>
          {current?.published && current.source.url && <section className="creator-claim"><span className="micro-label">AUTHOR / REPOSITORY CLAIM</span><h3>申请来源认领</h3><p>平台会保留发布者署名与上游来源；只有核验完成后才会展示认证状态。</p>{current.claims.map((claim) => <div className="creator-eval" key={claim.id}><b>{claim.subjectName}</b><p>{claim.status} · {claim.claimType}</p></div>)}<label>认领对象<input value={claimSubject} onChange={(event) => setClaimSubject(event.target.value)} placeholder="作者、团队或仓库维护者名称" /></label><label>核验证据说明<textarea value={claimNote} onChange={(event) => setClaimNote(event.target.value)} placeholder="说明你与该仓库或来源的关系，以及可供平台核验的公开线索（至少 10 个字符）" /></label><button disabled={Boolean(busy) || claimSubject.trim().length < 2 || claimNote.trim().length < 10 || current.claims.some((claim) => claim.status === "pending")} onClick={() => void submitClaim()}>{busy === "claim" ? "正在提交…" : "提交待审核认领"}</button></section>}
        </aside>
      </div>
    </div>
  );
}
