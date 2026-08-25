"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkflowPlan } from "@/lib/contracts";
import RegistryBrowser from "@/app/components/RegistryBrowser";
import InterviewRunner from "@/app/components/InterviewRunner";
import WorkflowInterview from "@/app/components/WorkflowInterview";
import CompositionStudio, { type CompositionStudioBootstrap } from "@/app/components/CompositionStudio";

type Stage = "home" | "catalog" | "diagnose" | "compose" | "routes" | "runner" | "lens" | "dashboard";

type SelectedRegistrySkill = {
  slug: string;
  name: string;
  description: string;
  briefZh?: string;
  safety?: { label?: string; blocked?: boolean; permissionHints?: { label: string }[] };
  attribution?: { sourceUrl?: string };
};

const skillShelf = [
  { code: "WR", name: "管理层周报", meta: "官方预制样例 · 非真实运行", color: "mint", goal: "整理本周项目进展，生成管理层周报" },
  { code: "IN", name: "访谈到 PRD", meta: "真实模型链 · 运行需要服务端配置", color: "violet", goal: "把用户访谈拆成证据和洞察，最终生成可评审 PRD" },
  { code: "RS", name: "公开 Skill 目录", meta: "真实来源 · 中文 Brief · 原文可核验", color: "amber", goal: null },
];

