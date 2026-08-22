"use client";

import { useMemo, useRef, useState } from "react";

type Evidence = { evidence_id: string; quote: string; interpretation: string; category: string; confidence: number };
type Theme = { theme_id: string; title: string; statement: string; supporting_evidence_ids: string[]; counter_evidence_ids: string[]; strength: string; product_implication: string; uncertainty: string };
type WorkflowNode = { node_id: string; work_step: string; current_method: string; ai_decision: string; decision_reason: string; ai_role: string; human_role: string; recommended_skill_slugs: string[]; risk_level: string; evidence_ids: string[]; success_check: string };
type Receipt = { runId: string; durationMs: number; usage: { inputTokens: number; outputTokens: number; totalTokens: number }; steps: { skillSlug: string; kind: string; durationMs: number; modelRun?: { provider: string; model: string } }[] };
type AnalysisResult = { normalized: { characterCount: number; lineCount: number }; analysis: { evidence: Evidence[]; themes: Theme[]; workflowNodes: WorkflowNode[] }; receipt: Receipt };
type Prd = { title: string; background: string; problem_statement: string; goal: string; target_users: string[]; non_goals: string[]; user_scenarios: string[]; requirements: { requirement_id: string; statement: string; rationale: string; priority: string; acceptance_criteria: string[]; evidence_ids: string[] }[]; success_metrics: { metric: string; definition: string; target: string | null; timeframe: string | null }[]; risks: { risk: string; mitigation: string }[]; rollout_plan: string[] };
type PrdResult = { prd: Prd; markdown: string; quality: { score: number; decision: string; issues: unknown[] }; receipt: Receipt };

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

const decisionLabels: Record<string, string> = { ai_first: "AI 优先处理", assistive_ai: "AI 辅助、人判断", do_not_use_ai: "不应交给 AI" };

