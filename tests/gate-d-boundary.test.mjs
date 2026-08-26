import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

async function worker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("gate-d-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

const runtimeEnv = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
const context = { waitUntil() {}, passThroughOnException() {} };

async function request(app, path, method = "GET", body = undefined) {
  const response = await app.fetch(new Request(`http://localhost${path}`, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), runtimeEnv, context);
  return { response, payload: await response.json() };
}

test("Gate D removes the two stateless runtime success paths", async () => {
  const app = await worker();
  for (const path of ["/api/runs/interview/analyze", "/api/runs/interview/prd"]) {
    const result = await request(app, path, "POST", {});
    assert.equal(result.response.status, 410);
    assert.equal(result.payload.error.code, "LEGACY_RUNTIME_REMOVED");
  }
});

test("all Gate D persistence, run and artifact entry points require server-derived identity", async () => {
  const paths = [
    "app/api/workflows/composition/save/route.ts", "app/api/runs/interview/route.ts",
    "app/api/runs/interview/[runId]/route.ts", "app/api/runs/interview/[runId]/advance/route.ts",
    "app/api/runs/interview/[runId]/approval/route.ts", "app/api/runs/interview/[runId]/cancel/route.ts",
    "app/api/runs/interview/[runId]/approval/revise/route.ts",
    "app/api/artifacts/[artifactId]/download/route.ts", "app/api/workspace/runs/route.ts", "app/api/workspace/workflows/route.ts",
    "app/api/workflows/composition/[workflowVersionId]/route.ts",
  ];
  for (const path of paths) {
    const route = await source(path);
    assert.match(route, /requireGateDWorkspace\(\)/, path);
    assert.doesNotMatch(route, /body\.(?:workspaceId|accountId|storageKey)/, path);
  }
});

test("Gate D schema and migrations freeze durable state, pins, digests, leases and approvals", async () => {
  const [schema, migration0, migration1, migration2, hosting] = await Promise.all([
    source("db/schema.ts"), source("drizzle/0000_bent_millenium_guard.sql"), source("drizzle/0001_mute_rage.sql"),
    source("drizzle/0002_overjoyed_night_nurse.sql"), source(".openai/hosting.json"),
  ]);
  for (const token of ["awaiting_approval", "partial_failed", "provisioning", "runtimePlanDigest", "skillPinSnapshot", "inputArtifactId", "leaseToken", "payloadDigest", "decisionToken"]) {
    assert.match(schema, new RegExp(token));
  }
  assert.match(migration1, /ALTER TABLE `run_steps` ADD `step_key`/);
  assert.match(migration0, /CREATE UNIQUE INDEX `runs_workspace_idempotency_uq`/);
  assert.match(migration1, /CREATE UNIQUE INDEX `approvals_run_action_revision_uq`/);
  assert.match(migration2, /ALTER TABLE `approvals` ADD `decision_token` text/);
  assert.match(schema, /runQuotaClaims/);
  assert.deepEqual(JSON.parse(hosting), {
    project_id: "appgprj_6a88118d5e688191bcd0c4aca3c4aeb9",
    d1: "DB",
    r2: "FILES",
  });
});

test("Gate D commit protocols are server-owned and use D1 batches around aggregate transitions", async () => {
  const [store, runtime, contracts, requestSource, createRoute] = await Promise.all([
    source("lib/gate-d-store.ts"), source("lib/gate-d-runtime.ts"),
    source("lib/gate-d-contracts.ts"), source("lib/gate-d-request.ts"), source("app/api/runs/interview/route.ts"),
  ]);
  assert.match(store, /status: "provisioning"/);
  assert.match(store, /onConflictDoNothing\(\{\s*target: \[runs\.workspaceId, runs\.idempotencyKey\]/s);
  assert.match(store, /await env\.FILES\.head\(storageKey\)/);
  assert.match(store, /await db\.batch\(\[/);
  assert.match(runtime, /decisionToken = `decision_\$\{crypto\.randomUUID\(\)\}`/);
  assert.match(runtime, /eq\(runs\.leaseToken, leaseToken\)/);
  assert.match(runtime, /durableCommitted = true/);
  assert.match(runtime, /committedArtifactIds = \[\]/);
  assert.match(contracts, /hostedExecution !== "built_in"/);
  assert.match(contracts, /RUNTIME_RELEASE_CHANGED/);
  assert.match(contracts, /assertCurrentExecutablePlan/);
  assert.match(runtime, /run\.leaseExpiresAt > nowIso/);
  assert.match(runtime, /reviseApprovedInterviewRun/);
  assert.match(runtime, /expiresAt\} > \$\{decidedAt\}/);
  assert.match(runtime, /baseApprovedArtifactId/);
  assert.match(runtime, /await readArtifact\(workspace\.workspaceId, approvedArtifactId\)[\s\S]*claimActiveRunQuota\(workspace\.workspaceId, runId\);\s*try \{/);
  assert.match(runtime, /status\} not in \('succeeded', 'cancelled'\)/);
  assert.match(store, /status: "pending"/);
  assert.match(store, /claimRunQuota/);
  assert.match(store, /9999-12-31T23:59:59\.999Z/);
  assert.match(requestSource, /new TextDecoder\("utf-8", \{ fatal: true \}\)/);
  assert.doesNotMatch(createRoute, /body\.(?:workspaceId|accountId|storageKey)/);
});

test("Gate D runner exposes real persistence, approval, retry, cancel, reopen and artifact surfaces", async () => {
  const [runner, commandHome, page, markdown] = await Promise.all([
    source("app/components/InterviewRunner.tsx"), source("app/components/CommandHome.tsx"),
    source("app/page.tsx"), source("lib/interview-runtime.ts"),
  ]);
  for (const endpoint of ["/api/runs/interview", "/advance", "/approval", "/cancel", "/download"]) {
    assert.match(runner, new RegExp(endpoint.replaceAll("/", "\\/")));
  }
  assert.match(runner, /createIdempotencyRef\.current \|\|=/);
  assert.match(runner, /!selectedThemes\.length && !addedThemes\.length/);
  assert.match(runner, /approved_analysis/);
  assert.match(runner, /取消并释放运行名额/);
  assert.match(runner, /默认不批准/);
  assert.match(runner, /状态来自 D1，不用定时器伪造/);
  assert.match(commandHome, /\/api\/workspace\/runs/);
  assert.match(commandHome, /\/api\/workspace\/workflows/);
  assert.match(page, /initialRunId=\{resumeRunId\}/);
  assert.match(markdown, /replace\(\/<\/g, "&lt;"\)/);
  assert.match(markdown, /javascript\|vbscript\|data/);
});

test("Gate D persistence revalidates portable revisions without Worker session affinity", async () => {
  const [gateC, gateD] = await Promise.all([source("lib/gate-c-composition.ts"), source("lib/gate-d-contracts.ts")]);
  assert.match(gateC, /validatePortableCompositionRevision/);
  assert.match(gateC, /validateRevisionEnvelope\(candidate, false\)/);
  assert.match(gateD, /validatePortableCompositionRevision\(value\)/);
  assert.doesNotMatch(gateD, /validateCompositionRevision\(value\)/);
});