export default function Home() {
  const [stage, setStage] = useState<Stage>("home");
  const [task, setTask] = useState("整理本周项目进度，生成管理层周报");
  const [interviewSeed, setInterviewSeed] = useState("");
  const [compositionBootstrap, setCompositionBootstrap] = useState<CompositionStudioBootstrap | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [lens, setLens] = useState(42);
  const [adjustment, setAdjustment] = useState("只保留三个关键数字，结论改成管理层语言");
  const [toast, setToast] = useState("");
  const [workflowPlan, setWorkflowPlan] = useState<WorkflowPlan | null>(null);
  const [compileState, setCompileState] = useState<"idle" | "compiling" | "ready" | "error">("idle");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [commandIndex, setCommandIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commandGroups = useMemo(
    () => [
      { icon: "↗", title: "直接开始这项任务", note: task || "描述一项工作", action: "diagnose" as const },
      { icon: "⌕", title: "匹配一个 Skill", note: "进入真实目录，按任务搜索与比较", action: "catalog" as const },
      { icon: "✦", title: "帮我发现可交给 AI 的工作", note: "用自然语言梳理工作，AI 只追问关键缺口", action: "discover" as const },
    ],
    [task],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setStage("home");
        setCommandOpen(true);
        setCommandIndex(0);
        window.setTimeout(() => inputRef.current?.focus(), 40);
      }
      if (event.key === "Escape") {
        if (stage === "diagnose" || stage === "compose") return;
        if (stage !== "home") setStage("home");
        else setCommandOpen(false);
      }
      // 命令面板键盘导航：↑↓ 移动高亮，Enter 执行高亮项（与底部提示一致）。
      if (stage === "home" && commandOpen && commandGroups.length) {
        if (event.key === "ArrowDown") {
          event.preventDefault();
          setCommandIndex((index) => (index + 1) % commandGroups.length);
        }
        if (event.key === "ArrowUp") {
          event.preventDefault();
          setCommandIndex((index) => (index - 1 + commandGroups.length) % commandGroups.length);
        }
        if (event.key === "Enter") {
          event.preventDefault();
          const target = commandGroups[commandIndex].action;
          setCommandOpen(false);
          if (target === "discover") {
            setCompositionBootstrap(null);
            setInterviewSeed("");
            setStage("diagnose");
          } else {
            if (target === "diagnose") {
              setCompositionBootstrap(null);
              setInterviewSeed(task);
            }
            setStage(target);
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [stage, commandOpen, commandIndex, commandGroups, task]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [stage]);

  function startFlow(target: "diagnose" | "discover" | "routes" | "catalog" = "diagnose") {
    setCommandOpen(false);
    if (target === "discover") {
      setCompositionBootstrap(null);
      setInterviewSeed("");
      setStage("diagnose");
      return;
    }
    if (target === "diagnose") {
      setCompositionBootstrap(null);
      setInterviewSeed(task);
    }
    setStage(target);
    if (target === "routes") void compileCurrentPlan([]);
  }

  async function compileCurrentPlan(answerSet: string[], goalOverride?: string, selectedSkill?: SelectedRegistrySkill) {
    setCompileState("compiling");
    try {
      const response = await fetch("/api/workflows/diagnose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          goal: goalOverride || task,
          sources: answerSet[0] ? answerSet[0].split(" + ") : undefined,
          audience: answerSet[1] || undefined,
          frequency: answerSet[2] || undefined,
          targetUser: "互联网产品 / 运营",
          selectedSkill: selectedSkill ? {
            slug: selectedSkill.slug,
            name: selectedSkill.name,
            description: selectedSkill.briefZh || selectedSkill.description,
            sourceUrl: selectedSkill.attribution?.sourceUrl,
            safetyLabel: selectedSkill.safety?.label,
            blocked: selectedSkill.safety?.blocked,
            permissionLabels: selectedSkill.safety?.permissionHints?.map((hint) => hint.label) || [],
          } : undefined,
        }),
      });
      const payload = (await response.json()) as { plan?: WorkflowPlan; error?: string };
      if (!response.ok || !payload.plan) throw new Error(payload.error || "生成失败");
      setWorkflowPlan(payload.plan);
      setSelectedNodeId(payload.plan.nodes[0]?.id || "");
      setCompileState("ready");
    } catch {
      setCompileState("error");
      setToast("计划生成失败，已保留当前页面，可稍后重试");
    }
  }

  const selectedNode = workflowPlan?.nodes.find((node) => node.id === selectedNodeId) || workflowPlan?.nodes[0];
  const canRunInterview = workflowPlan?.templateId === "interview-to-prd-v1";
  const canViewWeeklySample = workflowPlan?.templateId === "weekly-report-single-v1";

  return (
    <main className={`site stage-${stage}`}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="noise" />

      <header className="topbar">
        <button className="brand" onClick={() => setStage("home")} aria-label="回到首页">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>Skillflow</span>
        </button>
        <nav className="nav-links" aria-label="主导航">
          <button className={stage === "home" ? "active" : ""} onClick={() => setStage("home")}>发现</button>
          <button className={stage === "catalog" ? "active" : ""} onClick={() => setStage("catalog")}>Skill 商店</button>
          <button className={stage === "diagnose" || stage === "compose" ? "active" : ""} onClick={() => {
            if (compositionBootstrap) setStage("compose");
            else { setInterviewSeed(task); setStage("diagnose"); }
          }}>工作流</button>
          <button onClick={() => setStage("dashboard")}>我的空间</button>
          <button onClick={() => setToast("创作者中心将在 Gate E 接入；当前没有伪造发布或收益状态")}>创作者中心</button>
        </nav>
        <div className="top-actions">
          <button className="shortcut" onClick={() => { setStage("home"); setCommandOpen(true); window.setTimeout(() => inputRef.current?.focus(), 40); }}>
            <span>快速召唤</span><kbd>⌘ K</kbd>
          </button>
          <button className="avatar" aria-label="个人账户">林</button>
        </div>
      </header>

      {stage === "home" ? (
        <section className="home-wrap stage-enter">
          <div className="hero-copy">
            <div className="eyebrow"><span className="live-dot" /> AI Skill 商店 + 工作台</div>
            <h1>一句工作目标，<br />召唤一条可运行的能力路径。</h1>
            <p>找一个 Skill、拆一条工作流，或记录你的个性化要求。先核验真实来源或官方样例，再决定是否采用。</p>
          </div>

          <section className={`command-machine ${commandOpen ? "is-open" : ""}`} aria-label="任务命令窗口">
            <div className="window-chrome">
              <div className="chrome-dots"><i /><i /><i /></div>
              <span>Skill Command</span>
              <span className="online"><i /> 公开 Registry · 进入目录后实时确认</span>
            </div>
            <form
              className="command-input"
              onSubmit={(event) => { event.preventDefault(); startFlow("diagnose"); }}
            >
              <span className="spark">✦</span>
              <input
                ref={inputRef}
                value={task}
                onChange={(event) => setTask(event.target.value)}
                onFocus={() => setCommandOpen(true)}
                placeholder="描述任务、搜索 Skill 或打开工作流……"
                aria-label="描述任务或搜索 Skill"
              />
              <button type="submit" className="send-button" aria-label="分析任务">↗</button>
            </form>
            <div className="command-results">
              <div className="result-label">建议操作</div>
              {commandGroups.map((group, index) => (
                <button
                  className={`command-row ${commandOpen && index === commandIndex ? "active" : ""}`}
                  key={group.title}
                  onClick={() => startFlow(group.action)}
                  onMouseEnter={() => setCommandIndex(index)}
                >
                  <span className="command-icon">{group.icon}</span>
                  <span><strong>{group.title}</strong><small>{group.note}</small></span>
                  <kbd>{index + 1}</kbd>
                </button>
              ))}
              <div className="command-footer"><span>↑↓ 选择</span><span>Enter 打开</span><span>Esc 关闭</span></div>
            </div>
          </section>

          <section className="skill-shelf" aria-label="推荐 Skill">
            <div className="section-heading"><span>Skillflow 内建黄金工作流</span><button onClick={() => setStage("catalog")}>打开真实 Skill 商店 ↗</button></div>
            <div className="skill-grid">
              {skillShelf.map((skill) => (
                <button className="skill-tile" key={skill.name} onClick={() => {
                  if (!skill.goal) {
                    setStage("catalog");
                    return;
                  }
                  setTask(skill.goal);
                  setCompositionBootstrap(null);
                  setInterviewSeed(skill.goal);
                  setStage("diagnose");
                }}>
                  <span className={`skill-glyph ${skill.color}`}>{skill.code}</span>
                  <span><strong>{skill.name}</strong><small>{skill.meta}</small></span>
                  <span className="tile-arrow">↗</span>
                </button>
              ))}
            </div>
          </section>
        </section>
      ) : (
        <section className="experience-wrap stage-enter">
          <div className="context-line">
            <button onClick={() => setStage("home")}>← 返回发现</button>
            <div className="task-context"><span>当前任务</span><strong>{stage === "compose" ? "逐节点选择最适配的 Skill 或组合" : stage === "diagnose" && !interviewSeed ? "发现最值得先交给 AI 的工作" : task}</strong></div>
            <span className="save-state"><i /> 当前仅预览，尚未保存</span>
          </div>

          <section className={`product-machine machine-${stage}`}>
            {stage === "catalog" && (
              <RegistryBrowser onUseInWorkflow={(skill) => {
                setCompositionBootstrap({ kind: "registry_single", slug: skill.slug });
                setToast(`正在从服务端重新核验 ${skill.name} 的真实来源和清单摘要`);
                setStage("compose");
              }} />
            )}

            {stage === "runner" && <InterviewRunner onBack={() => setStage("routes")} />}

            {stage === "diagnose" && (
              <WorkflowInterview
                initialGoal={interviewSeed}
                onBack={() => setStage("home")}
                onConfirmed={(snapshot, workflow) => {
                  setCompositionBootstrap({ kind: "gate_b_diagnosis", snapshot, workflow });
                  setToast("任务合同已确认，正在建立逐节点 Skill 编排草案");
                  setStage("compose");
                }}
              />
            )}

            {stage === "compose" && compositionBootstrap && (
              <CompositionStudio
                bootstrap={compositionBootstrap}
                onBack={() => setStage(compositionBootstrap.kind === "registry_single" ? "catalog" : "home")}
              />
            )}

            {stage === "routes" && (
              <div className="routes-layout stage-enter">
                <div className="routes-head">
                  <div><div className="micro-label">任务合同 · {workflowPlan ? "1 条当前方案" : "等待生成"}</div><h2>{workflowPlan?.title || "正在根据任务生成能力路径。"}</h2></div>
                  <div className="routes-head-actions">
                    <span className={`compile-state ${compileState}`}><i />{compileState === "compiling" ? "正在编译任务" : compileState === "ready" ? "计划合同校验通过" : compileState === "error" ? "需要重试" : "等待任务"}</span>
                    <button className="ghost" onClick={() => {
                      if (workflowPlan?.state === "needs_configuration") setStage("catalog");
                      else { setInterviewSeed(task); setStage("diagnose"); }
                    }}>{workflowPlan?.state === "needs_configuration" ? "返回目录核验" : "调整上下文"}</button>
                  </div>
                </div>

                <div className="route-canvas">
                  <div className="origin-card">
                    <span className="origin-avatar">林</span>
                    <div><small>任务上下文</small><strong>{workflowPlan ? `${workflowPlan.taskContract.audience} · ${workflowPlan.taskContract.frequency}` : "结果受众待确认 · 频率待确认"}</strong><em>{workflowPlan?.taskContract.inputSources.join(" + ") || "输入来源待确认"}</em></div>
                  </div>
                  {workflowPlan ? (
                    <div className="route-line complete selected" aria-label="当前编译方案">
                      <span className="route-tag">01 · {workflowPlan.state === "needs_configuration" ? "待配置候选" : workflowPlan.state === "clarifying" ? "需要澄清" : workflowPlan.recommendation === "single_skill" ? "单 Skill 方案" : "受控工作流"}</span>
                      <span className="route-node source"><small>输入</small><strong>{workflowPlan.taskContract.inputSources.slice(0, 2).join(" + ")}</strong><em>{workflowPlan.taskContract.trigger}</em></span>
                      <span className="route-beam"><i /></span>
                      <span className={`route-node ${workflowPlan.nodes.length > 1 ? "chain" : "skill"}`}><small>{workflowPlan.nodes.length} 个受控节点</small><strong>{workflowPlan.nodes.map((node) => node.label).join(" → ")}</strong><em>{workflowPlan.state === "needs_configuration" ? "未托管 · 未运行" : workflowPlan.state === "clarifying" ? "尚未匹配 Skill" : "计划已生成 · 尚未运行"}</em></span>
                      <span className="route-beam"><i /></span>
                      <span className="route-node output"><small>期望结果</small><strong>{workflowPlan.taskContract.expectedOutput}</strong><em>{workflowPlan.state === "plan_ready" ? "待真实运行验证" : "待确认"}</em></span>
                    </div>
                  ) : (
                    <div className="route-line complete selected" aria-live="polite">
                      <span className="route-tag">正在准备</span>
                      <span className="route-node source"><small>任务</small><strong>{task}</strong><em>尚未生成计划</em></span>
                    </div>
                  )}
                </div>

                {workflowPlan && selectedNode && (
                  <section className="node-audit" aria-label="节点 AI 决策与 Skill 证据">
                    <div className="node-rail">
                      <div className="node-rail-head"><span>节点审计</span><small>{workflowPlan.state === "needs_configuration" ? "一个候选 Skill · 待核验" : workflowPlan.recommendation === "single_skill" ? "一个 Skill 足够" : `${workflowPlan.nodes.length} 个受控节点`}</small></div>
                      <div className="node-tabs">
                        {workflowPlan.nodes.map((node, index) => (
                          <button key={node.id} className={selectedNode.id === node.id ? "active" : ""} onClick={() => setSelectedNodeId(node.id)}>
                            <span>{String(index + 1).padStart(2, "0")}</span><b>{node.label}</b><i className={`risk-${node.autonomyRisk}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="node-verdict">
                      <div className="verdict-kicker"><span>{selectedNode.kind.replaceAll("_", " ")}</span><em>{workflowPlan.state === "needs_configuration" ? "本地适配度 · 未评测" : `模板规则建议 · AI 适配 ${selectedNode.aiFit}/100`}</em></div>
                      <h3>{selectedNode.label}</h3>
                      <p>{selectedNode.aiVerdict}</p>
                      <div className="responsibility-line"><span>人负责</span><strong>{selectedNode.humanResponsibility}</strong></div>
                      <div className="contract-pills">
                        <span>输入 · {selectedNode.inputs.join(" / ")}</span>
                        <span>输出 · {selectedNode.outputs.join(" / ")}</span>
                      </div>
                    </div>
                    <aside className="skill-evidence">
                      <div className="skill-evidence-head"><span>{selectedNode.skillName ? "绑定 SkillRelease" : "节点实现"}</span><em>{selectedNode.evidenceLevel || "规则"}</em></div>
                      <h4>{selectedNode.skillName || (selectedNode.kind.includes("connector") ? "受控 Connector" : selectedNode.executionMode === "human_only" ? "人类决策" : "确定性内建节点")}</h4>
                      {selectedNode.score ? <div className="evidence-score"><strong>{selectedNode.score}</strong><span>/ 100<small>模板规则分 · 不是运行实测</small></span></div> : <div className="evidence-note">该节点没有本地运行评分。</div>}
                      <ul>
                        {selectedNode.acceptance.slice(0, 3).map((item) => <li key={item.id}>✓ {item.label}</li>)}
                        {selectedNode.permissions.slice(0, 2).map((item) => <li key={item.capability}>⌁ {item.capability} · {item.resourceScope}</li>)}
                      </ul>
                    </aside>
                  </section>
                )}

                <div className="route-detail">
                  <div className="detail-copy">
                    <span className="route-index">01</span>
                    <div>
                      <small>当前建议</small>
                      <h3>{workflowPlan?.title || "等待生成方案"}</h3>
                      <p>{workflowPlan?.summary || "系统尚未生成可核验的任务合同。"}</p>
                    </div>
                  </div>
                  <div className="route-actions">
                    <button className="ghost" disabled>保存（尚未开放）</button>
                    {workflowPlan?.candidateSkill?.sourceUrl ? (
                      <a className="primary" href={workflowPlan.candidateSkill.sourceUrl} target="_blank" rel="noreferrer">查看原作者说明 <span>↗</span></a>
                    ) : canRunInterview ? (
                      <button className="primary" onClick={() => setStage("runner")}>上传材料并真实运行 <span>↗</span></button>
                    ) : canViewWeeklySample ? (
                      <button className="primary" onClick={() => setStage("lens")}>查看官方预制样例 <span>↗</span></button>
                    ) : workflowPlan?.state === "needs_configuration" ? (
                      <button className="primary" onClick={() => setStage("catalog")}>返回目录核验详情 <span>↗</span></button>
                    ) : (
                      <button className="primary" onClick={() => { setInterviewSeed(task); setStage("diagnose"); }}>继续补充上下文 <span>↗</span></button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {stage === "lens" && (
              <div className="lens-layout stage-enter">
                <div className="lens-stage">
                  <div className="lens-toolbar">
                    <div><button onClick={() => setStage("routes")}>←</button><span>Outcome Lens</span><i>官方样例 · 预制结果</i></div>
                    <div><button className="active">对比</button><button>结果</button><button>处理过程</button></div>
                  </div>

                  <div className="artifact-wrap">
                    <div className="artifact raw-artifact">
                      <div className="raw-head"><span>原始输入</span><small>飞书文档 + Excel</small></div>
                      <h3>第 20 周项目原始记录</h3>
                      <div className="raw-block"><b>飞书摘录</b><p>本周新客户上线 18 家，Beta 测试收到 128 条反馈。项目 A 接口对接延迟，预计影响交付。</p></div>
                      <div className="raw-grid"><span>新增客户</span><b>18</b><em>+20%</em><span>活跃用户</span><b>2,345</b><em>+11.7%</em><span>项目交付率</span><b>85%</b><em>-7pp</em><span>市场活动 ROI</span><b>2.1</b><em>+15%</em></div>
                      <div className="raw-block"><b>会议记录</b><p>需要管理层关注接口延期；下周验证新版本留存，市场反馈样本量仍偏小。</p></div>
                    </div>

                    <div className="artifact generated-artifact" style={{ clipPath: `inset(0 0 0 ${lens}%)` }}>
                      <div className="report-head"><div><small>管理层周报 · 第 20 周</small><h3>本周经营与项目进展</h3></div><span>官方预制样例 · 非真实运行</span></div>
                      <div className="metric-row">
                        <div><small>新增客户</small><strong>18</strong><em>↑ 20%</em></div>
                        <div><small>活跃用户</small><strong>2,345</strong><em>↑ 11.7%</em></div>
                        <div><small>项目交付率</small><strong>85%</strong><em className="warn">↓ 7pp</em></div>
                      </div>
                      <section><b>关键进展</b><p>新客户上线与活跃用户增长符合预期；Beta 反馈已进入归类和优先级判断。</p></section>
                      <section className="risk"><b>风险与问题</b><p>项目 A 接口对接延迟，可能影响交付周期。建议本周确认资源优先级，并设定二次检查点。</p></section>
                      <section><b>下周行动</b><ol><li>完成接口稳定性验证</li><li>验证 Beta 反馈对留存的影响</li><li>补充市场活动样本并复核 ROI</li></ol></section>
                    </div>

                    <div className="lens-handle" style={{ left: `${lens}%` }}><span>◀ ▶</span></div>
                    <input
                      className="lens-range"
                      type="range"
                      min="12"
                      max="88"
                      value={lens}
                      onChange={(event) => setLens(Number(event.target.value))}
                      aria-label="拖动比较原始输入和生成结果"
                    />
                  </div>
                  <div className="lens-caption"><span>原始输入</span><p>拖动观测线，查看 Skill 如何改变结果</p><span>生成结果</span></div>
                </div>

                <aside className="lens-inspector">
                  <div className="inspector-head"><span className="skill-glyph mint">WR</span><div><small>候选 Skill · E0 待评测</small><strong>管理层周报生成器</strong></div></div>
                  <div className="reason-list"><div><i>✓</i><span><b>输入稳定</b><small>仅读取指定文档与表格</small></span></div><div><i>✓</i><span><b>结果可检查</b><small>输出为可编辑飞书文档</small></span></div><div><i className="amber">!</i><span><b>发送需确认</b><small>不会自动发给管理层</small></span></div></div>
                  <div className="adjust-box">
                    <label htmlFor="adjustment">告诉 AI 你想怎么调整</label>
                    <textarea id="adjustment" value={adjustment} onChange={(event) => setAdjustment(event.target.value)} />
                    <button onClick={() => setToast("自然语言修改与版本保存将在 Gate C 接入；当前不会修改真实 Skill")}>修改功能将在 Gate C 接入 <span>↗</span></button>
                  </div>
                  <div className="inspector-actions"><button className="ghost" onClick={() => setStage("routes")}>返回路径</button><button className="primary" onClick={() => setStage("catalog")}>去真实 Skill 商店</button></div>
                </aside>
              </div>
            )}

            {stage === "dashboard" && (
              <div className="dashboard-layout stage-enter">
                <aside className="dash-sidebar">
                  <button className="new-task" onClick={() => setStage("home")}>＋ 新建任务</button>
                  <span>工作空间</span>
                  <button className="active">◫ 空工作台</button><button disabled>⌘ 工作流 · 待持久化</button><button disabled>◇ 已启用 Skill · 暂无</button><button disabled>↗ 运行记录 · 暂无</button>
                  <span>当前状态</span>
                  <button disabled>没有已保存内容</button>
                </aside>
                <div className="dash-main">
                  <div className="dash-head"><div><small>我的空间 · 真实空状态</small><h2>完成一次真实运行并保存后，工作对象才会出现在这里。</h2></div><button className="primary" onClick={() => setStage("home")}>返回发现</button></div>
                  <div className="workspace-empty">
                    <span>⌁</span>
                    <strong>目前没有已保存的工作流或运行结果</strong>
                    <p>当前版本不会用演示数据伪装成你的历史记录。Gate D 接入真实持久化后，这里会显示需要确认的任务、真实 Artifact、已保存工作流和已启用 Skill。</p>
                    <button className="ghost" onClick={() => setStage("catalog")}>先去真实 Skill 商店</button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </section>
      )}

      {toast && <div className="toast"><span>i</span>{toast}</div>}
    </main>
  );
}
