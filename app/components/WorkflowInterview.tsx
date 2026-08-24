"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  interviewFactFields,
  type AbstractWorkflow,
  type InterviewFact,
  type InterviewFactStatus as FactStatus,
  type InterviewSnapshot,
} from "@/lib/gate-b-contracts";

export type { AbstractWorkflow, InterviewSnapshot } from "@/lib/gate-b-contracts";

type ApiPayload = {
  snapshot?: InterviewSnapshot;
  receipt?: unknown;
  workflow?: AbstractWorkflow;
  error?: { code?: string; message?: string };
};

type WorkflowInterviewProps = {
  initialGoal?: string;
  onBack: () => void;
  onConfirmed?: (snapshot: InterviewSnapshot, workflow: AbstractWorkflow) => void;
};

const FIELD_LABELS: Record<string, string> = {
  goal: "工作目标",
  steps: "当前步骤",
  trigger: "开始条件",
  inputs: "输入材料",
  inputSources: "输入材料",
  systems: "涉及系统",
  tools: "当前工具",
  output: "期望输出",
  expectedOutput: "期望输出",
  audience: "结果使用者",
  outputAudience: "结果使用者",
  acceptance: "验收标准",
  successCriteria: "验收标准",
  frequency: "发生频率",
  timeCost: "当前耗时",
  humanApprovals: "人工确认点",
  approvals: "人工确认点",
  exceptions: "异常情况",
  sensitiveData: "敏感信息",
  exceptionsAndSensitiveData: "异常与敏感信息",
  current_step: "当前步骤",
  input_system: "输入系统",
  input_data: "输入材料",
  output_consumer: "结果使用者",
  acceptance_criterion: "验收标准",
  volume: "工作量",
  duration: "当前耗时",
  tool: "当前工具",
  responsible_person: "负责人",
  human_approval: "人工确认点",
  exception_case: "异常情况",
  sensitive_boundary: "敏感边界",
  currentProcess: "当前流程",
  outputConsumers: "结果使用者",
  acceptanceCriteria: "验收标准",
  cadence: "频率与耗时",
  ownersAndApprovals: "负责人和确认点",
  sensitiveBoundaries: "敏感边界",
  assumptions: "AI 推断",
  unknowns: "待确认信息",
};

const COVERAGE_FIELDS = interviewFactFields;

const STATUS_META: Record<FactStatus, { label: string; hint: string }> = {
  user_confirmed: { label: "你已确认", hint: "来自你的原话或由你明确确认" },
  system_inferred: { label: "AI 推断", hint: "只是推断，需要你确认或修改" },
  unknown: { label: "待了解", hint: "尚未获得足够信息" },
  conflicted: { label: "有冲突", hint: "不同表述不一致，需要你裁定" },
};

const AI_SUITABILITY_LABELS: Record<AbstractWorkflow["nodes"][number]["aiSuitability"], string> = {
  do_not_use_ai: "不应交给 AI",
  ai_assist: "AI 辅助",
  ai_first_with_human_review: "AI 优先 · 人工复核",
  needs_analysis: "仍需分析",
};

const RISK_LABELS: Record<AbstractWorkflow["nodes"][number]["riskLevel"], string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
};

function factText(value: InterviewFact["value"]) { return value; }

function fieldLabel(field: string) {
  return FIELD_LABELS[field] || field.replaceAll("_", " ");
}

function messageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function contractEntries(contract: InterviewSnapshot["taskContract"]) {
  return Object.entries(contract).filter(([key, value]) =>
    key !== "status" && key !== "factDigest" && value !== null && value !== undefined && value !== "" && (!Array.isArray(value) || value.length),
  );
}

function contractValue(value: unknown) {
  if (!Array.isArray(value)) return typeof value === "object" ? JSON.stringify(value) : String(value);
  return value.flatMap((item) => {
    if (item && typeof item === "object" && "value" in item && typeof item.value === "string") return [item.value];
    return typeof item === "string" ? [item] : [];
  }).join("、");
}

