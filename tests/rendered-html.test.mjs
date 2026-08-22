import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

async function worker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  const workerBundle = await import(workerUrl.href);
  return workerBundle.default;
}

function env(overrides = {}) {
  return {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    ...overrides,
  };
}

function ctx() {
  return { waitUntil() {}, passThroughOnException() {} };
}

function setServerModelEnv(apiKey, model) {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_MODEL;
  if (apiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = apiKey;
  if (model === undefined) delete process.env.OPENAI_MODEL;
  else process.env.OPENAI_MODEL = model;
  return () => {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = previousModel;
  };
}

function interviewRequest(path, body) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const transcript =
  "访谈员：你现在怎么整理访谈？\n用户：我每周要手工复制很多段落到表格，再给每段打标签，通常要花两个小时。\n访谈员：最难的是什么？\n用户：最难的是判断哪些观点真的有证据，我不希望 AI 自己编。";

test("server-renders the Skillflow product shell", async () => {
  const app = await worker();
  const response = await app.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), env(), ctx());
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Skillflow — 从一句任务到可运行能力<\/title>/i);
  assert.match(html, /一句工作目标/);
  assert.match(html, /Skill Command/);
  assert.doesNotMatch(html, developmentPreviewMeta);
  assert.doesNotMatch(html, /react-loading-skeleton|Your site is taking shape/i);
});

test("workflow compiler chooses one Skill for a simple weekly report", async () => {
  const app = await worker();
  const response = await app.fetch(
    interviewRequest("/api/workflows/diagnose", { goal: "整理本周项目进展，生成管理层周报" }),
    env(),
    ctx(),
  );
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.plan.recommendation, "single_skill");
  assert.equal(body.plan.nodes.length, 1);
  assert.equal(body.plan.nodes[0].skillReleaseId, "skillrel_weekly_report_v1");
});

test("workflow compiler builds a controlled interview-to-PRD graph", async () => {
  const app = await worker();
  const response = await app.fetch(
    interviewRequest("/api/workflows/diagnose", {
      goal: "把用户访谈拆成证据和洞察，最终生成可评审 PRD",
      sources: ["访谈记录"],
      audience: "产品团队",
      frequency: "每月",
    }),
    env(),
    ctx(),
  );
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.plan.recommendation, "workflow");
  assert.equal(body.plan.templateId, "interview-to-prd-v1");
  assert.equal(body.plan.nodes.length, 6);
  assert.ok(body.plan.nodes.every((node) => !["script", "shell"].includes(node.kind)));
  const publish = body.plan.nodes.find((node) => node.id === "publish");
  assert.equal(publish.permissions[0].approval, "every_action");
  assert.equal(publish.permissions[0].access, "create");
});

test("public Skill registry is honest about E0 evidence and hides internal license review", async () => {
  const app = await worker();
  const response = await app.fetch(new Request("http://localhost/api/skills?q=访谈"), env(), ctx());
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.skills.length >= 2);
  assert.ok(body.skills.every((skill) => skill.evidence.currentLevel === "E0"));
  assert.ok(body.skills.every((skill) => skill.readiness === "catalog_candidate"));
  assert.doesNotMatch(JSON.stringify(body), /commercial_use_status|internal_tier/i);
});

test("real runtime refuses to fake results when the server model is not configured", async () => {
  const app = await worker();
  const restoreEnv = setServerModelEnv(undefined, undefined);
  try {
    const response = await app.fetch(
      interviewRequest("/api/runs/interview/analyze", {
        researchGoal: "找出产品团队在访谈分析中的低效节点",
        transcript,
      }),
      env(),
      ctx(),
    );
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, "MODEL_NOT_CONFIGURED");
  } finally {
    restoreEnv();
  }
});

