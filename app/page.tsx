"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkflowPlan } from "@/lib/contracts";

type Stage = "home" | "diagnose" | "routes" | "lens" | "dashboard";

const questions = [
  {
    eyebrow: "资料主要在哪里？",
    help: "只选择真正会用到的来源，权限会按这里缩小。",
    options: ["飞书文档", "Excel", "会议记录", "我稍后提供"],
  },
  {
    eyebrow: "谁会阅读最终结果？",
    help: "AI 会据此调整结构、语气和证据密度。",
    options: ["管理层", "项目团队", "客户", "只给自己"],
  },
  {
    eyebrow: "这项工作多久发生一次？",
    help: "频率决定先推荐单个 Skill，还是沉淀完整工作流。",
    options: ["每周", "每天", "每月", "只做一次"],
  },
];

const skillShelf = [
  { code: "WR", name: "管理层周报", meta: "飞书 + Excel → 可编辑周报", color: "mint" },
  { code: "IN", name: "访谈证据提取", meta: "录音 / 文本 → 可追溯证据", color: "violet" },
  { code: "PR", name: "PRD 生成器", meta: "洞察 → 可评审 PRD", color: "amber" },
  { code: "CP", name: "竞品动态分析", meta: "公开信息 → 风险简报", color: "cyan" },
];

const routeNodes = ["访谈导入", "证据提取", "洞察聚类", "PRD 生成"];