export default function WorkflowInterview({ initialGoal = "", onBack, onConfirmed }: WorkflowInterviewProps) {
  const [snapshot, setSnapshot] = useState<InterviewSnapshot | null>(null);
  const [draft, setDraft] = useState(initialGoal);
  const [disclosureAccepted, setDisclosureAccepted] = useState(false);
  const [pending, setPending] = useState<"turn" | "edit" | "confirm" | null>(null);
  const [error, setError] = useState("");
  const [lastFailedMessage, setLastFailedMessage] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [editingFact, setEditingFact] = useState<InterviewFact | null>(null);
  const [editValue, setEditValue] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [confirmedWorkflow, setConfirmedWorkflow] = useState<AbstractWorkflow | null>(null);
  const composingRef = useRef(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);
  const sessionEpochRef = useRef(0);

  useEffect(() => {
    if (editingFact) editTextareaRef.current?.focus();
    else if (reviewOpen) reviewHeadingRef.current?.focus();
  }, [editingFact, reviewOpen]);

  useEffect(() => {
    if (!editingFact && !reviewOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setEditingFact(null);
      setReviewOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [editingFact, reviewOpen]);

  const factsByStatus = useMemo(() => {
    const grouped: Record<FactStatus, InterviewFact[]> = {
      user_confirmed: [],
      system_inferred: [],
      unknown: [],
      conflicted: [],
    };
    for (const fact of snapshot?.facts || []) grouped[fact.status].push(fact);
    return grouped;
  }, [snapshot]);

  const knownFields = useMemo(() => new Set((snapshot?.facts || []).map((fact) => fact.field)), [snapshot]);
  const uncoveredFields = COVERAGE_FIELDS.filter((field) => !knownFields.has(field));

  async function callInterview(path: "turn" | "edit" | "confirm", body: Record<string, unknown>) {
    const requestEpoch = sessionEpochRef.current;
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setPending(path);
    setError("");
    try {
      const response = await fetch(`/api/workflows/interview/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const payload = (await response.json()) as ApiPayload;
      if (!response.ok || !payload.snapshot) {
        const fallback = payload.error?.code === "MODEL_NOT_CONFIGURED" || response.status === 503
          ? "AI 工作访谈尚未配置服务端模型。你的文字没有被处理，请联系管理员配置后重试。"
          : "本轮分析没有完成，当前会话仍保留。请稍后重试。";
        throw new Error(payload.error?.code === "MODEL_NOT_CONFIGURED" ? fallback : payload.error?.message || fallback);
      }
      if (requestEpoch !== sessionEpochRef.current) return null;
      setSnapshot(payload.snapshot);
      window.setTimeout(() => transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" }), 30);
      return payload;
    } catch (caught) {
      if (requestEpoch !== sessionEpochRef.current) return null;
      const wasCancelled = caught instanceof Error && caught.name === "AbortError";
      setError(wasCancelled ? "已取消本轮分析。输入仍保留，你可以修改后重新发送。" : caught instanceof Error ? caught.message : "连接失败，当前会话仍保留。请稍后重试。");
      return null;
    } finally {
      if (requestControllerRef.current === controller) requestControllerRef.current = null;
      if (requestEpoch === sessionEpochRef.current) setPending(null);
    }
  }

  async function sendTurn(contentOverride?: string) {
    const content = (contentOverride ?? draft).trim();
    if (!content || pending || !disclosureAccepted) return;
    const requestEpoch = sessionEpochRef.current;
    setLastFailedMessage("");
    const requestSeq = (snapshot?.requestSeq || 0) + 1;
    const payload = await callInterview("turn", {
      requestSeq,
      snapshot: snapshot || undefined,
      message: { id: messageId("user"), content },
    });
    if (requestEpoch !== sessionEpochRef.current) return;
    if (payload) setDraft("");
    else setLastFailedMessage(content);
    window.requestAnimationFrame(() => composerRef.current?.focus());
  }

  async function editFact(operation: Record<string, unknown>, announcement: string) {
    if (!snapshot || pending) return;
    const payload = await callInterview("edit", {
      requestSeq: snapshot.requestSeq + 1,
      snapshot,
      message: { id: messageId("edit"), content: announcement },
      operation,
    });
    if (payload) {
      setEditingFact(null);
      setEditValue("");
      setReviewOpen(false);
      setConfirmChecked(false);
    }
  }

  async function confirmContract() {
    if (!snapshot || pending || !confirmChecked || !snapshot.sufficiency.canConfirm) return;
    const payload = await callInterview("confirm", {
      requestSeq: snapshot.requestSeq + 1,
      snapshot,
      message: { id: messageId("confirm"), content: "确认。我已检查以上工作画像，这就是我的当前工作方式。" },
      accept: true,
    });
    if (payload?.snapshot?.state === "confirmed") {
      setReviewOpen(false);
      if (!payload.workflow) {
        setError("任务合同已确认，但服务端没有返回抽象工作流。当前不会伪造工作节点。");
        return;
      }
      setConfirmedWorkflow(payload.workflow);
      onConfirmed?.(payload.snapshot, payload.workflow);
    }
  }

  function clearSession() {
    sessionEpochRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
    setSnapshot(null);
    setDraft("");
    setDisclosureAccepted(false);
    setPending(null);
    setError("");
    setLastFailedMessage("");
    setReviewOpen(false);
    setEditingFact(null);
    setEditValue("");
    setConfirmChecked(false);
    setConfirmedWorkflow(null);
  }

  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const nativeEvent = event.nativeEvent as KeyboardEvent;
    if (event.key !== "Enter" || event.shiftKey || composingRef.current || nativeEvent.isComposing || nativeEvent.keyCode === 229) return;
    event.preventDefault();
    void sendTurn();
  }

  return (
    <section className="gb-studio" aria-label="AI 工作访谈">
      <header className="gb-studio-head">
        <div>
          <span className="gb-kicker"><i /> 工作发现 · Gate B</span>
          <h2>先让我理解你真实怎么工作。</h2>
          <p>不用填表，像和同事交代工作一样描述。每轮我只追问一个最影响判断的问题。</p>
        </div>
        <button type="button" className="gb-clear" onClick={clearSession}>清空当前会话</button>
      </header>

      <div className="gb-grid">
        <div className="gb-conversation">
          <div className="gb-disclosure" role="note">
            <span className="gb-shield" aria-hidden="true">⌁</span>
            <div>
              <strong>发送前请确认数据边界</strong>
              <p>对话文字将发送给外部 AI 模型，可能在中国境外处理。不要粘贴密码、API 密钥、身份证件、未脱敏客户数据或其他敏感信息；诊断阶段不会读取你的文件、账号或连接器。</p>
              <label>
                <input type="checkbox" checked={disclosureAccepted} onChange={(event) => setDisclosureAccepted(event.target.checked)} />
                <span>我已了解，并会先对内容做必要脱敏</span>
              </label>
              <small className="gb-session-boundary">当前会话未保存为个人资产；“清空”只移除本页状态，不能撤回已经发送给外部模型的文字。</small>
            </div>
          </div>

          <div className="gb-transcript" ref={transcriptRef} aria-label="工作访谈对话记录" aria-live="polite" aria-relevant="additions text">
            {!snapshot?.messages.length ? (
              <div className="gb-empty-chat">
                <span>✦</span>
                <strong>从一段真实工作开始</strong>
                <p>可以说：这项工作为什么发生、你现在怎么做、最费时间或最容易出错的地方。信息不完整没关系。</p>
              </div>
            ) : snapshot.messages.map((message) => (
              <article key={message.id} className={`gb-message gb-message-${message.role}`}>
                <span className="gb-message-role">{message.role === "user" ? "你" : "AI"}</span>
                <p>{message.content}</p>
              </article>
            ))}

            {pending === "turn" && (
              <div className="gb-thinking" aria-live="polite"><i /><i /><i /><span>正在梳理原话、事实与缺口</span><button type="button" onClick={() => requestControllerRef.current?.abort()}>取消本轮</button></div>
            )}
          </div>

          <div className="gb-live-region" aria-live="assertive">{error}</div>
          {error && (
            <div className="gb-error" role="alert">
              <div><strong>这一轮没有完成</strong><p>{error}</p></div>
              {lastFailedMessage && <button type="button" onClick={() => void sendTurn(lastFailedMessage)} disabled={pending !== null}>重试本轮</button>}
            </div>
          )}

          <div className="gb-composer">
            {snapshot?.nextQuestion && <div className="gb-question"><span>AI 现在最需要确认</span><strong>{snapshot.nextQuestion.text}</strong></div>}
            <label htmlFor="workflow-interview-message">自由描述或回答</label>
            <textarea
              ref={composerRef}
              id="workflow-interview-message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={() => { composingRef.current = false; }}
              placeholder={disclosureAccepted ? "写下你的真实做法、例外情况或对 AI 理解的纠正……" : "先确认上方的数据边界，再开始描述……"}
              disabled={pending !== null || !disclosureAccepted}
              rows={4}
            />
            <div className="gb-composer-foot">
              <span><kbd>Enter</kbd> 发送 · <kbd>Shift</kbd> + <kbd>Enter</kbd> 换行</span>
              <button type="button" onClick={() => void sendTurn()} disabled={!draft.trim() || pending !== null || !disclosureAccepted}>
                {pending === "turn" ? "正在理解" : "发送"}<span aria-hidden="true">↗</span>
              </button>
            </div>
          </div>
        </div>

        <aside className="gb-work-profile" aria-label="实时工作记忆">
          <div className="gb-profile-head">
            <div><span>LIVE WORK MEMORY</span><h3>工作记忆</h3></div>
            <span className={`gb-profile-state gb-state-${snapshot?.state || "empty"}`}>
              {snapshot?.state === "review_ready" ? "可复核" : snapshot?.state === "confirmed" ? "已确认" : snapshot ? "理解中" : "等待描述"}
            </span>
          </div>

          <div className="gb-memory-scope" role="note" aria-label="当前记忆作用域">
            <div><span><i /> 当前作用域</span><strong>只用于本次任务</strong></div>
            <p>原话、事实、AI 推断和冲突都保留来源并可编辑；尚未写入个人工作台，也不会用于其他工作流。</p>
          </div>

          <div className="gb-status-key" aria-label="记忆生命周期状态说明">
            {(Object.entries(STATUS_META) as [FactStatus, { label: string; hint: string }][]).map(([status, meta]) => (
              <span key={status} className={`gb-fact-status gb-status-${status}`} title={meta.hint}>{meta.label}</span>
            ))}
          </div>

          <div className="gb-fact-groups">
            {(["conflicted", "system_inferred", "user_confirmed", "unknown"] as FactStatus[]).map((status) => factsByStatus[status].length > 0 && (
              <section key={status} className={`gb-fact-group gb-group-${status}`}>
                <div className="gb-fact-group-head"><strong>{STATUS_META[status].label}</strong><span>{factsByStatus[status].length}</span></div>
                {factsByStatus[status].map((fact) => (
                  <article className="gb-fact" key={fact.factId}>
                    <div><span>{fieldLabel(fact.field)}</span><p>{factText(fact.value) || "暂未获得信息"}</p></div>
                    <div className="gb-fact-actions">
                      <button type="button" onClick={() => { setEditingFact(fact); setEditValue(status === "unknown" ? "" : factText(fact.value)); }}>{status === "unknown" ? "补充" : status === "conflicted" ? "解决冲突" : "编辑"}</button>
                      {status === "system_inferred" && (
                        <button type="button" onClick={() => void editFact({ type: "confirm", factIds: [fact.factId] }, `确认“${fieldLabel(fact.field)}”这一事实`)}>确认</button>
                      )}
                      <button type="button" onClick={() => void editFact({ type: "delete", factIds: [fact.factId] }, `删除“${fieldLabel(fact.field)}”这一事实`)}>删除</button>
                    </div>
                    {fact.provenance?.[0]?.quote && <blockquote>来自对话：“{fact.provenance[0].quote}”</blockquote>}
                  </article>
                ))}
              </section>
            ))}

            {!snapshot?.facts.length && (
              <div className="gb-profile-empty"><span>⌁</span><p>你发送第一段描述后，原话会被整理成可核对的工作事实。AI 推断不会自动变成已确认事实。</p></div>
            )}
          </div>

          <details className="gb-coverage">
            <summary>工作画像覆盖度 <span>{COVERAGE_FIELDS.length - uncoveredFields.length}/{COVERAGE_FIELDS.length}</span></summary>
            <div>{uncoveredFields.length ? uncoveredFields.map((field) => <span key={field}>{fieldLabel(field)}</span>) : <p>核心画像字段均已有信息，请继续核对准确性。</p>}</div>
          </details>

          <div className="gb-profile-actions">
            <button type="button" className="gb-draft-button" onClick={() => setReviewOpen(true)} disabled={!snapshot}>按现有信息查看草案</button>
            <small>当前事实只用于本页会话；草案不绑定 Skill、不运行任务，也不会自动保存。</small>
          </div>
        </aside>
      </div>

      {snapshot?.state === "confirmed" && (
        <section className="gb-confirmed-output" aria-label="已确认的任务合同和抽象工作流">
          <header>
            <div><span className="gb-kicker"><i /> 已确认任务合同</span><h3>这就是当前确认的工作方式。</h3></div>
            <span>当前会话已确认 · 未保存 · 未运行</span>
          </header>
          <div className="gb-confirmed-contract">
            {contractEntries(snapshot.taskContract).map(([key, value]) => (
              <article key={key}><span>{fieldLabel(key)}</span><p>{contractValue(value)}</p></article>
            ))}
          </div>
          <div className="gb-abstract-flow">
            <div className="gb-abstract-flow-head"><strong>逐节点 AI 判断</strong><span>本轮判断是否适合 AI；Gate C 再匹配具体 Skill</span></div>
            {confirmedWorkflow?.nodes.length ? (
              <ol>{confirmedWorkflow.nodes.map((node) => (
                <li key={node.nodeId} className={`gb-node-risk-${node.riskLevel}`}>
                  <div className="gb-node-title"><span>{node.label}</span><em>{AI_SUITABILITY_LABELS[node.aiSuitability]} · {RISK_LABELS[node.riskLevel]}</em></div>
                  <p>{node.purpose}</p>
                  <dl>
                    <div><dt>AI 负责</dt><dd>{node.aiResponsibility}</dd></div>
                    <div><dt>人负责</dt><dd>{node.humanResponsibility}</dd></div>
                  </dl>
                </li>
              ))}</ol>
            ) : (
              <p>任务合同已经确认，但服务端没有返回可展示的抽象节点。当前不会用演示节点填充。</p>
            )}
            {confirmedWorkflow?.boundaries.length ? <div className="gb-flow-boundaries"><strong>当前边界</strong><p>{confirmedWorkflow.boundaries.join("；")}</p></div> : null}
          </div>
        </section>
      )}

      {editingFact && (
        <div className="gb-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setEditingFact(null); }}>
          <section className="gb-modal" role="dialog" aria-modal="true" aria-labelledby="gb-edit-title">
            <span className="gb-kicker">修改工作事实</span>
            <h3 id="gb-edit-title">{fieldLabel(editingFact.field)}</h3>
            <p>修改会使此前的草案确认失效，AI 将基于新事实继续判断。</p>
            <label htmlFor="gb-edit-value">正确的信息是</label>
            <textarea ref={editTextareaRef} id="gb-edit-value" value={editValue} onChange={(event) => setEditValue(event.target.value)} rows={4} />
            <div className="gb-modal-actions">
              <button type="button" onClick={() => setEditingFact(null)}>取消</button>
              <button type="button" className="gb-confirm-button" disabled={!editValue.trim() || pending !== null} onClick={() => void editFact({ type: "set", field: editingFact.field, value: editValue.trim(), replacesFactIds: [...new Set([editingFact.factId, ...editingFact.dependsOnFactIds])] }, `将“${fieldLabel(editingFact.field)}”修正为：${editValue.trim()}`)}>保存修正</button>
            </div>
          </section>
        </div>
      )}

      {reviewOpen && snapshot && (
        <div className="gb-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setReviewOpen(false); }}>
          <section className="gb-modal gb-review-modal" role="dialog" aria-modal="true" aria-labelledby="gb-review-title">
            <span className="gb-kicker">未确认任务合同</span>
            <h3 id="gb-review-title" ref={reviewHeadingRef} tabIndex={-1}>我理解的是……</h3>
            <p>以下内容来自你的原话、已确认事实和明确标出的 AI 推断。请先检查，不准确的地方返回右侧工作画像修改。</p>

            <div className="gb-contract-grid">
              {contractEntries(snapshot.taskContract).map(([key, value]) => (
                <article key={key}><span>{fieldLabel(key)}</span><p>{contractValue(value)}</p></article>
              ))}
              {!contractEntries(snapshot.taskContract).length && <div className="gb-contract-empty">当前信息还不足以形成结构化合同，可以继续对话；你仍可查看现有事实，但不能确认空草案。</div>}
            </div>

            {(snapshot.sufficiency.missingCriticalFields.length > 0 || snapshot.sufficiency.conflictedCriticalFields.length > 0) && (
              <div className="gb-review-warning">
                <strong>确认前仍需处理</strong>
                {snapshot.sufficiency.missingCriticalFields.length > 0 && <p>缺少：{snapshot.sufficiency.missingCriticalFields.map(fieldLabel).join("、")}</p>}
                {snapshot.sufficiency.conflictedCriticalFields.length > 0 && <p>有冲突：{snapshot.sufficiency.conflictedCriticalFields.map(fieldLabel).join("、")}</p>}
              </div>
            )}

            <label className={`gb-confirm-check ${snapshot.sufficiency.canConfirm ? "" : "is-disabled"}`}>
              <input type="checkbox" checked={confirmChecked} disabled={!snapshot.sufficiency.canConfirm} onChange={(event) => setConfirmChecked(event.target.checked)} />
              <span>我已检查以上工作画像，确认这就是我的当前工作方式</span>
            </label>

            <div className="gb-modal-actions">
              <button type="button" onClick={() => setReviewOpen(false)}>返回修改</button>
              <button type="button" className="gb-confirm-button" disabled={!snapshot.sufficiency.canConfirm || !confirmChecked || pending !== null} onClick={() => void confirmContract()}>{pending === "confirm" ? "正在确认" : "确认任务合同"}</button>
            </div>
            <small className="gb-review-boundary">确认后只生成抽象工作流草案；不会推荐或绑定具体 Skill，不会运行，也不会保存为你的正式资产。</small>
          </section>
        </div>
      )}

      <button type="button" className="gb-cancel" onClick={onBack}>← 返回发现</button>
    </section>
  );
}
