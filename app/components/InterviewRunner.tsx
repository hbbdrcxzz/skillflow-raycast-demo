"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Evidence = { evidence_id: string; quote: string; interpretation: string; category: string; confidence: number };
type Theme = { theme_id: string; title: string; statement: string; supporting_evidence_ids: string[]; product_implication: string };
type ApprovedTheme = Theme & { approved_title?: string; approved_statement?: string };
type WorkflowNode = { node_id: string; work_step: string; ai_decision: string; decision_reason: string; human_role: string; recommended_skill_slugs: string[] };
type Step = { id: string; stepKey: string; sequence: number; attempt: number; status: string; receipt?: { modelRun?: { model?: string; usage?: { totalTokens?: number } } } };
type RunBundle = {
  run: { id: string; status: string; currentSequence: number; input: Record<string, unknown>; output?: { artifactId?: string; qualityDecision?: string }; error?: { code?: string; message?: string } };
  steps: Step[];
  approvals: { id: string; status: string; payloadDigest: string; revision: number }[];
  artifacts: { id: string; name: string; status: string; metadata?: { purpose?: string; quality?: string } }[];
  data?: {
    extracted_evidence?: { evidence_items: Evidence[] };
    clustered_insights?: { themes: Theme[] };
    workflow_assessment?: { workflow_nodes: WorkflowNode[] };
    approved_analysis?: { evidence: (Evidence & { provenance?: string })[]; approvedThemes: ApprovedTheme[]; workflowNodes: WorkflowNode[] };
    prd_result?: string;
    quality_report?: { quality?: { score?: number; decision?: string; issues?: { issue_id: string; severity: string; location: string; reason: string; suggested_fix: string }[] } };
  };
};

const sampleTranscript = `访谈员：你每周怎么处理用户访谈？
产品经理：访谈结束后我会把逐字稿贴到文档，再手工复制关键段落到表格。每次大概两小时。
访谈员：最难的是什么？
产品经理：不是总结，而是判断哪条结论真的有证据。AI 如果把我的概括当成用户原话，我就不敢用。
访谈员：你会怎么检查？
产品经理：我会逐条回到原文。如果每个洞察能带上原话和位置，我愿意让 AI 先做第一遍。
访谈员：哪些事情不能交给 AI？
产品经理：需求优先级和要不要立项必须由我和团队决定。AI 可以整理、聚类、写初稿，但不能替我拍板。
访谈员：最后通常产出什么？
产品经理：一份洞察文档，有时再写成 PRD。两个文档之间重复复制很多，而且需求和原始证据经常断掉。`;

const stageLabels: Record<string, string> = {
  normalize: "材料标准化", extract_evidence: "逐字证据", cluster_insights: "洞察聚类",
  assess_workflow_ai: "AI 边界", approve_themes: "人工确认", generate_prd: "PRD 初稿", quality_review: "质量检查",
};
const decisionLabels: Record<string, string> = { ai_first: "AI 优先处理", assistive_ai: "AI 辅助、人判断", do_not_use_ai: "不应交给 AI" };
const runLabels: Record<string, string> = { provisioning: "正在建立", queued: "等待继续", running: "运行中", awaiting_approval: "等待你确认", succeeded: "已完成", partial_failed: "草稿需修订", failed: "失败可重试", cancelled: "已取消", blocked: "已阻断" };
const stepLabels: Record<string, string> = { queued: "等待执行", running: "执行中", awaiting_approval: "等待确认", succeeded: "已完成", partial_failed: "需修订", failed: "失败", cancelled: "已取消", blocked: "已失效" };