export default function Home() {
  const [stage, setStage] = useState<Stage>("home");
  const [task, setTask] = useState("整理本周项目进度，生成管理层周报");
  const [commandOpen, setCommandOpen] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState("");
  const [selectedRoute, setSelectedRoute] = useState<0 | 1>(0);
  const [lens, setLens] = useState(42);
  const [adjustment, setAdjustment] = useState("只保留三个关键数字，结论改成管理层语言");
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffApplied, setDiffApplied] = useState(false);
  const [toast, setToast] = useState("");
  const [workflowPlan, setWorkflowPlan] = useState<WorkflowPlan | null>(null);
  const [compileState, setCompileState] = useState<"idle" | "compiling" | "ready" | "error">("idle");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setStage("home");
        setCommandOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 40);
      }
      if (event.key === "Escape") {
        if (diffOpen) setDiffOpen(false);
        else if (stage !== "home") setStage("home");
        else setCommandOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [diffOpen, stage]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const activeQuestion = questions[questionIndex];
  const sourceAnswer = answers[0] || "飞书文档 + Excel";
  const audienceAnswer = answers[1] || "管理层";
  const frequencyAnswer = answers[2] || "每周";

  const commandGroups = useMemo(
    () => [
      { icon: "↗", title: "直接开始这项任务", note: task || "描述一项工作", action: "diagnose" as const },
      { icon: "⌕", title: "匹配一个 Skill", note: "搜索周报、访谈、PRD 或竞品分析", action: "routes" as const },
      { icon: "✦", title: "帮我发现可交给 AI 的工作", note: "用 3 个问题分析你的重复工作", action: "diagnose" as const },
    ],
    [task]
  );

  function startFlow(target: "diagnose" | "routes" = "diagnose") {
    setCommandOpen(false);
    setQuestionIndex(0);
    setAnswers([]);
    setSelectedOption("");
    setStage(target);
    if (target === "routes") void compileCurrentPlan([]);
  }

  function confirmAnswer() {
    if (!selectedOption) return;
    const nextAnswers = [...answers, selectedOption];
    setAnswers(nextAnswers);
    setSelectedOption("");
    if (questionIndex === questions.length - 1) {
      window.setTimeout(() => {
        setStage("routes");
        void compileCurrentPlan(nextAnswers);
      }, 180);
    } else {
      setQuestionIndex((value) => value + 1);
    }
  }

  async function compileCurrentPlan(answerSet: string[]) {
    setCompileState("compiling");
    try {
      const response = await fetch("/api/workflows/diagnose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          goal: task,
          sources: answerSet[0] ? answerSet[0].split(" + ") : ["飞书文档", "Excel"],
          audience: answerSet[1] || "管理层",
          frequency: answerSet[2] || "每周",
          targetUser: "互联网产品 / 运营",
        }),
      });
      const payload = (await response.json()) as { plan?: WorkflowPlan; error?: string };
      if (!response.ok || !payload.plan) throw new Error(payload.error || "生成失败");
      setWorkflowPlan(payload.plan);
      setSelectedRoute(payload.plan.recommendation === "single_skill" ? 0 : 1);
      setSelectedNodeId(payload.plan.nodes[0]?.id || "");
      setCompileState("ready");
    } catch {
      setCompileState("error");
      setToast("计划生成失败，已保留当前页面，可稍后重试");
    }
  }

  function applyDiff() {
    setDiffApplied(true);
    setDiffOpen(false);
    setToast("已生成个人版本 v2，可随时撤销");
  }

  const selectedNode = workflowPlan?.nodes.find((node) => node.id === selectedNodeId) || workflowPlan?.nodes[0];

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
          <button onClick={() => { setStage("routes"); setSelectedRoute(0); }}>工作流</button>
          <button onClick={() => setStage("dashboard")}>我的空间</button>
          <button>创作者中心</button>
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
            <p>找一个 Skill、拆一条工作流，或修改成你的个人版本。先看真实结果，再决定是否采用。</p>
          </div>

          <section className={`command-machine ${commandOpen ? "is-open" : ""}`} aria-label="任务命令窗口">
            <div className="window-chrome">
              <div className="chrome-dots"><i /><i /><i /></div>
              <span>Skill Command</span>
              <span className="online"><i /> 12,480 个能力可用</span>
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
                  className="command-row"
                  key={group.title}
                  onClick={() => startFlow(group.action)}
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
            <div className="section-heading"><span>正在被使用的 Skill</span><button>打开商店 ↗</button></div>
            <div className="skill-grid">
              {skillShelf.map((skill) => (
                <button className="skill-tile" key={skill.name} onClick={() => { setSelectedRoute(skill.code === "WR" ? 0 : 1); setStage("routes"); }}>
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
            <div className="task-context"><span>当前任务</span><strong>{task}</strong></div>
            <span className="save-state"><i /> 草稿已保存</span>
          </div>

          <section className={`product-machine machine-${stage}`}>
            {stage === "diagnose" && (
              <div className="diagnose-layout stage-enter">
                <div className="diagnose-main">
                  <div className="progress-mini"><span style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }} /></div>
                  <div className="micro-label">工作诊断 · {questionIndex + 1} / {questions.length}</div>
                  <h2>{activeQuestion.eyebrow}</h2>
                  <p>{activeQuestion.help}</p>

                  <div className="option-list" role="listbox" aria-label={activeQuestion.eyebrow}>
                    {activeQuestion.options.map((option, index) => (
                      <button
                        key={option}
                        className={selectedOption === option ? "selected" : ""}
                        onClick={() => setSelectedOption(option)}
                        role="option"
                        aria-selected={selectedOption === option}
                      >
                        <kbd>{index + 1}</kbd><span>{option}</span><i>{selectedOption === option ? "✓" : ""}</i>
                      </button>
                    ))}
                  </div>

                  <div className="diagnose-actions">
                    <button className="ghost" onClick={() => setStage("home")}>取消</button>
                    <button className="primary" disabled={!selectedOption} onClick={confirmAnswer}>
                      {questionIndex === questions.length - 1 ? "生成能力路径" : "继续"} <span>↗</span>
                    </button>
                  </div>
                </div>

                <aside className="diagnose-aside">
                  <div className="aside-header"><span className="pulse-orb">✦</span><div><strong>AI 正在建立任务上下文</strong><small>只保留影响匹配的关键信息</small></div></div>
                  <div className="confirmed-list">
                    <div className={answers[0] ? "done" : "active"}><span>01</span><p>资料来源<small>{answers[0] || "等待确认"}</small></p></div>
                    <div className={answers[1] ? "done" : questionIndex === 1 ? "active" : ""}><span>02</span><p>结果受众<small>{answers[1] || "等待确认"}</small></p></div>
                    <div className={answers[2] ? "done" : questionIndex === 2 ? "active" : ""}><span>03</span><p>发生频率<small>{answers[2] || "等待确认"}</small></p></div>
                  </div>
                  <div className="privacy-note"><span>⌁</span> 你的连接和文件不会在诊断阶段被读取。</div>
                </aside>
              </div>
            )}

            {stage === "routes" && (
              <div className="routes-layout stage-enter">
                <div className="routes-head">
                  <div><div className="micro-label">AI 编译 · 2 条能力路径草案</div><h2>先验证高频收益，再沉淀完整流程。</h2></div>
                  <div className="routes-head-actions">
                    <span className={`compile-state ${compileState}`}><i />{compileState === "compiling" ? "正在编译任务" : compileState === "ready" ? "结构校验通过" : compileState === "error" ? "需要重试" : "等待任务"}</span>
                    <button className="ghost" onClick={() => { setStage("diagnose"); setQuestionIndex(0); setAnswers([]); }}>调整上下文</button>
                  </div>
                </div>

                <div className="route-canvas">
                  <div className="origin-card">
                    <span className="origin-avatar">林</span>
                    <div><small>任务上下文</small><strong>{audienceAnswer} · {frequencyAnswer}</strong><em>{sourceAnswer}</em></div>
                  </div>
                  <div className="route-trunk"><i /><i /></div>

                  <button className={`route-line quick ${selectedRoute === 0 ? "selected" : ""}`} onClick={() => setSelectedRoute(0)}>
                    <span className="route-tag">01 · 快速收益</span>
                    <span className="route-node source"><small>输入</small><strong>飞书 + Excel</strong><em>已准备</em></span>
                    <span className="route-beam"><i /></span>
                    <span className="route-node skill"><small>契约匹配 · E0</small><strong>管理层周报生成器</strong><em>待样例评测</em></span>
                    <span className="route-beam"><i /></span>
                    <span className="route-node output"><small>结果</small><strong>管理层周报</strong><em>预期收益 · 待实测</em></span>
                  </button>

                  <button className={`route-line complete ${selectedRoute === 1 ? "selected" : ""}`} onClick={() => setSelectedRoute(1)}>
                    <span className="route-tag">02 · 完整流程</span>
                    <span className="route-node source"><small>输入</small><strong>访谈记录</strong><em>文本 / 录音</em></span>
                    <span className="route-beam"><i /></span>
                    <span className="route-node chain"><small>4 个 Skill</small><strong>{routeNodes.join(" → ")}</strong><em>端到端收益 · 待实测</em></span>
                    <span className="route-beam"><i /></span>
                    <span className="route-node output"><small>结果</small><strong>可评审 PRD</strong><em>沉淀为工作流</em></span>
                  </button>
                </div>

                {workflowPlan && selectedNode && (
                  <section className="node-audit" aria-label="节点 AI 决策与 Skill 证据">
                    <div className="node-rail">
                      <div className="node-rail-head"><span>节点审计</span><small>{workflowPlan.recommendation === "single_skill" ? "一个 Skill 足够" : `${workflowPlan.nodes.length} 个受控节点`}</small></div>
                      <div className="node-tabs">
                        {workflowPlan.nodes.map((node, index) => (
                          <button key={node.id} className={selectedNode.id === node.id ? "active" : ""} onClick={() => setSelectedNodeId(node.id)}>
                            <span>{String(index + 1).padStart(2, "0")}</span><b>{node.label}</b><i className={`risk-${node.autonomyRisk}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="node-verdict">
                      <div className="verdict-kicker"><span>{selectedNode.kind.replaceAll("_", " ")}</span><em>AI 适配度 {selectedNode.aiFit}/100</em></div>
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
                      {selectedNode.score ? <div className="evidence-score"><strong>{selectedNode.score}</strong><span>/ 100<small>证据评分，不是模型自报</small></span></div> : <div className="evidence-note">此节点不需要用大模型包装。</div>}
                      <ul>
                        {selectedNode.acceptance.slice(0, 3).map((item) => <li key={item.id}>✓ {item.label}</li>)}
                        {selectedNode.permissions.slice(0, 2).map((item) => <li key={item.capability}>⌁ {item.capability} · {item.resourceScope}</li>)}
                      </ul>
                    </aside>
                  </section>
                )}

                <div className="route-detail">
                  <div className="detail-copy">
                    <span className="route-index">0{selectedRoute + 1}</span>
                    <div>
                      <small>当前建议</small>
                      <h3>{selectedRoute === 0 ? "先从周报开始，60 秒看到结果。" : "把访谈到 PRD 沉淀成一条可复用链路。"}</h3>
                      <p>{selectedRoute === 0 ? "输入稳定、每周重复、结果可检查。判断和发送仍由你确认。" : "AI 已选好四个节点；你可以先跑官方样例，再决定是否替换其中的 Skill。"}</p>
                    </div>
                  </div>
                  <div className="route-actions">
                    <button className="ghost" onClick={() => setToast("已保存为候选组合")}>保存组合</button>
                    <button className="primary" onClick={() => setStage("lens")}>查看官方样例 <span>↗</span></button>
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
                      <div className="report-head"><div><small>管理层周报 · 第 20 周</small><h3>{diffApplied ? "本周三个关键判断" : "本周经营与项目进展"}</h3></div><span>AI 生成 · 可编辑</span></div>
                      <div className="metric-row">
                        <div><small>新增客户</small><strong>18</strong><em>↑ 20%</em></div>
                        <div><small>活跃用户</small><strong>2,345</strong><em>↑ 11.7%</em></div>
                        <div><small>项目交付率</small><strong>85%</strong><em className="warn">↓ 7pp</em></div>
                      </div>
                      <section><b>关键进展</b><p>新客户上线与活跃用户增长符合预期；Beta 反馈已进入归类和优先级判断。</p></section>
                      <section className="risk"><b>{diffApplied ? "管理层需要确认" : "风险与问题"}</b><p>项目 A 接口对接延迟，可能影响交付周期。建议本周确认资源优先级，并设定二次检查点。</p></section>
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
                    <button onClick={() => setDiffOpen(true)}>生成修改预览 <span>↗</span></button>
                  </div>
                  <div className="inspector-actions"><button className="ghost" onClick={() => setStage("routes")}>返回路径</button><button className="primary" onClick={() => setStage("dashboard")}>采用并进入工作台</button></div>
                </aside>

                {diffOpen && (
                  <div className="diff-popover stage-enter">
                    <div className="diff-title"><span>修改预览</span><button onClick={() => setDiffOpen(false)}>×</button></div>
                    <p>AI 只会改动当前 Skill 的个人版本，原作者版本保持不变。</p>
                    <div className="diff-columns">
                      <div className="removed"><small>删除</small><span>详细项目进度表</span><span>低优先级背景信息</span></div>
                      <div className="kept"><small>保留</small><span>三个核心指标</span><span>风险与问题</span></div>
                      <div className="added"><small>新增</small><span>管理层确认事项</span><span>行动优先级</span></div>
                    </div>
                    <div className="diff-impact"><span>权限：无变化</span><span>篇幅：-42%</span><span>耗时：约 38 秒</span></div>
                    <div className="diff-actions"><button className="ghost" onClick={() => setDiffOpen(false)}>取消</button><button className="primary" onClick={applyDiff}>应用到个人版本</button></div>
                  </div>
                )}
              </div>
            )}

            {stage === "dashboard" && (
              <div className="dashboard-layout stage-enter">
                <aside className="dash-sidebar">
                  <button className="new-task" onClick={() => setStage("home")}>＋ 新建任务</button>
                  <span>工作空间</span>
                  <button className="active">◫ 最近任务</button><button>⌘ 工作流</button><button>◇ 已启用 Skill</button><button>↗ 运行记录</button>
                  <span>最近打开</span>
                  <button><i className="status-dot" /> 管理层周报</button><button>访谈转 PRD</button><button>竞品动态监控</button>
                </aside>
                <div className="dash-main">
                  <div className="dash-head"><div><small>我的空间</small><h2>刚才的路径，已经成为第一个工作对象。</h2></div><button className="primary" onClick={() => setStage("lens")}>继续调整</button></div>
                  <div className="active-project">
                    <div className="project-top"><span className="skill-glyph mint">WR</span><div><small>运行成功 · 个人版本 v2</small><h3>管理层周报</h3></div><button>•••</button></div>
                    <div className="mini-route"><span>飞书 + Excel</span><i>→</i><span>周报生成器</span><i>→</i><span>可编辑周报</span></div>
                    <div className="project-stats"><div><small>预计节省</small><strong>2.1 小时 / 周</strong></div><div><small>下次运行</small><strong>等待你启动</strong></div><div><small>外部动作</small><strong>发送前确认</strong></div></div>
                  </div>
                  <div className="recent-heading"><span>最近结果</span><button>查看全部 ↗</button></div>
                  <div className="recent-grid"><article><i>DOC</i><strong>第 20 周管理层周报</strong><small>刚刚 · 飞书文档</small></article><article><i>PRD</i><strong>用户访谈洞察</strong><small>昨天 · PDF</small></article><article><i>XLS</i><strong>需求池优先级</strong><small>2 天前 · Excel</small></article></div>
                </div>
              </div>
            )}
          </section>
        </section>
      )}

      {toast && <div className="toast"><span>✓</span>{toast}</div>}
    </main>
  );
}
