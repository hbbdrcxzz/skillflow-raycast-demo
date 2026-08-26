import http from "node:http";

const port = Number(process.env.SKILLFLOW_MOCK_PORT || 4010);
const failedOnce = new Set();

function outputFor(schemaName, input) {
  if (schemaName === "interview_evidence_v1") {
    const segment = input.normalized_segments.find((item) => item.text.includes("证据")) || input.normalized_segments[0];
    return {
      evidence_items: [{
        evidence_id: "ev-001", segment_id: segment.segment_id, source_id: segment.source_id,
        category: "pain_point", quote: segment.text, interpretation: "用户要求 AI 产出必须保留可回查的原始证据。",
        confidence: 0.96, needs_review: false, review_reason: null,
      }],
      review_queue: [], coverage_note: "本地 Gate D 验收桩：提取一条可逐字校验的证据。",
    };
  }
  if (schemaName === "interview_insights_v1") {
    return {
      themes: [{
        theme_id: "theme-01", title: "证据可追溯", statement: "AI 生成的洞察必须能够回查原始访谈。",
        supporting_evidence_ids: ["ev-001"], counter_evidence_ids: [], independent_source_count: 1,
        strength: "single_case", product_implication: "所有洞察与需求保留 evidence_id。", uncertainty: "目前仅有一份样例访谈。",
      }],
      unclustered_evidence_ids: [], limitations: ["只有一个访谈来源，不能推断人群普遍性。"],
    };
  }
  if (schemaName === "workflow_ai_assessment_v1") {
    return {
      workflow_nodes: [{
        node_id: "work-01", work_step: "从访谈中提取证据并生成洞察", current_method: "手动复制原文并归类",
        ai_decision: "assistive_ai", decision_reason: "文本整理重复但最终产品判断需要人工负责。",
        ai_role: "提取逐字证据、聚类并生成可追溯草稿", human_role: "核对原文并决定是否采用主题",
        recommended_skill_slugs: ["interview-evidence-extractor", "user-insight-clusterer"],
        skill_combination_logic: "先证据提取，再以 evidence_id 聚类。", risk_level: "medium",
        evidence_ids: ["ev-001"], success_check: "每个主题均引用存在且可回查的 evidence_id。",
      }],
      system_summary: "AI 负责重复整理，人负责证据核对和主题批准。", manual_only_work: ["需求优先级与是否立项"],
    };
  }
  if (schemaName === "evidence_backed_prd_v1") {
    const themeId = input.approved_themes[0].theme_id;
    const evidenceId = input.evidence_items[0].evidence_id;
    return {
      prd: {
        title: "<script>alert(1)</script> 访谈证据到 PRD 的可追溯工作台", background: "javascript:alert(1) 产品经理需要减少重复复制，同时保留判断依据。",
        problem_statement: "洞察与 PRD 需求容易脱离原始访谈证据，导致结果难以复核。",
        goal: "让产品经理在人工批准主题后获得可回查证据的 PRD 初稿。",
        non_goals: ["不替产品经理决定需求优先级", "不向外部业务系统写入数据"], target_users: ["互联网产品经理", "产品运营"],
        user_scenarios: ["上传访谈文本后核对逐字证据与主题，再批准生成 PRD。"],
        requirements: [{
          requirement_id: "REQ-001", statement: "每条 PRD 需求必须引用本次运行的证据 ID。",
          rationale: "可追溯性是用户采用 AI 草稿的前提。", priority: "must",
          acceptance_criteria: ["需求显示有效 evidence_id", "点击或查找 ID 可对应到本次运行的逐字证据"], evidence_ids: [evidenceId],
        }],
        success_metrics: [{ metric: "可追溯需求占比", definition: "带有效 evidence_id 的需求数除以总需求数", target: null, timeframe: null }],
        risks: [{ risk: "单一访谈被误认为普遍结论", mitigation: "显示独立来源数和局限，并保留人工批准。" }],
        rollout_plan: ["先用私有样例材料验证证据链", "再用一份真实脱敏访谈进行人工验收"],
      },
      traceability: [{ requirement_id: "REQ-001", theme_ids: [themeId], evidence_ids: [evidenceId] }],
      open_questions: ["由产品负责人确认指标目标值与观察周期。"], assumptions_to_validate: ["用户愿意逐条确认主题后再生成 PRD。"],
    };
  }
  throw new Error(`unsupported schema ${schemaName}`);
}

const server = http.createServer((request, response) => {
  if (request.method !== "POST") {
    response.writeHead(405).end();
    return;
  }
  let raw = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => { raw += chunk; });
  request.on("end", () => {
    try {
      const payload = JSON.parse(raw);
      const schemaName = payload.text?.format?.name;
      const input = JSON.parse(payload.input);
      if (String(input.research_goal || "").includes("UPSTREAM_CANARY")) {
        response.writeHead(400, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: { message: "SECRET_TRANSCRIPT_CANARY should never be persisted or returned" } }));
        return;
      }
      const failKey = `${schemaName}:${String(input.research_goal || "")}`;
      if (String(input.research_goal || "").includes("FAIL_ONCE") && !failedOnce.has(failKey)) {
        failedOnce.add(failKey);
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ id: "resp_malformed_once", model: "gate-d-local-contract-model", status: "completed", output_text: "{not-json", usage: {} }));
        return;
      }
      const output = outputFor(schemaName, input);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({
        id: `resp_${schemaName}`, model: "gate-d-local-contract-model", status: "completed",
        output_text: JSON.stringify(output), usage: { input_tokens: 100, output_tokens: 80, total_tokens: 180 },
      }));
    } catch (error) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { message: error instanceof Error ? error.message : "mock failed" } }));
    }
  });
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Gate D local model contract server: http://127.0.0.1:${port}/v1/responses\n`);
});
