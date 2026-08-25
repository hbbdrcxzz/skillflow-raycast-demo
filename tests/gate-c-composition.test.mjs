import assert from "node:assert/strict";
import test from "node:test";

async function worker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("gate-c-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

function runtimeEnv() {
  return { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
}

function context() {
  return { waitUntil() {}, passThroughOnException() {} };
}

function request(path, body) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function post(app, path, body) {
  const response = await app.fetch(request(path, body), runtimeEnv(), context());
  return { response, body: await response.json() };
}

function fact(factId, field, value) {
  return {
    factId,
    field,
    value,
    status: "user_confirmed",
    provenance: [{ messageId: "user_1", quote: value }],
    confidence: 1,
    dependsOnFactIds: [],
    updatedAt: "2026-08-25T00:00:00.000Z",
    confirmedBy: { messageId: "user_1", quote: value },
  };
}

function gateBFactDigest(facts) {
  const content = JSON.stringify([...facts]
    .sort((a, b) => a.factId.localeCompare(b.factId))
    .map(({ factId, field, value, status, provenance, confidence, dependsOnFactIds }) => ({
      factId,
      field,
      value,
      status,
      provenance,
      confidence,
      dependsOnFactIds: [...dependsOnFactIds].sort(),
    })));
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `facts_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function gateBAssessment(step) {
  if (/(审批|拍板|付款|删除|发送|发布|签署|承诺)/.test(step)) {
    return { aiSuitability: "do_not_use_ai", aiResponsibility: "仅整理决策所需信息，不执行该动作。", humanResponsibility: "核对对象、范围和后果并亲自决定或操作。", riskLevel: "high" };
  }
  if (/(整理|提取|归类|汇总|分析|检索|对比)/.test(step)) {
    return { aiSuitability: "ai_assist", aiResponsibility: "处理重复的信息整理并给出可追溯草案。", humanResponsibility: "检查来源、例外和业务判断。", riskLevel: "medium" };
  }
  if (/(撰写|生成|改写|草拟)/.test(step)) {
    return { aiSuitability: "ai_first_with_human_review", aiResponsibility: "依据已确认输入生成初稿。", humanResponsibility: "审阅事实、语气、范围和最终交付。", riskLevel: "medium" };
  }
  return { aiSuitability: "needs_analysis", aiResponsibility: "Gate C 需要结合节点输入输出和候选能力后再判断。", humanResponsibility: "补充该步骤的决策规则、例外和验收方式。", riskLevel: "medium" };
}

function confirmedGateB(overrides = {}) {
  const facts = [
    fact("fact_goal", "goal", overrides.goal ?? "把用户访谈整理成产品洞察"),
    fact("fact_step", "current_step", overrides.step ?? "提取访谈证据并形成洞察"),
    fact("fact_input", "input_data", overrides.input ?? "中文访谈记录"),
    fact("fact_output", "output", overrides.output ?? "可追溯的产品洞察"),
    fact("fact_consumer", "output_consumer", "产品经理"),
    fact("fact_accept", "acceptance_criterion", overrides.acceptance ?? "每条洞察引用原始证据"),
    fact("fact_owner", "responsible_person", "产品经理负责"),
    fact("fact_approval", "human_approval", "发布前人工确认"),
    fact("fact_sensitive", "sensitive_boundary", "不得泄露用户手机号"),
  ];
  const byId = Object.fromEntries(facts.map((item) => [item.factId, item]));
  const pick = (...ids) => ids.map((id) => {
    const item = byId[id];
    return { factId: item.factId, value: item.value, status: item.status, confidence: item.confidence };
  });
  const taskContract = {
    status: "confirmed",
    goal: pick("fact_goal"),
    currentProcess: pick("fact_step"),
    inputs: pick("fact_input"),
    outputs: pick("fact_output"),
    outputConsumers: pick("fact_consumer"),
    acceptanceCriteria: pick("fact_accept"),
    cadence: [],
    tools: [],
    ownersAndApprovals: pick("fact_owner", "fact_approval"),
    exceptions: [],
    sensitiveBoundaries: pick("fact_sensitive"),
    assumptions: [],
    unknowns: [],
    factDigest: gateBFactDigest(facts),
  };
  const snapshot = {
    schemaVersion: "gate-b-v1",
    state: "confirmed",
    requestSeq: 2,
    messages: [{ id: "user_1", role: "user", content: facts.map((item) => item.value).join("；") }],
    facts,
    taskContract,
    sufficiency: { canReview: true, canConfirm: true, missingCriticalFields: [], conflictedCriticalFields: [], reasons: [] },
    acknowledgement: null,
    nextQuestion: null,
    confirmation: { confirmedAt: "2026-08-25T00:00:00.000Z", factDigest: taskContract.factDigest, messageId: "confirm_2" },
  };
  const workflow = {
    status: "abstract_confirmed",
    title: byId.fact_goal.value,
    sourceFactDigest: taskContract.factDigest,
    nodes: [{
      nodeId: "abstract_node_1",
      label: byId.fact_step.value.slice(0, 80),
      purpose: `完成当前流程中已确认的步骤：${byId.fact_step.value}`,
      sourceFactIds: ["fact_step"],
      ...gateBAssessment(byId.fact_step.value),
    }],
    boundaries: ["不得泄露用户手机号", "Gate B 只生成抽象节点；不绑定 SkillRelease、不运行、不保存、不触发外部动作。"],
    generatedAt: "2026-08-25T00:00:00.000Z",
    gateCRequired: true,
  };
  return { snapshot, workflow };
}

function registryManifest(slug, overrides = {}) {
  return {
    slug,
    name: overrides.name ?? slug,
    description: overrides.description ?? "访谈 洞察 中文 证据",
    semantic_hints: overrides.semanticHints ?? ["访谈", "洞察", "证据"],
    inputs: overrides.inputs ?? ["artifact"],
    outputs: overrides.outputs ?? ["artifact"],
    author: { name: "Original Author", verified: true, url: "https://example.com/author" },
    license: { id: "MIT", name: "MIT", url: "https://opensource.org/license/mit" },
    repository: { url: `https://example.com/${slug}` },
    quality: { score: overrides.quality ?? 12, label: "upstream signal" },
    trust: { score: 10, label: "upstream trust" },
    stats: { stars: overrides.stars ?? 10 },
    safety: {
      blocked: overrides.blocked ?? false,
      score: 10,
      human_review_required: true,
      permission_hints: overrides.permissions ?? [],
    },
    execution_policy: overrides.executionPolicy ?? "policy-a",
    ...(overrides.version ? { version: overrides.version } : {}),
  };
}

async function withRegistry({ manifests, search = [] }, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const value = String(url);
    if (value.includes("/api/skills/search?")) {
      return Response.json({ skills: search.map((slug) => ({ slug })) });
    }
    const marker = "/api/registry/manifest/";
    if (value.includes(marker)) {
      const slug = value.slice(value.indexOf(marker) + marker.length).split(/[?#]/)[0];
      const manifest = typeof manifests[slug] === "function" ? manifests[slug]() : manifests[slug];
      if (!manifest) return new Response("missing", { status: 404 });
      return Response.json(manifest);
    }
    throw new Error(`unexpected fetch ${value}`);
  };
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function bootstrapGateB(app, overrides) {
  const handoff = confirmedGateB(overrides);
  const result = await post(app, "/api/workflows/composition/bootstrap", {
    source: { kind: "gate_b_diagnosis", ...handoff },
  });
  assert.equal(result.response.status, 201, JSON.stringify(result.body));
  return result.body.revision;
}

async function bootstrapRegistry(app, slug, taskContext = "把访谈记录转为有证据的产品洞察") {
  const result = await post(app, "/api/workflows/composition/bootstrap", {
    source: { kind: "registry_single", slug, taskContext },
  });
  return result;
}

async function revise(app, baseRevision, mutationId, operations, extra = {}) {
  return post(app, "/api/workflows/composition/revise", {
    mode: "apply",
    baseRevision,
    expectedBaseDigest: baseRevision.graphDigest,
    expectedHeadToken: baseRevision.session.headToken,
    requestSeq: baseRevision.session.headSequence + 1,
    mutationId,
    operations,
    ...extra,
  });
}

test("Gate C golden: confirmed Gate B handoff preserves contract facts and never becomes runnable", async () => {
  const app = await worker();
  const revision = await bootstrapGateB(app);
  assert.equal(revision.source.kind, "gate_b_diagnosis");
  assert.equal(revision.source.confirmedContractSnapshot.inputs[0].factId, "fact_input");
  assert.equal(revision.source.confirmedContractSnapshot.acceptanceCriteria[0].factId, "fact_accept");
  assert.equal(revision.saved, false);
  assert.equal(revision.runnable, false);
  assert.equal(revision.persistence, "session_only");
  assert.equal(revision.nodes[0].executionMode, null);

  const invalid = confirmedGateB();
  invalid.snapshot.state = "review_ready";
  const rejected = await post(app, "/api/workflows/composition/bootstrap", { source: { kind: "gate_b_diagnosis", ...invalid } });
  assert.equal(rejected.response.status, 422);
  assert.equal(rejected.body.error.code, "INVALID_GATE_B_HANDOFF");
});

test("Gate C release pin uses full material manifest, excludes stats, and blocks unsafe supply", async () => {
  let policy = "policy-a";
  let stars = 10;
  const manifests = {
    analyst: () => registryManifest("analyst", { executionPolicy: policy, stars }),
    blocked: registryManifest("blocked", { blocked: true }),
  };
  await withRegistry({ manifests }, async () => {
    const app = await worker();
    const first = await bootstrapRegistry(app, "analyst");
    assert.equal(first.response.status, 201, JSON.stringify(first.body));
    const firstPin = first.body.revision.nodes[0].skillBindings[0].release;
    assert.equal(firstPin.version, null);
    assert.equal(firstPin.pinKind, "manifest_snapshot");
    stars = 999999;
    const statsOnly = await bootstrapRegistry(app, "analyst");
    assert.equal(statsOnly.body.revision.nodes[0].skillBindings[0].release.manifestDigest, firstPin.manifestDigest);
    policy = "policy-b";
    const materialChange = await bootstrapRegistry(app, "analyst");
    const changedPin = materialChange.body.revision.nodes[0].skillBindings[0].release;
    assert.notEqual(changedPin.manifestDigest, firstPin.manifestDigest);
    assert.notEqual(changedPin.releaseId, firstPin.releaseId);
    const blocked = await bootstrapRegistry(app, "blocked");
    assert.equal(blocked.response.status, 451);
    assert.equal(blocked.body.error.code, "RELEASE_BLOCKED");
  });
});

test("Gate C immutable revision serializes concurrent heads, supports exact retry, and allows offline human fallback", async () => {
  await withRegistry({ manifests: { analyst: registryManifest("analyst") } }, async () => {
    const app = await worker();
    const initial = (await bootstrapRegistry(app, "analyst")).body.revision;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error("registry offline"); };
    try {
      const applied = await revise(app, initial, "mut-human", [{ type: "set_execution_mode", nodeId: initial.nodes[0].nodeId, mode: "human_only" }]);
      assert.equal(applied.response.status, 201, JSON.stringify(applied.body));
      assert.equal(applied.body.revision.nodes[0].skillBindings.length, 0);
      assert.equal(initial.nodes[0].skillBindings.length, 1, "old revision must remain immutable");
      const retry = await revise(app, initial, "mut-human", [{ type: "set_execution_mode", nodeId: initial.nodes[0].nodeId, mode: "human_only" }]);
      assert.equal(retry.body.revision.revisionId, applied.body.revision.revisionId);
      assert.equal(retry.body.revision.createdAt, applied.body.revision.createdAt);
      const stale = await revise(app, initial, "mut-other", [{ type: "set_constraints", nodeId: initial.nodes[0].nodeId, constraints: ["只处理中文"] }]);
      assert.equal(stale.response.status, 409);
      assert.equal(stale.body.error.code, "STALE_BASE_REVISION");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test("Gate C can create a new revision that clears an execution decision without mutating history", async () => {
  const app = await worker();
  const initial = await bootstrapGateB(app);
  const nodeId = initial.nodes[0].nodeId;
  const decisionResult = await revise(app, initial, "mut-decide", [{ type: "set_execution_mode", nodeId, mode: "ai_assist" }]);
  assert.equal(decisionResult.response.status, 201, JSON.stringify(decisionResult.body));
  const decided = decisionResult.body.revision;
  const cleared = await revise(app, decided, "mut-clear", [{ type: "clear_execution_mode", nodeId }]);
  assert.equal(cleared.response.status, 201, JSON.stringify(cleared.body));
  assert.equal(cleared.body.revision.nodes[0].executionMode, null);
  assert.equal(cleared.body.revision.nodes[0].status, "needs_execution_decision");
  assert.equal(decided.nodes[0].executionMode, "ai_assist");
  assert.equal(cleared.body.diff.changes.some((item) => item.kind === "execution_mode_changed" && item.after === null), true);
});

test("Gate C single-flight head rejects one of two truly concurrent sibling revisions", async () => {
  const app = await worker();
  const initial = await bootstrapGateB(app);
  const [left, right] = await Promise.all([
    revise(app, initial, "fork-left", [{ type: "set_constraints", nodeId: "abstract_node_1", constraints: ["只处理中文"] }]),
    revise(app, initial, "fork-right", [{ type: "set_execution_mode", nodeId: "abstract_node_1", mode: "human_only" }]),
  ]);
  assert.deepEqual([left.response.status, right.response.status].sort(), [201, 409]);
  const rejected = left.response.status === 409 ? left : right;
  assert.equal(rejected.body.error.code, "STALE_BASE_REVISION");
});

test("Gate C permissions expose a surface digest, require review, and invalidate review after a binding change", async () => {
  const permission = [{ id: "documents.read", label: "Read docs", severity: "medium", reason: "读取输入" }];
  await withRegistry({
    manifests: {
      analyst: registryManifest("analyst", { permissions: permission }),
      reviewer: registryManifest("reviewer", { permissions: [{ id: "documents.write", label: "Write docs", severity: "medium", reason: "写入草稿" }] }),
    },
  }, async () => {
    const app = await worker();
    const initial = (await bootstrapRegistry(app, "analyst")).body.revision;
    const configuredMode = await revise(app, initial, "mut-mode", [{ type: "set_execution_mode", nodeId: initial.nodes[0].nodeId, mode: "ai_assist" }]);
    const needsReview = configuredMode.body.revision;
    const node = needsReview.nodes[0];
    assert.equal(node.status, "needs_permission_review");
    assert.match(node.permissionSurfaceDigest, /^sha256:/);
    assert.equal(node.permissionReviewDigest, null);
    const acknowledged = await revise(app, needsReview, "mut-ack", [{ type: "acknowledge_permissions", nodeId: node.nodeId, permissionDigest: node.permissionSurfaceDigest }]);
    assert.equal(acknowledged.response.status, 201, JSON.stringify(acknowledged.body));
    assert.equal(acknowledged.body.revision.nodes[0].status, "configured");
    assert.equal(acknowledged.body.revision.nodes[0].permissionReviewDigest, node.permissionSurfaceDigest);
    const replaced = await revise(app, acknowledged.body.revision, "mut-replace", [{
      type: "replace_release",
      nodeId: node.nodeId,
      bindingId: acknowledged.body.revision.nodes[0].skillBindings[0].bindingId,
      selector: { source: "openagentskill", slug: "reviewer" },
    }]);
    assert.equal(replaced.body.revision.nodes[0].status, "needs_permission_review");
    assert.equal(replaced.body.revision.nodes[0].permissionReviewDigest, null);
    assert.notEqual(replaced.body.revision.nodes[0].permissionSurfaceDigest, node.permissionSurfaceDigest);
  });
});

test("Gate C rejects high-risk ai_auto and validates ordered multi-Skill compatibility", async () => {
  const highPermission = [{ id: "message.send", label: "Send", severity: "high", reason: "对外发送" }];
  await withRegistry({
    manifests: {
      dangerous: registryManifest("dangerous", { permissions: highPermission }),
      prepare: registryManifest("prepare", { inputs: ["artifact"], outputs: ["schema:insight.v1"] }),
      review: registryManifest("review", { inputs: ["schema:insight.v1"], outputs: ["schema:review.v1"] }),
      "generic-prepare": registryManifest("generic-prepare", { inputs: ["artifact"], outputs: ["artifact"] }),
      "generic-review": registryManifest("generic-review", { inputs: ["artifact"], outputs: ["artifact"] }),
      "version-mismatch": registryManifest("version-mismatch", { inputs: ["schema:insight.v2"], outputs: ["schema:review.v2"] }),
    },
  }, async () => {
    const app = await worker();
    const direct = (await bootstrapRegistry(app, "dangerous")).body.revision;
    const denied = await revise(app, direct, "mut-auto", [{ type: "set_execution_mode", nodeId: direct.nodes[0].nodeId, mode: "ai_auto" }]);
    assert.equal(denied.response.status, 422);
    assert.equal(denied.body.error.code, "HIGH_RISK_AUTOMATION_DENIED");

    const base = await bootstrapGateB(app);
    const mode = (await revise(app, base, "m1", [{ type: "set_execution_mode", nodeId: "abstract_node_1", mode: "ai_assist" }])).body.revision;
    const one = (await revise(app, mode, "m2", [{ type: "bind_release", nodeId: "abstract_node_1", selector: { source: "openagentskill", slug: "prepare", canonicalName: "forged", version: "99.0.0" }, role: "primary" }])).body.revision;
    assert.equal(one.nodes[0].skillBindings[0].release.canonicalName, "prepare");
    assert.equal(one.nodes[0].skillBindings[0].release.version, null);
    const twoResult = await revise(app, one, "m3", [{ type: "bind_release", nodeId: "abstract_node_1", selector: { source: "openagentskill", slug: "review" }, role: "review" }]);
    assert.equal(twoResult.response.status, 201, JSON.stringify(twoResult.body));
    const two = twoResult.body.revision.nodes[0];
    assert.equal(two.compositionMode, "sequence");
    assert.deepEqual(two.skillBindings.map((binding) => binding.order), [0, 1]);
    assert.equal(two.compatibility[0].status, "compatible");

    const genericBase = await bootstrapGateB(app, { riskLevel: "low", goal: "整理通用文档", step: "准备并复核文档" });
    const genericMode = (await revise(app, genericBase, "g1", [{ type: "set_execution_mode", nodeId: genericBase.nodes[0].nodeId, mode: "ai_assist" }])).body.revision;
    const genericOne = (await revise(app, genericMode, "g2", [{ type: "bind_release", nodeId: genericBase.nodes[0].nodeId, selector: { source: "openagentskill", slug: "generic-prepare" }, role: "primary" }])).body.revision;
    const genericTwoResult = await revise(app, genericOne, "g3", [{ type: "bind_release", nodeId: genericBase.nodes[0].nodeId, selector: { source: "openagentskill", slug: "generic-review" }, role: "review" }]);
    assert.equal(genericTwoResult.response.status, 201, JSON.stringify(genericTwoResult.body));
    const genericTwo = genericTwoResult.body.revision;
    assert.equal(genericTwo.nodes[0].compatibility[0].status, "unknown");
    assert.equal(genericTwo.nodes[0].status, "needs_compatibility_resolution");
    assert.match(genericTwo.nodes[0].compatibility[0].reason, /自然语言同词/);

    const mismatchBase = await bootstrapGateB(app, { riskLevel: "low", goal: "整理结构化洞察", step: "准备并复核洞察" });
    const mismatchMode = (await revise(app, mismatchBase, "x1", [{ type: "set_execution_mode", nodeId: mismatchBase.nodes[0].nodeId, mode: "ai_assist" }])).body.revision;
    const mismatchOne = (await revise(app, mismatchMode, "x2", [{ type: "bind_release", nodeId: mismatchBase.nodes[0].nodeId, selector: { source: "openagentskill", slug: "prepare" }, role: "primary" }])).body.revision;
    const mismatchTwoResult = await revise(app, mismatchOne, "x3", [{ type: "bind_release", nodeId: mismatchBase.nodes[0].nodeId, selector: { source: "openagentskill", slug: "version-mismatch" }, role: "review" }]);
    assert.equal(mismatchTwoResult.response.status, 201, JSON.stringify(mismatchTwoResult.body));
    const mismatchTwo = mismatchTwoResult.body.revision;
    assert.equal(mismatchTwo.nodes[0].compatibility[0].status, "incompatible");
    assert.match(mismatchTwo.nodes[0].compatibility[0].reason, /不一致/);
  });
});

test("Gate C rejects no-op revisions for null clear, repeated values, original order and repeated permission review", async () => {
  const permission = [{ id: "documents.read", label: "Read docs", severity: "medium", reason: "读取输入" }];
  await withRegistry({ manifests: { analyst: registryManifest("analyst", { permissions: permission }) } }, async () => {
    const app = await worker();
    const initial = await bootstrapGateB(app);
    const nodeId = initial.nodes[0].nodeId;
    const clearNull = await revise(app, initial, "noop-clear", [{ type: "clear_execution_mode", nodeId }]);
    assert.equal(clearNull.response.status, 409);
    assert.equal(clearNull.body.error.code, "NO_SEMANTIC_CHANGE");

    const decided = (await revise(app, initial, "real-mode", [{ type: "set_execution_mode", nodeId, mode: "human_only" }])).body.revision;
    const sameMode = await revise(app, decided, "noop-mode", [{ type: "set_execution_mode", nodeId, mode: "human_only" }]);
    assert.equal(sameMode.body.error.code, "NO_SEMANTIC_CHANGE");
    const constrained = (await revise(app, decided, "real-constraints", [{ type: "set_constraints", nodeId, constraints: ["只处理中文"] }])).body.revision;
    const sameConstraints = await revise(app, constrained, "noop-constraints", [{ type: "set_constraints", nodeId, constraints: ["只处理中文"] }]);
    assert.equal(sameConstraints.body.error.code, "NO_SEMANTIC_CHANGE");

    const direct = (await bootstrapRegistry(app, "analyst")).body.revision;
    const bindingId = direct.nodes[0].skillBindings[0].bindingId;
    const sameOrder = await revise(app, direct, "noop-order", [{ type: "reorder_releases", nodeId: direct.nodes[0].nodeId, bindingIds: [bindingId] }]);
    assert.equal(sameOrder.body.error.code, "NO_SEMANTIC_CHANGE");
    const mode = (await revise(app, direct, "real-ai-mode", [{ type: "set_execution_mode", nodeId: direct.nodes[0].nodeId, mode: "ai_assist" }])).body.revision;
    const acknowledged = (await revise(app, mode, "real-ack", [{ type: "acknowledge_permissions", nodeId: mode.nodes[0].nodeId, permissionDigest: mode.nodes[0].permissionSurfaceDigest }])).body.revision;
    const repeatedAck = await revise(app, acknowledged, "noop-ack", [{ type: "acknowledge_permissions", nodeId: acknowledged.nodes[0].nodeId, permissionDigest: acknowledged.nodes[0].permissionSurfaceDigest }]);
    assert.equal(repeatedAck.body.error.code, "NO_SEMANTIC_CHANGE");
    assert.equal(acknowledged.revisionNumber, 2);
  });
});

test("Gate C recommendation never turns popularity or retrieval rank into task-fit evidence", async () => {
  await withRegistry({
    manifests: {
      viral: registryManifest("viral", { name: "Unrelated Viral", description: "astronomy telescope", semanticHints: ["astronomy"], quality: 100, stars: 9_999_999 }),
      grounded: registryManifest("grounded", { name: "访谈洞察证据器", description: "访谈 洞察 证据", semanticHints: ["访谈", "洞察", "证据"], quality: 1, stars: 0 }),
    },
    search: ["viral", "grounded"],
  }, async () => {
    const app = await worker();
    const revision = await bootstrapGateB(app);
    const result = await post(app, "/api/workflows/composition/recommend", { revision, nodeId: "abstract_node_1", limit: 8 });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    assert.notEqual(result.body.recommendation.primary.release.slug, "viral");
    assert.ok(result.body.recommendation.primary.assessment.structureFit.evidencePaths.length > 0);
    assert.ok(result.body.recommendation.alternatives.every((item) => item.release.slug !== "viral"));
  });

  await withRegistry({
    manifests: { viral: registryManifest("viral", { name: "Unrelated Viral", description: "astronomy telescope", semanticHints: ["astronomy"], quality: 100 }) },
    search: ["viral"],
  }, async () => {
    const app = await worker();
    const revision = await bootstrapGateB(app, {
      goal: "zetaquux",
      step: "zetaquux",
      input: "zetaquux",
      output: "zetaquux",
      acceptance: "zetaquux",
      label: "zetaquux",
      purpose: "zetaquux",
    });
    const result = await post(app, "/api/workflows/composition/recommend", { revision, nodeId: "abstract_node_1" });
    assert.equal(result.body.recommendation.primary, null);
    assert.equal(result.body.recommendation.status, "no_match");
  });
});

test("Gate C recommendation excludes releases already bound to the current node", async () => {
  await withRegistry({
    manifests: { analyst: registryManifest("analyst", { name: "访谈洞察分析", semanticHints: ["访谈", "洞察", "证据"] }) },
    search: ["analyst"],
  }, async () => {
    const app = await worker();
    const revision = (await bootstrapRegistry(app, "analyst", "访谈洞察证据")).body.revision;
    const result = await post(app, "/api/workflows/composition/recommend", { revision, nodeId: revision.nodes[0].nodeId });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    const releaseIds = [result.body.recommendation.primary, ...result.body.recommendation.alternatives]
      .filter(Boolean)
      .map((item) => item.release.releaseId);
    const sourceSkillKeys = [result.body.recommendation.primary, ...result.body.recommendation.alternatives]
      .filter(Boolean)
      .map((item) => `${item.release.source}:${item.release.sourceSkillKey}`);
    assert.equal(releaseIds.includes(revision.nodes[0].skillBindings[0].release.releaseId), false);
    assert.equal(sourceSkillKeys.includes(`${revision.nodes[0].skillBindings[0].release.source}:${revision.nodes[0].skillBindings[0].release.sourceSkillKey}`), false);
  });
});

test("Gate C validate tolerates volatile stats, reports material release drift, and preserves the revision", async () => {
  let stars = 1;
  let policy = "policy-a";
  await withRegistry({ manifests: { analyst: () => registryManifest("analyst", { stars, executionPolicy: policy }) } }, async () => {
    const app = await worker();
    const revision = (await bootstrapRegistry(app, "analyst")).body.revision;
    stars = 999;
    const statsValidation = await post(app, "/api/workflows/composition/validate", { revision });
    assert.equal(statsValidation.response.status, 200);
    assert.equal(statsValidation.body.validation.errors.some((error) => error.code === "RELEASE_CHANGED"), false);
    assert.equal(statsValidation.body.revisionPreserved, true);
    policy = "policy-b";
    const materialValidation = await post(app, "/api/workflows/composition/validate", { revision });
    assert.equal(materialValidation.response.status, 200);
    assert.equal(materialValidation.body.validation.errors.some((error) => error.code === "RELEASE_CHANGED"), true);
  });
});

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
}

async function digest(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(value)));
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${[...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

test("Gate C rejects a self-consistent revision from an unknown or expired session", async () => {
  const app = await worker();
  const revision = structuredClone(await bootstrapGateB(app));
  revision.session.sessionId = "composition_session_unknown";
  revision.session.headToken = "head_unknown";
  const material = { ...revision };
  delete material.contentDigest;
  delete material.revisionId;
  revision.contentDigest = await digest(material);
  revision.revisionId = `session_revision_${revision.contentDigest.slice(7, 23)}`;
  const result = await post(app, "/api/workflows/composition/validate", { revision });
  assert.equal(result.response.status, 409, JSON.stringify(result.body));
  assert.equal(result.body.error.code, "SESSION_EXPIRED");
});

test("Gate C natural-language changes return a real before/after preview and never mutate the revision", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_MODEL;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "test-model";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("api.openai.com/v1/responses")) {
      return Response.json({
        id: "resp_gate_c",
        model: "test-model",
        status: "completed",
        output_text: JSON.stringify({
          operations: [{
            type: "set_execution_mode",
            nodeId: "abstract_node_1",
            mode: "human_only",
            constraints: [],
            bindingId: null,
            bindingIds: [],
            reason: "用户要求不使用 AI",
          }],
          unresolvedVariantRequirements: [],
        }),
        usage: { input_tokens: 10, output_tokens: 10, total_tokens: 20 },
      });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  try {
    const app = await worker();
    const revision = await bootstrapGateB(app);
    const result = await post(app, "/api/workflows/composition/revise", {
      mode: "propose",
      baseRevision: revision,
      expectedBaseDigest: revision.graphDigest,
      expectedHeadToken: revision.session.headToken,
      instruction: "这个节点不要使用 AI",
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.body));
    const change = result.body.proposal.previewDiff.changes.find((item) => item.kind === "execution_mode_changed");
    assert.equal(change.before, null);
    assert.equal(change.after, "human_only");
    assert.equal(result.body.proposal.applied, false);
    assert.equal(result.body.revisionId, revision.revisionId);
  } finally {
    globalThis.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = previousModel;
  }
});

test("Gate C natural-language proposal refuses honestly when the model is not configured", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_MODEL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  try {
    const app = await worker();
    const revision = await bootstrapGateB(app);
    const result = await post(app, "/api/workflows/composition/revise", {
      mode: "propose",
      baseRevision: revision,
      expectedBaseDigest: revision.graphDigest,
      expectedHeadToken: revision.session.headToken,
      instruction: "改成不使用 AI",
    });
    assert.equal(result.response.status, 503, JSON.stringify(result.body));
    assert.equal(result.body.error.code, "MODEL_NOT_CONFIGURED");
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = previousModel;
  }
});