export default function InterviewRunner({ onBack }: { onBack: () => void }) {
  const [researchGoal, setResearchGoal] = useState("找出产品经理在访谈分析中的低效节点，并形成可追溯的 PRD");
  const [productContext, setProductContext] = useState("面向互联网产品与运营团队的 AI Skill 工作台");
  const [transcript, setTranscript] = useState(sampleTranscript);
  const [fileName, setFileName] = useState("示例访谈.txt");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [approved, setApproved] = useState<string[]>([]);
  const [prd, setPrd] = useState<PrdResult | null>(null);
  const [status, setStatus] = useState<"idle" | "analyzing" | "generating">("idle");
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const approvedThemes = useMemo(() => analysis?.analysis.themes.filter((theme) => approved.includes(theme.theme_id)).map((theme) => ({ ...theme, approved_title: theme.title, approved_statement: theme.statement, approval_note: null })) || [], [analysis, approved]);

  async function readFile(file?: File) {
    if (!file) return;
    if (!/\.(txt|md)$/i.test(file.name)) {
      setError({ message: "当前真实运行先支持 .txt 与 .md；PDF、DOCX 解析会作为受控文件节点接入。" });
      return;
    }
    if (file.size > 100_000) {
      setError({ message: "文件不能超过 100 KB。" });
      return;
    }
    setTranscript(await file.text());
    setFileName(file.name);
    setError(null);
  }

  async function runAnalysis() {
    setStatus("analyzing");
    setError(null);
    setPrd(null);
    try {
      const response = await fetch("/api/runs/interview/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ researchGoal, transcript }),
      });
      const payload = await response.json() as AnalysisResult & { error?: { code?: string; message?: string } };
      if (!response.ok) throw Object.assign(new Error(payload.error?.message || "运行失败"), { code: payload.error?.code });
      setAnalysis(payload);
      setApproved(payload.analysis.themes.map((theme) => theme.theme_id));
    } catch (reason) {
      const typed = reason as Error & { code?: string };
      setError({ code: typed.code, message: typed.message || "运行失败" });
    } finally {
      setStatus("idle");
    }
  }

  async function generatePrd() {
    if (!analysis || !approvedThemes.length) return;
    setStatus("generating");
    setError(null);
    try {
      const response = await fetch("/api/runs/interview/prd", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          researchGoal,
          productContext,
          evidence: analysis.analysis.evidence,
          approvedThemes,
          workflowNodes: analysis.analysis.workflowNodes,
        }),
      });
      const payload = await response.json() as PrdResult & { error?: { code?: string; message?: string } };
      if (!response.ok) throw Object.assign(new Error(payload.error?.message || "PRD 生成失败"), { code: payload.error?.code });
      setPrd(payload);
    } catch (reason) {
      const typed = reason as Error & { code?: string };
      setError({ code: typed.code, message: typed.message || "PRD 生成失败" });
    } finally {
      setStatus("idle");
    }
  }

  function downloadMarkdown() {
    if (!prd) return;
    const url = URL.createObjectURL(new Blob([prd.markdown], { type: "text/markdown;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${prd.prd.title.replace(/[\\/:*?"<>|]/g, "-")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="runner-shell stage-enter">
      <div className="runner-top"><button onClick={onBack}>← 返回能力路径</button><div><span className="live-dot" /> 真实受控运行</div><small>不会执行任意第三方脚本</small></div>
      <div className="runner-head"><div><div className="micro-label">黄金工作流 01 · 互联网产品</div><h2>访谈原文进入，证据与 PRD 出来。</h2><p>模型只在两个分析节点与一个生成节点工作；主题确认、需求优先级和最终采用仍由人负责。</p></div><div className="runner-flow"><span>标准化</span><i>→</i><span>证据</span><i>→</i><span>洞察</span><i>→</i><b>人确认</b><i>→</i><span>PRD</span></div></div>

      <div className="runner-grid">
        <section className="runner-input-panel">
          <label>本次研究目标<input value={researchGoal} onChange={(event) => setResearchGoal(event.target.value)} maxLength={800} /></label>
          <label>产品背景<input value={productContext} onChange={(event) => setProductContext(event.target.value)} maxLength={4000} /></label>
          <div className="file-row"><span><strong>{fileName}</strong><small>{transcript.length.toLocaleString()} 字符 · 浏览器本地读取</small></span><button onClick={() => fileRef.current?.click()}>选择 .txt / .md</button><input ref={fileRef} hidden type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(event) => void readFile(event.target.files?.[0])} /></div>
          <label>访谈原文<textarea value={transcript} onChange={(event) => { setTranscript(event.target.value); setFileName("手动粘贴"); }} /></label>
          <button className="runner-run" disabled={status !== "idle" || transcript.trim().length < 80} onClick={() => void runAnalysis()}>{status === "analyzing" ? "真实模型正在提取证据…" : analysis ? "重新运行分析" : "运行 3 个受控节点 ↗"}</button>
          <p className="runner-privacy">输入会发给服务端配置的外部模型处理；运行请求设置为不存储。页面不会接收或显示模型密钥。</p>
        </section>

        <section className="runner-results">
          {error && <div className="runner-error"><strong>{error.code === "MODEL_NOT_CONFIGURED" ? "运行层尚未配置" : "运行没有完成"}</strong><p>{error.message}</p>{error.code === "MODEL_NOT_CONFIGURED" && <small>这不是样例降级：没有真实模型时，系统明确拒绝伪造结果。</small>}</div>}
          {!analysis && !error && <div className="runner-empty"><span>⌁</span><strong>等待真实材料</strong><p>运行后这里会显示可回到原文的逐字证据、工作节点的 AI 边界和真实模型回执。</p></div>}
          {analysis && (
            <>
              <div className="result-summary"><div><small>已核验证据</small><strong>{analysis.analysis.evidence.length}</strong></div><div><small>洞察主题</small><strong>{analysis.analysis.themes.length}</strong></div><div><small>工作节点</small><strong>{analysis.analysis.workflowNodes.length}</strong></div><div><small>模型 Token</small><strong>{analysis.receipt.usage.totalTokens}</strong></div></div>
              <div className="runner-section-title"><span>01 · 逐字证据</span><small>每条 quote 已通过原文连续子串校验</small></div>
              <div className="evidence-list">{analysis.analysis.evidence.map((item) => <article key={item.evidence_id}><span>{item.evidence_id}</span><blockquote>“{item.quote}”</blockquote><p>{item.interpretation}</p><small>{item.category} · 置信度 {Math.round(item.confidence * 100)}%</small></article>)}</div>
              <div className="runner-section-title"><span>02 · 工作节点 AI 边界</span><small>不是每个节点都应该自动化</small></div>
              <div className="ai-node-list">{analysis.analysis.workflowNodes.map((node) => <article key={node.node_id} className={node.ai_decision}><div><span>{decisionLabels[node.ai_decision] || node.ai_decision}</span><strong>{node.work_step}</strong></div><p>{node.decision_reason}</p><small>人类职责：{node.human_role}</small><em>{node.recommended_skill_slugs.join(" · ") || "不绑定 Skill"}</em></article>)}</div>
              <div className="runner-section-title"><span>03 · 人工确认洞察</span><small>至少确认一个主题才能生成 PRD</small></div>
              <div className="theme-list">{analysis.analysis.themes.map((theme) => <label key={theme.theme_id} className={approved.includes(theme.theme_id) ? "approved" : ""} htmlFor={`theme-${theme.theme_id}`}><input id={`theme-${theme.theme_id}`} aria-label={`确认主题：${theme.title}`} type="checkbox" checked={approved.includes(theme.theme_id)} onChange={() => setApproved((items) => items.includes(theme.theme_id) ? items.filter((id) => id !== theme.theme_id) : [...items, theme.theme_id])} /><span><strong>{theme.title}</strong><p>{theme.statement}</p><small>{theme.supporting_evidence_ids.join(" · ")} · {theme.product_implication}</small></span></label>)}</div>
              <button className="generate-prd" disabled={!approvedThemes.length || status !== "idle"} onClick={() => void generatePrd()}>{status === "generating" ? "正在生成并检查 PRD…" : `确认 ${approvedThemes.length} 个主题并生成 PRD ↗`}</button>
              <RunReceipt receipt={analysis.receipt} title="分析运行回执" />
            </>
          )}
        </section>
      </div>

      {prd && <section className="prd-result"><div className="prd-toolbar"><div><small>真实交付物 · 质量 {prd.quality.score}/100 · {prd.quality.decision}</small><h3>{prd.prd.title}</h3></div><button onClick={downloadMarkdown}>下载 PRD.md ↓</button></div><p className="prd-summary">{prd.prd.background}</p><div className="prd-columns"><section><b>问题定义</b><p>{prd.prd.problem_statement}</p><b>目标</b><p>• {prd.prd.goal}</p></section><section><b>需求与验收</b>{prd.prd.requirements.map((item) => <article key={item.requirement_id}><span>{item.priority}</span><strong>{item.requirement_id} · {item.statement}</strong><p>{item.rationale}</p><small>证据：{item.evidence_ids.join("、")}</small></article>)}</section><section><b>风险与边界</b>{prd.prd.risks.map((item) => <p key={item.risk}>• {item.risk}；{item.mitigation}</p>)}<b>成功指标</b>{prd.prd.success_metrics.map((item) => <p key={item.metric}>• {item.metric}：{item.definition}</p>)}</section></div><RunReceipt receipt={prd.receipt} title="PRD 生成回执" /></section>}
    </div>
  );
}

function RunReceipt({ receipt, title }: { receipt: Receipt; title: string }) {
  return <details className="run-receipt"><summary>{title}<span>{receipt.steps.length} 步 · {receipt.durationMs} ms · {receipt.usage.totalTokens} tokens</span></summary><div>{receipt.steps.map((step, index) => <p key={`${step.skillSlug}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step.skillSlug}</strong><em>{step.kind === "model" ? `${step.modelRun?.provider || "model"} · ${step.modelRun?.model || "configured-model"}` : "确定性节点"}</em><small>{step.durationMs} ms</small></p>)}</div></details>;
}