test("real runtime executes registered Skills and returns evidence-backed workflow advice", async () => {
  const app = await worker();
  const originalFetch = globalThis.fetch;
  const restoreEnv = setServerModelEnv("server-only-test-key", "test-model");
  const upstreamRequests = [];
  const upstreamBodies = [
    {
      evidence_items: [
        {
          evidence_id: "ev-001",
          segment_id: "seg-002",
          source_id: "source-001",
          category: "pain_point",
          quote: "我每周要手工复制很多段落到表格，再给每段打标签，通常要花两个小时。",
          interpretation: "用户每周花两小时手工整理和标注访谈",
          confidence: 0.98,
          needs_review: false,
          review_reason: null,
        },
        {
          evidence_id: "ev-002",
          segment_id: "seg-004",
          source_id: "source-001",
          category: "need",
          quote: "最难的是判断哪些观点真的有证据，我不希望 AI 自己编。",
          interpretation: "用户要求结论必须可追溯到证据",
          confidence: 0.99,
          needs_review: false,
          review_reason: null,
        },
      ],
      review_queue: [],
      coverage_note: "覆盖重复劳动与证据可信度。",
    },
    {
      themes: [
        {
          theme_id: "theme-01",
          title: "证据可追溯的访谈分析",
          statement: "自动化整理有价值，但每个洞察必须能回到原文。",
          supporting_evidence_ids: ["ev-001", "ev-002"],
          counter_evidence_ids: [],
          independent_source_count: 1,
          strength: "single_case",
          product_implication: "验证 AI 提取加人工确认的工作流。",
          uncertainty: "目前只有一个访谈来源。",
        },
      ],
      unclustered_evidence_ids: [],
      limitations: ["单一来源不能代表全部产品经理。"],
    },
    {
      workflow_nodes: [
        {
          node_id: "work-01",
          work_step: "提取逐字证据",
          current_method: "人工复制段落并打标签",
          ai_decision: "ai_first",
          decision_reason: "重复、规则清楚且输出可反查原文",
          ai_role: "提取逐字引语并保留来源",
          human_role: "抽检引语与解释是否一致",
          recommended_skill_slugs: ["interview-evidence-extractor"],
          skill_combination_logic: "证据提取 Skill 在该节点输出证据卡。",
          risk_level: "low",
          evidence_ids: ["ev-001", "ev-002"],
          success_check: "抽查的引语均可在原片段中找到。",
        },
      ],
      system_summary: "AI 负责重复整理，产品经理负责主题和产品判断。",
      manual_only_work: ["最终需求优先级判断"],
    },
  ];

  globalThis.fetch = async (url, options) => {
    upstreamRequests.push({ url: String(url), options, body: JSON.parse(options.body) });
    const output = upstreamBodies[upstreamRequests.length - 1];
    return Response.json({
      id: `resp_${upstreamRequests.length}`,
      model: "test-model",
      status: "completed",
      output_text: JSON.stringify(output),
      usage: {
        input_tokens: 20 * upstreamRequests.length,
        output_tokens: 10 * upstreamRequests.length,
        total_tokens: 30 * upstreamRequests.length,
        input_tokens_details: { cached_tokens: 2 },
        output_tokens_details: { reasoning_tokens: 3 },
      },
    });
  };

  try {
    const response = await app.fetch(
      interviewRequest("/api/runs/interview/analyze", {
        researchGoal: "找出产品团队在访谈分析中的低效节点",
        transcript,
      }),
      env(),
      ctx(),
    );
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.analysis.evidence[0].evidence_id, "ev-001");
    assert.equal(body.analysis.workflowNodes[0].ai_decision, "ai_first");
    assert.equal(body.receipt.steps.length, 4);
    assert.equal(body.receipt.usage.totalTokens, 180);
    assert.equal(upstreamRequests.length, 3);
    assert.ok(upstreamRequests.every((item) => item.url === "https://api.openai.com/v1/responses"));
    assert.ok(upstreamRequests.every((item) => item.options.headers.authorization === "Bearer server-only-test-key"));
    assert.ok(upstreamRequests.every((item) => item.body.store === false));
    assert.ok(upstreamRequests.every((item) => item.body.text.format.type === "json_schema"));
    assert.doesNotMatch(JSON.stringify(body), /server-only-test-key/);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

test("runtime rejects model quotes that do not exist in the source", async () => {
  const app = await worker();
  const originalFetch = globalThis.fetch;
  const restoreEnv = setServerModelEnv("server-only-test-key", "test-model");
  globalThis.fetch = async () =>
    Response.json({
      id: "resp_hallucinated",
      model: "test-model",
      status: "completed",
      output_text: JSON.stringify({
        evidence_items: [
          {
            evidence_id: "ev-001",
            segment_id: "seg-002",
            source_id: "source-001",
            category: "pain_point",
            quote: "这句话从未出现在访谈原文里",
            interpretation: "伪造证据",
            confidence: 0.99,
            needs_review: false,
            review_reason: null,
          },
        ],
        review_queue: [],
        coverage_note: "测试伪造引用。",
      }),
      usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
    });
  try {
    const response = await app.fetch(
      interviewRequest("/api/runs/interview/analyze", {
        researchGoal: "识别真实需求",
        transcript:
          "访谈员：你怎么做？\n用户：我每周要手工复制很多段落到表格，再给每段打标签，通常要花两个小时。\n用户：所有结论都必须能回到原文，我不接受编造，而且最终主题必须由产品经理亲自确认后才能进入需求评审。",
      }),
      env(),
      ctx(),
    );
    assert.equal(response.status, 502);
    assert.equal((await response.json()).error.code, "MODEL_OUTPUT_INVALID");
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

test("confirmed themes generate a structured PRD, quality report and Markdown", async () => {
  const app = await worker();
  const originalFetch = globalThis.fetch;
  const restoreEnv = setServerModelEnv("server-only-test-key", "test-model");
  globalThis.fetch = async () =>
    Response.json({
      id: "resp_prd",
      model: "test-model",
      status: "completed",
      output_text: JSON.stringify({
        prd: {
          title: "证据驱动的访谈分析",
          background: "产品经理每周手工整理访谈。",
          problem_statement: "手工复制和标注耗时且结论难追溯。",
          goal: "缩短证据整理时间，并保留可追溯性。",
          non_goals: ["自动替代产品经理做最终机会判断"],
          target_users: ["互联网产品经理"],
          user_scenarios: ["产品经理上传访谈后确认 AI 生成的主题"],
          requirements: [
            {
              requirement_id: "REQ-001",
              statement: "逐字证据提取",
              rationale: "减少手工复制且保留来源。",
              priority: "must",
              acceptance_criteria: ["每条引语都是原片段连续子串"],
              evidence_ids: ["ev-001"],
            },
          ],
          success_metrics: [
            {
              metric: "证据引用准确率",
              definition: "可在原片段找到的引语数除以全部输出引语数",
              target: null,
              timeframe: null,
            },
          ],
          risks: [{ risk: "模型遗漏隐含需求", mitigation: "保留人工复核和原文入口" }],
          rollout_plan: ["先验证证据准确率", "再验证主题确认效率"],
        },
        traceability: [
          { requirement_id: "REQ-001", theme_ids: ["theme-01"], evidence_ids: ["ev-001"] },
        ],
        open_questions: ["指标目标值由产品负责人确认"],
        assumptions_to_validate: ["产品经理愿意逐项确认主题"],
      }),
      usage: { input_tokens: 50, output_tokens: 80, total_tokens: 130 },
    });

  const evidence = [
    {
      evidence_id: "ev-001",
      segment_id: "seg-001",
      source_id: "source-001",
      category: "pain_point",
      quote: "我每周要手工复制很多段落到表格",
      interpretation: "人工整理耗时",
      confidence: 0.98,
      needs_review: false,
      review_reason: null,
    },
  ];
  const approvedThemes = [
    {
      theme_id: "theme-01",
      title: "自动整理",
      statement: "减少重复劳动但保留人工确认",
      supporting_evidence_ids: ["ev-001"],
      counter_evidence_ids: [],
      independent_source_count: 1,
      strength: "single_case",
      product_implication: "AI 提取，人确认",
      uncertainty: "只有一个来源",
    },
  ];
  const workflowNodes = [
    {
      node_id: "work-01",
      work_step: "证据提取",
      current_method: "人工复制",
      ai_decision: "ai_first",
      decision_reason: "规则清晰",
      ai_role: "提取引语",
      human_role: "抽检引语",
      recommended_skill_slugs: ["interview-evidence-extractor"],
      skill_combination_logic: "Skill 输出证据卡。",
      risk_level: "low",
      evidence_ids: ["ev-001"],
      success_check: "引语可在原文定位",
    },
  ];

  try {
    const response = await app.fetch(
      interviewRequest("/api/runs/interview/prd", {
        researchGoal: "提高访谈分析效率",
        productContext: "面向互联网产品经理",
        evidence,
        approvedThemes,
        workflowNodes,
      }),
      env(),
      ctx(),
    );
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(body.prd.requirements[0].evidence_ids[0], "ev-001");
    assert.match(body.markdown, /# 证据驱动的访谈分析/);
    assert.match(body.markdown, /`ev-001`/);
    assert.equal(body.quality.decision, "pass_with_notes");
    assert.equal(body.receipt.usage.totalTokens, 130);
    assert.equal(body.receipt.steps.length, 3);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});
