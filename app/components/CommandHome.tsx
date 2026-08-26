"use client";

import { useCallback, useEffect, useState } from "react";

type SavedRun = { id: string; status: string; input: { researchGoal?: string; fileName?: string }; currentSequence: number; createdAt: string; updatedAt: string; workflowVersionId: string };
type SavedWorkflow = { id: string; workflowId: string; revision: number; versionLabel?: string | null; status: string; name: string; description: string; planDigest?: string | null; createdAt: string; plan?: { stages?: { id: string; descriptionZh: string }[] } | null };

const labels: Record<string, string> = {
  provisioning: "正在建立", queued: "待继续", running: "运行中", awaiting_approval: "待我确认", succeeded: "已完成",
  partial_failed: "有草稿待修订", failed: "失败可重试", cancelled: "已取消", blocked: "已阻断",
};

export default function CommandHome({ onNew, onOpen, onOpenWorkflow }: { onNew: () => void; onOpen: (runId: string) => void; onOpenWorkflow: (workflowVersionId: string) => void }) {
  const [runs, setRuns] = useState<SavedRun[]>([]);
  const [workflows, setWorkflows] = useState<SavedWorkflow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const loadWorkspace = useCallback(async () => {
    setState("loading");
    try {
      const [runResponse, workflowResponse] = await Promise.all([fetch("/api/workspace/runs", { cache: "no-store" }), fetch("/api/workspace/workflows", { cache: "no-store" })]);
      const runPayload = await runResponse.json() as { runs?: SavedRun[] };
      const workflowPayload = await workflowResponse.json() as { workflows?: SavedWorkflow[] };
      if (!runResponse.ok || !workflowResponse.ok) throw new Error("workspace unavailable");
      setRuns(runPayload.runs || []); setWorkflows(workflowPayload.workflows || []); setState("ready");
    } catch { setState("error"); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadWorkspace(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  return <div className="dashboard-layout stage-enter">
    <aside className="dash-sidebar"><button className="new-task" onClick={onNew}>＋ 新建任务</button><span>工作空间</span><button className="active">⌘ Command Home</button><button disabled>◇ 已启用 Skill · Gate E</button><span>真实对象</span><button>{workflows.length} 个工作流版本</button><button>{runs.length} 次持久化运行</button></aside>
    <div className="dash-main">
      <div className="dash-head"><div><small>我的空间 · D1 / R2 真实状态</small><h2>先继续待办，再复用已经确认的工作流资产。</h2></div><button className="primary" onClick={onNew}>开始新的工作诊断</button></div>
      {state === "loading" && <div className="workspace-empty" aria-live="polite"><span>⌁</span><strong>正在读取个人空间</strong><p>工作流版本和运行记录都来自服务端。</p></div>}
      {state === "error" && <div className="workspace-empty"><strong>暂时无法读取个人空间</strong><p>没有用浏览器缓存伪装成已保存数据。</p><button className="ghost" onClick={() => void loadWorkspace()}>重新读取</button></div>}
      {state === "ready" && !runs.length && !workflows.length && <div className="workspace-empty"><span>⌁</span><strong>还没有持久化资产</strong><p>先用自然语言确认工作流，再选择官方 Runtime Pack 并保存。</p><button className="ghost" onClick={onNew}>开始第一条工作流</button></div>}
      {state === "ready" && workflows.length > 0 && <section className="command-asset-section"><div className="section-heading"><span>已保存工作流</span><small>可重新打开并建立新的 Run</small></div><div className="command-run-list">{workflows.map((workflow) => <button key={workflow.id} onClick={() => onOpenWorkflow(workflow.id)}><span className="run-state succeeded">{workflow.versionLabel || `V${workflow.revision}`}</span><div><strong>{workflow.name}</strong><p>{workflow.plan?.stages?.length || 0} 个固定阶段 · {workflow.description}</p></div><small>{new Date(workflow.createdAt).toLocaleString("zh-CN")} ↗</small></button>)}</div></section>}
      {state === "ready" && runs.length > 0 && <section className="command-asset-section"><div className="section-heading"><span>运行记录</span><small>刷新后可从真实状态继续</small></div><div className="command-run-list">{runs.map((run) => <button key={run.id} onClick={() => onOpen(run.id)}><span className={`run-state ${run.status}`}>{labels[run.status] || "未知状态"}</span><div><strong>{run.input.researchGoal || "访谈到 PRD"}</strong><p>{run.input.fileName || "私有材料"} · 已提交 {Math.min(run.currentSequence, 7)}/7 个节点</p></div><small>{new Date(run.updatedAt).toLocaleString("zh-CN")} ↗</small></button>)}</div></section>}
    </div>
  </div>;
}
