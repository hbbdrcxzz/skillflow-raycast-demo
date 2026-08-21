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

function env() {
  return {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  };
}

function ctx() {
  return { waitUntil() {}, passThroughOnException() {} };
}

test("server-renders the Skillflow product shell", async () => {
  const app = await worker();
  const response = await app.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    env(),
    ctx(),
  );

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
    new Request("http://localhost/api/workflows/diagnose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ goal: "整理本周项目进展，生成管理层周报" }),
    }),
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
    new Request("http://localhost/api/workflows/diagnose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        goal: "把用户访谈拆成证据和洞察，最终生成可评审 PRD",
        sources: ["访谈记录"],
        audience: "产品团队",
        frequency: "每月",
      }),
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
  const response = await app.fetch(
    new Request("http://localhost/api/skills?q=访谈"),
    env(),
    ctx(),
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.skills.length >= 2);
  assert.ok(body.skills.every((skill) => skill.evidence.currentLevel === "E0"));
  assert.ok(body.skills.every((skill) => skill.readiness === "catalog_candidate"));
  assert.doesNotMatch(JSON.stringify(body), /commercial_use_status|internal_tier/i);
});