export default function InterviewRunner({ workflowVersionId, initialRunId, onBack }: {
  workflowVersionId?: string | null;
  initialRunId?: string | null;
  onBack: () => void;
}) {
  const [researchGoal, setResearchGoal] = useState("找出产品经理在访谈分析中的低效节点，并形成可追溯的 PRD");
  const [productContext, setProductContext] = useState("面向互联网产品与运营团队的 AI Skill 工作台");
  const [transcript, setTranscript] = useState(sampleTranscript);
  const [fileName, setFileName] = useState("官方样例访谈.txt");
  const [disclosureAccepted, setDisclosureAccepted] = useState(false);
  const [bundle, setBundle] = useState<RunBundle | null>(null);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [themeEdits, setThemeEdits] = useState<Record<string, { title: string; statement: string }>>({});
  const [evidenceDecisions, setEvidenceDecisions] = useState<Record<string, { decision: "accepted" | "rejected"; interpretation: string }>>({});
  const [addedEvidence, setAddedEvidence] = useState<{ quote: string; interpretation: string; category: string }[]>([]);
  const [addedThemes, setAddedThemes] = useState<{ title: string; statement: string; supportingEvidenceIds: string; productImplication: string }[]>([]);
  const [busy, setBusy] = useState<"creating" | "advancing" | "approving" | "cancelling" | "revising" | null>(null);
  const [runtimeConfig, setRuntimeConfig] = useState<"probing" | "ready" | "unconfigured">("probing");
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const createIdempotencyRef = useRef<string | null>(null);
  const hydratedApprovalRef = useRef<string | null>(null);

  const refreshRun = useCallback(async (runId: string) => {
    const response = await fetch(`/api/runs/interview/${encodeURIComponent(runId)}`, { cache: "no-store" });
    const payload = await response.json() as RunBundle & { error?: { code?: string; message?: string } };
    if (!response.ok) throw Object.assign(new Error(payload.error?.message || "无法重新打开运行"), { code: payload.error?.code });
    const pendingApproval = payload.approvals.find((item) => item.status === "pending");
    const previous = payload.data?.approved_analysis;
    if (pendingApproval && previous && hydratedApprovalRef.current !== pendingApproval.id) {
      hydratedApprovalRef.current = pendingApproval.id;
      const sourceEvidence = payload.data?.extracted_evidence?.evidence_items || [];
      const sourceThemes = payload.data?.clustered_insights?.themes || [];
      const previousEvidence = new Map(previous.evidence.map((item) => [item.evidence_id, item]));
      setEvidenceDecisions(Object.fromEntries(sourceEvidence.map((item) => {
        const approved = previousEvidence.get(item.evidence_id);
        return [item.evidence_id, { decision: approved ? "accepted" : "rejected", interpretation: approved?.interpretation || item.interpretation }];
      })) as Record<string, { decision: "accepted" | "rejected"; interpretation: string }>);
      setAddedEvidence(previous.evidence.filter((item) => item.provenance === "user_supplied" || item.evidence_id.startsWith("user-ev-"))
        .map((item) => ({ quote: item.quote, interpretation: item.interpretation, category: item.category })));
      const originalThemeIds = new Set(sourceThemes.map((item) => item.theme_id));
      const previousThemeById = new Map(previous.approvedThemes.map((item) => [item.theme_id, item]));
      setSelectedThemes(sourceThemes.filter((item) => previousThemeById.has(item.theme_id)).map((item) => item.theme_id));
      setThemeEdits(Object.fromEntries(sourceThemes.flatMap((item) => {
        const approved = previousThemeById.get(item.theme_id);
        return approved ? [[item.theme_id, { title: approved.approved_title || approved.title, statement: approved.approved_statement || approved.statement }]] : [];
      })));
      setAddedThemes(previous.approvedThemes.filter((item) => !originalThemeIds.has(item.theme_id)).map((item) => ({
        title: item.approved_title || item.title,
        statement: item.approved_statement || item.statement,
        supportingEvidenceIds: item.supporting_evidence_ids.join(", "),
        productImplication: item.product_implication || "",
      })));
    }
    setBundle(payload);
    return payload;
  }, []);

  useEffect(() => {
    fetch("/api/runs/interview/config", { cache: "no-store" }).then((response) => response.json())
      .then((payload: { configured?: boolean }) => setRuntimeConfig(payload.configured ? "ready" : "unconfigured"))
      .catch(() => setRuntimeConfig("unconfigured"));
  }, []);

  useEffect(() => {
    if (!initialRunId) return;
    void Promise.resolve().then(async () => {
      const fresh = await refreshRun(initialRunId);
      if (fresh.run.status === "awaiting_approval") {
        await fetch(`/api/runs/interview/${encodeURIComponent(initialRunId)}/advance`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
        await refreshRun(initialRunId);
      }
    })
      .catch((reason: Error & { code?: string }) => setError({ code: reason.code, message: reason.message }));
  }, [initialRunId, refreshRun]);

  const evidence = bundle?.data?.extracted_evidence?.evidence_items || [];
  const themes = bundle?.data?.clustered_insights?.themes || [];
  const workflowNodes = bundle?.data?.workflow_assessment?.workflow_nodes || [];
  const currentApproval = bundle?.approvals.find((item) => item.status === "pending") || null;
  const outputArtifact = bundle?.artifacts.find((item) => item.status === "ready" && item.metadata?.purpose === "prd_result");
  const quality = bundle?.data?.quality_report?.quality;
  const tokenTotal = useMemo(() => bundle?.steps.reduce((sum, step) => sum + Number(step.receipt?.modelRun?.usage?.totalTokens || 0), 0) || 0, [bundle]);

  async function readFile(file?: File) {
    if (!file) return;
    if (!/\.(txt|md)$/i.test(file.name)) return setError({ message: "当前沙箱只支持 UTF-8 的 .txt 与 .md 副本。" });
    if (file.size > 100_000) return setError({ message: "文件实际大小不能超过 100 KB。" });
    let value: string;
    try {
      value = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    } catch {
      return setError({ code: "INVALID_UTF8", message: "文件不是有效的 UTF-8 文本，请先转换编码。" });
    }
    if (value.includes("\u0000")) return setError({ message: "文件包含不支持的二进制或 NUL 字符。" });
    setTranscript(value); setFileName(file.name); setError(null);
  }

  async function advanceUntilPause(runId: string) {
    setBusy("advancing");
    try {
      for (let index = 0; index < 8; index += 1) {
        const response = await fetch(`/api/runs/interview/${encodeURIComponent(runId)}/advance`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
        const payload = await response.json() as { error?: { code?: string; message?: string } };
        if (!response.ok) throw Object.assign(new Error(payload.error?.message || "运行步骤失败"), { code: payload.error?.code });
        const fresh = await refreshRun(runId);
        if (["awaiting_approval", "succeeded", "partial_failed", "failed", "cancelled"].includes(fresh.run.status)) return;
      }
      throw new Error("运行超过本次允许的步骤数，请重新打开任务查看状态");
    } finally { setBusy(null); }
  }

  async function createRun() {
    if (!workflowVersionId) return setError({ code: "WORKFLOW_REQUIRED", message: "请先保存一个可运行的访谈工作流。" });
    setBusy("creating"); setError(null);
    try {
      createIdempotencyRef.current ||= `create-${workflowVersionId}-${crypto.randomUUID()}`;
      const response = await fetch("/api/runs/interview", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ workflowVersionId, researchGoal, productContext, transcript, fileName, disclosureAccepted, idempotencyKey: createIdempotencyRef.current }),
      });
      const payload = await response.json() as { run?: { id: string }; error?: { code?: string; message?: string } };
      if (!response.ok || !payload.run) throw Object.assign(new Error(payload.error?.message || "无法创建运行"), { code: payload.error?.code });
      createIdempotencyRef.current = null;
      await refreshRun(payload.run.id);
      await advanceUntilPause(payload.run.id);
    } catch (reason) {
      const typed = reason as Error & { code?: string };
      setError({ code: typed.code, message: typed.message });
    } finally { setBusy(null); }
  }

  async function approveAndContinue() {
    if (!bundle || !currentApproval || !selectedThemes.length && !addedThemes.length) return;
    setBusy("approving"); setError(null);
    try {
      const response = await fetch(`/api/runs/interview/${encodeURIComponent(bundle.run.id)}/approval`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          expectedPayloadDigest: currentApproval.payloadDigest, selectedThemeIds: selectedThemes, themeEdits, evidenceDecisions, addedEvidence,
          addedThemes: addedThemes.map((item) => ({ ...item, supportingEvidenceIds: item.supportingEvidenceIds.split(/[，,\s]+/).filter(Boolean) })),
        }),
      });
      const payload = await response.json() as { error?: { code?: string; message?: string } };
      if (!response.ok) throw Object.assign(new Error(payload.error?.message || "确认失败"), { code: payload.error?.code });
      await refreshRun(bundle.run.id);
      await advanceUntilPause(bundle.run.id);
    } catch (reason) {
      const typed = reason as Error & { code?: string };
      if (typed.code === "STALE_APPROVAL" && bundle) {
        await fetch(`/api/runs/interview/${encodeURIComponent(bundle.run.id)}/advance`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
        await refreshRun(bundle.run.id);
        setSelectedThemes([]); setThemeEdits({}); setEvidenceDecisions({}); setAddedEvidence([]); setAddedThemes([]);
      }
      setError({ code: typed.code, message: typed.message });
    } finally { setBusy(null); }
  }

  async function cancelRun() {
    if (!bundle) return;
    setBusy("cancelling"); setError(null);
    try {
      const response = await fetch(`/api/runs/interview/${encodeURIComponent(bundle.run.id)}/cancel`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const payload = await response.json() as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "无法取消");
      await refreshRun(bundle.run.id);
    } catch (reason) { setError({ message: reason instanceof Error ? reason.message : "无法取消" }); }
    finally { setBusy(null); }
  }

  async function resumeCurrent() {
    if (!bundle) return;
    setError(null);
    try { await advanceUntilPause(bundle.run.id); }
    catch (reason) {
      const typed = reason as Error & { code?: string };
      await refreshRun(bundle.run.id).catch(() => undefined);
      setError({ code: typed.code, message: typed.message });
    }
  }

  async function reopenApproval() {
    if (!bundle) return;
    setBusy("revising"); setError(null);
    try {
      const response = await fetch(`/api/runs/interview/${encodeURIComponent(bundle.run.id)}/approval/revise`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const payload = await response.json() as { error?: { code?: string; message?: string } };
      if (!response.ok) throw Object.assign(new Error(payload.error?.message || "无法重新打开人工确认"), { code: payload.error?.code });
      setSelectedThemes([]); setThemeEdits({}); setEvidenceDecisions({}); setAddedEvidence([]); setAddedThemes([]);
      await refreshRun(bundle.run.id);
    } catch (reason) {
      const typed = reason as Error & { code?: string };
      setError({ code: typed.code, message: typed.message });
    } finally { setBusy(null); }
  }

  return <div className="runner-shell stage-enter">
    <div className="runner-top"><button onClick={onBack}>← 返回工作台</button><div><span className="live-dot" /> 持久化受控沙箱{runtimeConfig === "unconfigured" && <em className="runtime-badge">服务端模型未配置</em>}</div><small>内建白名单 · 无第三方脚本 · 无外部写入</small></div>
    <div className="runner-head"><div><div className="micro-label">GATE D · 黄金工作流 01 · 一个长期 Run</div><h2>每一步都留下证据，刷新后仍能继续。</h2><p>只有服务器提交 WorkflowVersion、Approval、Artifact 和运行回执后，页面才会显示保存、确认或完成。</p></div><div className="runner-flow">{Object.entries(stageLabels).map(([key, label], index) => <span key={key} className={bundle?.steps.find((item) => item.stepKey === key)?.status || "queued"}>{index + 1} · {label}</span>)}</div></div>

    {!bundle ? <div className="runner-grid">
      <section className="runner-input-panel">
        <label>本次研究目标<input value={researchGoal} onChange={(event) => setResearchGoal(event.target.value)} maxLength={800} /></label>
        <label>产品背景<input value={productContext} onChange={(event) => setProductContext(event.target.value)} maxLength={4000} /></label>
        <div className="file-row"><span><strong>{fileName}</strong><small>{transcript.length.toLocaleString()} 字符 · 将保存一份私有副本</small></span><button onClick={() => fileRef.current?.click()}>选择 .txt / .md</button><input ref={fileRef} hidden type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(event) => void readFile(event.target.files?.[0])} /></div>
        <label>访谈原文<textarea value={transcript} onChange={(event) => { setTranscript(event.target.value); setFileName("手动粘贴.txt"); }} /></label>
        <label className="runner-disclosure"><input type="checkbox" checked={disclosureAccepted} onChange={(event) => setDisclosureAccepted(event.target.checked)} /><span>我确认材料会发送给服务端配置的外部模型，可能发生跨境处理；其中不包含不应上传的秘密或敏感个人信息。</span></label>
        <button className="runner-run" disabled={Boolean(busy) || runtimeConfig !== "ready" || !disclosureAccepted || transcript.trim().length < 80 || !workflowVersionId} onClick={() => void createRun()}>{busy === "creating" ? "正在保存材料与建立 Run…" : "保存材料并开始真实运行 ↗"}</button>
        {!workflowVersionId && <p className="runner-privacy">没有可运行 WorkflowVersion。请返回编排页，选择内建 Runtime Skill 并保存。</p>}
      </section>
      <section className="runner-results"><div className="runner-empty"><span>⌁</span><strong>官方“访谈到 PRD”固定 Pack</strong><p>你选择的入口 Skill 会明确展开为上方七个受控阶段；本 Gate 不会把任意 Skill 选择偷换成隐藏流水线。系统还会冻结七个 Release、材料摘要、跨境披露与无副作用策略。</p></div></section>
    </div> : <div className="runner-live-layout">
      <aside className="runner-timeline"><div><small>RUN</small><strong>{bundle.run.id.slice(0, 22)}…</strong><span className={`run-state ${bundle.run.status}`}>{runLabels[bundle.run.status] || "未知状态"}</span></div>{bundle.steps.map((step) => <article key={`${step.id}-${step.attempt}`} className={step.status}><span>{String(step.sequence + 1).padStart(2, "0")}</span><div><strong>{stageLabels[step.stepKey] || "未知节点"}</strong><small>{stepLabels[step.status] || "未知状态"} · 第 {step.attempt} 次尝试{step.receipt?.modelRun?.model ? ` · ${step.receipt.modelRun.model}` : ""}</small></div></article>)}<p>{tokenTotal.toLocaleString()} tokens · 状态来自 D1，不用定时器伪造</p>{["queued", "running"].includes(bundle.run.status) && <button onClick={() => void resumeCurrent()} disabled={Boolean(busy)}>{bundle.run.status === "running" ? "刷新或恢复中断" : "继续执行"}</button>}{!["succeeded", "cancelled"].includes(bundle.run.status) && <button onClick={() => void cancelRun()} disabled={Boolean(busy)}>取消运行</button>}</aside>
      <section className="runner-results">
        {bundle.run.status === "provisioning" && <div className="runner-error"><strong>任务建立过程被中断</strong><p>该状态不能继续执行。请取消这条记录后，从已保存工作流重新上传材料；已经提交的私有副本不会被当作成功结果。</p><button onClick={() => void cancelRun()} disabled={Boolean(busy)}>取消并释放运行名额</button></div>}
        {busy === "advancing" && <div className="runner-progress"><span className="live-dot" /><strong>正在执行并提交当前节点</strong><p>每次只认领一个节点；成功回执落库后才进入下一步。</p></div>}
        {error && <div className="runner-error" role="alert"><strong>{error.code || "运行没有完成"}</strong><p>{error.message}</p></div>}
        {(bundle.run.status === "failed" || bundle.run.status === "partial_failed" && bundle.run.currentSequence < 7) && <div className="runner-error"><strong>已保留完成的节点</strong><p>{bundle.run.error?.message || "当前节点失败，可以生成新的尝试。"}</p><button onClick={() => void resumeCurrent()} disabled={Boolean(busy)}>从失败节点重试</button></div>}
        {evidence.length > 0 && <><div className="result-summary"><div><small>逐字证据</small><strong>{evidence.length}</strong></div><div><small>洞察主题</small><strong>{themes.length}</strong></div><div><small>工作节点</small><strong>{workflowNodes.length}</strong></div><div><small>模型 Token</small><strong>{tokenTotal}</strong></div></div><div className="runner-section-title"><span>逐字证据</span><small>quote 已与本 Run 的持久化原文做连续子串校验</small></div><div className="evidence-list">{evidence.map((item) => <article key={item.evidence_id}><span>{item.evidence_id}</span><blockquote>“{item.quote}”</blockquote><p>{item.interpretation}</p><small>{item.category} · {Math.round(item.confidence * 100)}%</small></article>)}</div></>}
        {workflowNodes.length > 0 && <><div className="runner-section-title"><span>工作节点 AI 边界</span><small>AI 不替用户拍板</small></div><div className="ai-node-list">{workflowNodes.map((node) => <article key={node.node_id} className={node.ai_decision}><div><span>{decisionLabels[node.ai_decision] || node.ai_decision}</span><strong>{node.work_step}</strong></div><p>{node.decision_reason}</p><small>人的责任：{node.human_role}</small><em>{node.recommended_skill_slugs.join(" · ") || "不绑定 Skill"}</em></article>)}</div></>}
        {bundle.run.status === "awaiting_approval" && currentApproval && <section className="approval-studio"><div className="runner-section-title"><span>人工确认 · 默认不批准 · 修订 V{bundle.approvals[0]?.id ? bundle.approvals.length : 1}</span><small>确认绑定 payload digest，旧页面不能重放</small></div><p>逐条接受或拒绝证据，只能修改解释，不能改写成“用户原话”；也可以从已保存原文补证据并新增主题。</p><div className="approval-evidence-list">{evidence.map((item) => { const decision = evidenceDecisions[item.evidence_id] || { decision: "accepted" as const, interpretation: item.interpretation }; return <label key={item.evidence_id} className={decision.decision === "accepted" ? "approved" : "rejected"}><input type="checkbox" checked={decision.decision === "accepted"} onChange={(event) => setEvidenceDecisions((items) => ({ ...items, [item.evidence_id]: { ...decision, decision: event.target.checked ? "accepted" : "rejected" } }))} /><span><strong>{item.evidence_id} · “{item.quote}”</strong><textarea aria-label={`${item.evidence_id}证据解释`} value={decision.interpretation} onChange={(event) => setEvidenceDecisions((items) => ({ ...items, [item.evidence_id]: { ...decision, interpretation: event.target.value } }))} /></span></label>; })}</div><button className="ghost" type="button" onClick={() => setAddedEvidence((items) => [...items, { quote: "", interpretation: "", category: "need" }].slice(0, 5))}>＋ 从原文补一条证据</button>{addedEvidence.map((item, index) => <div className="approval-add-row" key={`added-evidence-${index}`}><input placeholder="粘贴原文中的连续片段" value={item.quote} onChange={(event) => setAddedEvidence((items) => items.map((value, itemIndex) => itemIndex === index ? { ...value, quote: event.target.value } : value))} /><input placeholder="这条证据说明什么" value={item.interpretation} onChange={(event) => setAddedEvidence((items) => items.map((value, itemIndex) => itemIndex === index ? { ...value, interpretation: event.target.value } : value))} /><select value={item.category} onChange={(event) => setAddedEvidence((items) => items.map((value, itemIndex) => itemIndex === index ? { ...value, category: event.target.value } : value))}><option value="need">需求</option><option value="behavior">行为</option><option value="pain_point">痛点</option><option value="counterexample">反例</option></select></div>)}<div className="theme-list">{themes.map((theme) => <label key={theme.theme_id} className={selectedThemes.includes(theme.theme_id) ? "approved" : ""}><input type="checkbox" checked={selectedThemes.includes(theme.theme_id)} onChange={() => setSelectedThemes((items) => items.includes(theme.theme_id) ? items.filter((id) => id !== theme.theme_id) : [...items, theme.theme_id])} /><span><input aria-label={`${theme.title}标题`} value={themeEdits[theme.theme_id]?.title || theme.title} onChange={(event) => setThemeEdits((items) => ({ ...items, [theme.theme_id]: { title: event.target.value, statement: items[theme.theme_id]?.statement || theme.statement } }))} /><textarea aria-label={`${theme.title}表述`} value={themeEdits[theme.theme_id]?.statement || theme.statement} onChange={(event) => setThemeEdits((items) => ({ ...items, [theme.theme_id]: { title: items[theme.theme_id]?.title || theme.title, statement: event.target.value } }))} /><small>{theme.supporting_evidence_ids.join(" · ")} · {theme.product_implication}</small></span></label>)}</div><button className="ghost" type="button" onClick={() => setAddedThemes((items) => [...items, { title: "", statement: "", supportingEvidenceIds: "", productImplication: "" }].slice(0, 3))}>＋ 新增人工主题</button>{addedThemes.map((item, index) => <div className="approval-add-theme" key={`added-theme-${index}`}><input placeholder="主题标题" value={item.title} onChange={(event) => setAddedThemes((items) => items.map((value, itemIndex) => itemIndex === index ? { ...value, title: event.target.value } : value))} /><textarea placeholder="主题表述" value={item.statement} onChange={(event) => setAddedThemes((items) => items.map((value, itemIndex) => itemIndex === index ? { ...value, statement: event.target.value } : value))} /><input placeholder="绑定证据 ID，用逗号分隔" value={item.supportingEvidenceIds} onChange={(event) => setAddedThemes((items) => items.map((value, itemIndex) => itemIndex === index ? { ...value, supportingEvidenceIds: event.target.value } : value))} /></div>)}<button className="generate-prd" disabled={!selectedThemes.length && !addedThemes.length || Boolean(busy)} onClick={() => void approveAndContinue()}>{busy === "approving" ? "正在提交不可变确认…" : `明确确认 ${selectedThemes.length + addedThemes.length} 个主题并继续 ↗`}</button></section>}
        {["succeeded", "partial_failed"].includes(bundle.run.status) && bundle.data?.prd_result && <section className="prd-result"><div className="prd-toolbar"><div><small>已提交 Artifact · {quality?.decision || bundle.run.output?.qualityDecision} · {quality?.score ?? "—"}/100</small><h3>{outputArtifact?.name || "可评审 PRD 草稿"}</h3></div><div>{outputArtifact && <a className="generate-prd" href={`/api/artifacts/${encodeURIComponent(outputArtifact.id)}/download`}>下载 PRD.md ↓</a>}<button className="ghost" onClick={() => void reopenApproval()} disabled={Boolean(busy)}>{busy === "revising" ? "正在建立新修订…" : "修改证据或主题"}</button></div></div>{bundle.run.status === "partial_failed" && <div className="runner-error"><strong>质检没有通过，但草稿没有被隐藏</strong><p>这不是执行失败；请按下方质量问题修订工作流或确认内容后重新生成。</p></div>}{quality?.issues?.length ? <div className="quality-issues">{quality.issues.map((issue) => <article key={issue.issue_id}><strong>{issue.severity} · {issue.location}</strong><p>{issue.reason}</p><small>{issue.suggested_fix}</small></article>)}</div> : null}<pre className="artifact-preview">{bundle.data.prd_result}</pre></section>}
        {bundle.run.status === "cancelled" && <div className="runner-empty"><strong>运行已取消</strong><p>迟到结果不能覆盖 cancelled；已提交步骤和回执仍保留。</p></div>}
      </section>
    </div>}
  </div>;
}
