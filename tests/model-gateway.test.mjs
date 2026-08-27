import assert from "node:assert/strict";
import test from "node:test";

const { createStructuredResponse, ModelGatewayError } = await import("../lib/model-gateway.ts");

const ENV_KEYS = [
  "OPENAI_API_KEY", "OPENAI_MODEL", "DEEPSEEK_API_KEY", "DEEPSEEK_MODEL",
  "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "SKILLFLOW_MODEL_ROUTE_DEFAULT",
  "SKILLFLOW_MODEL_ROUTE_DIAGNOSIS", "SKILLFLOW_MODEL_ROUTE_COMPOSITION",
  "SKILLFLOW_MODEL_ROUTE_RUNTIME", "SKILLFLOW_TEST_OPENAI_RESPONSES_URL",
  "SKILLFLOW_TEST_DEEPSEEK_RESPONSES_URL", "SKILLFLOW_TEST_ANTHROPIC_MESSAGES_URL",
];

async function worker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("model-gateway-test", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

function runtimeEnv(overrides = {}) {
  return { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) }, ...overrides };
}

function context() {
  return { waitUntil() {}, passThroughOnException() {} };
}

function interviewRequest() {
  return new Request("http://localhost/api/workflows/interview/turn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      requestSeq: 1,
      message: { id: "user_1", content: "我想整理周报" },
    }),
  });
}

function validTurnOutput() {
  return {
    factPatches: [{
      factId: "fact_goal",
      field: "goal",
      value: "整理周报",
      status: "user_confirmed",
      provenance: [{ messageId: "user_1", quote: "整理周报" }],
      confidence: 1,
      dependsOnFactIds: [],
    }],
    acknowledgement: { text: "我已理解你想整理周报。", factIds: ["fact_goal"] },
    nextQuestion: {
      text: "你现在通常分几步完成周报？",
      targetFields: ["current_step"],
      reason: "当前流程是最高优先级缺口。",
    },
  };
}

function openAiShapedResponse(provider, data) {
  return new Response(JSON.stringify({
    id: `resp_${provider}`,
    model: `${provider}-test-model`,
    status: "completed",
    output_text: JSON.stringify(data),
    usage: {
      input_tokens: 23,
      output_tokens: 17,
      total_tokens: 40,
      input_tokens_details: { cached_tokens: 3 },
      output_tokens_details: { reasoning_tokens: 2 },
    },
  }), {
    status: 200,
    headers: { "content-type": "application/json", "x-request-id": `req_${provider}` },
  });
}

function anthropicResponse(data) {
  return new Response(JSON.stringify({
    id: "msg_anthropic",
    model: "claude-test-model",
    stop_reason: "end_turn",
    content: [{ type: "text", text: JSON.stringify(data) }],
    usage: {
      input_tokens: 31,
      output_tokens: 19,
      cache_read_input_tokens: 4,
      cache_creation_input_tokens: 5,
      output_tokens_details: { thinking_tokens: 7 },
    },
  }), {
    status: 200,
    headers: { "content-type": "application/json", "request-id": "req_anthropic" },
  });
}

async function withEnvironment(values, run) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, values);
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

async function runInterview(app) {
  const response = await app.fetch(interviewRequest(), runtimeEnv(), context());
  return { response, body: await response.json() };
}

test("multi-model config reports provider readiness and never returns secrets", async () => {
  await withEnvironment({
    DEEPSEEK_API_KEY: "deepseek-secret-value",
    DEEPSEEK_MODEL: "deepseek-test-model",
    ANTHROPIC_API_KEY: "anthropic-secret-value",
    ANTHROPIC_MODEL: "claude-test-model",
    SKILLFLOW_MODEL_ROUTE_RUNTIME: "deepseek,anthropic",
  }, async () => {
    const app = await worker();
    const response = await app.fetch(new Request("http://localhost/api/runs/interview/config"), runtimeEnv(), context());
    const raw = await response.text();
    const body = JSON.parse(raw);
    assert.equal(response.status, 200);
    assert.equal(body.configured, true);
    assert.doesNotMatch(raw, /deepseek-secret-value|anthropic-secret-value/);
    assert.doesNotMatch(raw, /deepseek-test-model|claude-test-model/);
    assert.doesNotMatch(raw, /"providers"|"routes"|"diagnosis"|"composition"|"runtime"/i);
  });
});

test("Cloudflare text and secret bindings reach the server-only model gateway", async () => {
  await withEnvironment({}, async () => {
    globalThis.fetch = async () => openAiShapedResponse("deepseek", validTurnOutput());
    const app = await worker();
    const bindings = runtimeEnv({
      DEEPSEEK_API_KEY: "binding-only-key",
      DEEPSEEK_MODEL: "deepseek-test-model",
      SKILLFLOW_MODEL_ROUTE_DIAGNOSIS: "deepseek",
    });
    const result = await app.fetch(interviewRequest(), bindings, context());
    const body = await result.json();
    assert.equal(result.status, 201, JSON.stringify(body));
    assert.equal(body.receipt.provider, "deepseek");
    assert.doesNotMatch(JSON.stringify(body), /binding-only-key/);
  });
});

test("DeepSeek adapter uses its Responses API JSON Schema contract and records the actual provider", async () => {
  await withEnvironment({
    DEEPSEEK_API_KEY: "test-key",
    DEEPSEEK_MODEL: "deepseek-test-model",
    SKILLFLOW_MODEL_ROUTE_DIAGNOSIS: "deepseek",
  }, async () => {
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return openAiShapedResponse("deepseek", validTurnOutput());
    };
    const { response, body } = await runInterview(await worker());
    assert.equal(response.status, 201, JSON.stringify(body));
    assert.equal(body.receipt.provider, "deepseek");
    assert.equal(body.receipt.providerRequestId, "req_deepseek");
    assert.equal(body.receipt.fallbackUsed, false);
    assert.match(calls[0].url, /^https:\/\/api\.deepseek\.com\/responses$/);
    const upstreamBody = JSON.parse(calls[0].init.body);
    assert.equal(upstreamBody.text.format.type, "json_schema");
    assert.equal(upstreamBody.text.format.strict, undefined);
    assert.equal(upstreamBody.store, false);
  });
});

test("Anthropic adapter uses Messages structured outputs and strips unsupported raw-schema constraints", async () => {
  await withEnvironment({
    ANTHROPIC_API_KEY: "test-key",
    ANTHROPIC_MODEL: "claude-test-model",
    SKILLFLOW_MODEL_ROUTE_DIAGNOSIS: "anthropic",
  }, async () => {
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return anthropicResponse(validTurnOutput());
    };
    const { response, body } = await runInterview(await worker());
    assert.equal(response.status, 201, JSON.stringify(body));
    assert.equal(body.receipt.provider, "anthropic");
    assert.equal(body.receipt.providerRequestId, "req_anthropic");
    assert.equal(body.receipt.usage.uncachedInputTokens, 31);
    assert.equal(body.receipt.usage.cachedInputTokens, 4);
    assert.equal(body.receipt.usage.cacheCreationInputTokens, 5);
    assert.equal(body.receipt.usage.inputTokens, 40);
    assert.equal(body.receipt.usage.totalTokens, 59);
    assert.equal(body.receipt.usage.reasoningTokens, 7);
    assert.match(calls[0].url, /^https:\/\/api\.anthropic\.com\/v1\/messages$/);
    assert.equal(calls[0].init.headers["anthropic-version"], "2023-06-01");
    assert.equal(calls[0].init.headers["x-api-key"], "test-key");
    const upstreamBody = JSON.parse(calls[0].init.body);
    assert.equal(upstreamBody.output_config.format.type, "json_schema");
    assert.equal(upstreamBody.messages[0].role, "user");
    assert.doesNotMatch(JSON.stringify(upstreamBody.output_config.format.schema), /maxLength|minLength|maxItems|minItems/);
  });
});

test("transient primary failure falls back once and writes an auditable attempt chain", async () => {
  await withEnvironment({
    OPENAI_API_KEY: "openai-key",
    OPENAI_MODEL: "openai-test-model",
    ANTHROPIC_API_KEY: "anthropic-key",
    ANTHROPIC_MODEL: "claude-test-model",
    SKILLFLOW_MODEL_ROUTE_DIAGNOSIS: "openai,anthropic",
  }, async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount += 1;
      if (callCount === 1) return new Response("rate limited", { status: 429, headers: { "x-request-id": "req_openai_limit" } });
      return anthropicResponse(validTurnOutput());
    };
    const { response, body } = await runInterview(await worker());
    assert.equal(response.status, 201, JSON.stringify(body));
    assert.equal(body.receipt.provider, "anthropic");
    assert.equal(body.receipt.fallbackUsed, true);
    assert.equal(body.receipt.usageCompleteness, "partial");
    assert.equal(body.receipt.attempts.length, 2);
    assert.equal(body.receipt.attempts[0].deliveryState, "provider_responded");
    assert.equal(body.receipt.attempts[0].usageStatus, "unavailable");
    assert.equal(body.receipt.attempts[1].usageStatus, "reported");
    assert.equal(body.receipt.attempts[1].requestId, "req_anthropic");
    assert.deepEqual(body.receipt.attempts.map((item) => [item.provider, item.outcome, item.errorCode]), [
      ["openai", "fallback", "MODEL_UPSTREAM_ERROR"],
      ["anthropic", "succeeded", null],
    ]);
  });
});

test("an exhausted total budget preserves earlier attempts and never calls the fallback", async () => {
  await withEnvironment({
    OPENAI_API_KEY: "openai-key",
    OPENAI_MODEL: "openai-test-model",
    ANTHROPIC_API_KEY: "anthropic-key",
    ANTHROPIC_MODEL: "claude-test-model",
    SKILLFLOW_MODEL_ROUTE_RUNTIME: "openai,anthropic",
  }, async () => {
    let calls = 0;
    const fetchImpl = async (_url, init) => {
      calls += 1;
      return new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
      });
    };
    await assert.rejects(
      createStructuredResponse({
        taskClass: "runtime",
        schemaName: "budget_receipt",
        schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
        instructions: "Return JSON.",
        input: "{}",
        maxOutputTokens: 20,
      }, { fetchImpl, timeoutMs: 20 }),
      (error) => {
        assert.ok(error instanceof ModelGatewayError);
        assert.equal(error.code, "MODEL_TIMEOUT");
        assert.equal(error.details.attempts.length, 1);
        assert.equal(error.details.attempts[0].provider, "openai");
        assert.equal(error.details.attempts[0].deliveryState, "attempted_unknown");
        assert.equal(error.details.attempts[0].usageStatus, "unavailable");
        return true;
      },
    );
    assert.equal(calls, 1);
  });
});

test("invalid structured output never silently switches providers", async () => {
  await withEnvironment({
    OPENAI_API_KEY: "openai-key",
    OPENAI_MODEL: "openai-test-model",
    ANTHROPIC_API_KEY: "anthropic-key",
    ANTHROPIC_MODEL: "claude-test-model",
    SKILLFLOW_MODEL_ROUTE_DIAGNOSIS: "openai,anthropic",
  }, async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount += 1;
      return openAiShapedResponse("openai", "not valid for the business schema");
    };
    const { response, body } = await runInterview(await worker());
    assert.equal(response.status, 502, JSON.stringify(body));
    assert.equal(body.error.code, "MODEL_OUTPUT_INVALID");
    assert.equal(callCount, 1);
  });
});

test("a 200 response with invalid JSON preserves its reported usage", async () => {
  await withEnvironment({
    OPENAI_API_KEY: "openai-key",
    OPENAI_MODEL: "openai-test-model",
    SKILLFLOW_MODEL_ROUTE_RUNTIME: "openai",
  }, async () => {
    const fetchImpl = async () => new Response(JSON.stringify({
      id: "resp_invalid_json",
      model: "openai-test-model",
      status: "completed",
      output_text: "{not-json",
      usage: { input_tokens: 55, output_tokens: 13, total_tokens: 68 },
    }), { status: 200, headers: { "content-type": "application/json", "x-request-id": "req_invalid_json" } });
    await assert.rejects(
      createStructuredResponse({
        taskClass: "runtime",
        schemaName: "invalid_json_usage",
        schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"] },
        instructions: "Return JSON.",
        input: "{}",
        maxOutputTokens: 100,
      }, { fetchImpl }),
      (error) => {
        assert.ok(error instanceof ModelGatewayError);
        assert.equal(error.code, "MODEL_OUTPUT_INVALID");
        assert.equal(error.details.attempts[0].usageStatus, "reported");
        assert.equal(error.details.attempts[0].usage.totalTokens, 68);
        assert.equal(error.details.attempts[0].requestId, "req_invalid_json");
        return true;
      },
    );
  });
});

test("an explicit route with a partially configured provider fails instead of skipping it", async () => {
  await withEnvironment({
    DEEPSEEK_API_KEY: "key-without-model",
    OPENAI_API_KEY: "openai-key",
    OPENAI_MODEL: "openai-test-model",
    SKILLFLOW_MODEL_ROUTE_DIAGNOSIS: "deepseek,openai",
  }, async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount += 1;
      return openAiShapedResponse("openai", validTurnOutput());
    };
    const { response, body } = await runInterview(await worker());
    assert.equal(response.status, 503, JSON.stringify(body));
    assert.equal(body.error.code, "MODEL_CONFIGURATION_ERROR");
    assert.equal(callCount, 0);
  });
});

test("an incompatible DeepSeek model is never reported ready", async () => {
  await withEnvironment({
    DEEPSEEK_API_KEY: "deepseek-key",
    DEEPSEEK_MODEL: "deepseek-chat",
    SKILLFLOW_MODEL_ROUTE_RUNTIME: "deepseek",
  }, async () => {
    const app = await worker();
    const response = await app.fetch(new Request("http://localhost/api/runs/interview/config"), runtimeEnv(), context());
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.configured, false);
  });
});

test("cancellation between provider attempts prevents the private input from reaching fallback", async () => {
  await withEnvironment({
    OPENAI_API_KEY: "openai-key",
    OPENAI_MODEL: "gpt-5.6-mini",
    ANTHROPIC_API_KEY: "anthropic-key",
    ANTHROPIC_MODEL: "claude-sonnet-5",
    SKILLFLOW_MODEL_ROUTE_RUNTIME: "openai,anthropic",
  }, async () => {
    let callCount = 0;
    let cancelled = false;
    const fetchImpl = async () => {
      callCount += 1;
      cancelled = true;
      return new Response("rate limited", { status: 429, headers: { "x-request-id": "req_cancel_primary" } });
    };
    await assert.rejects(
      createStructuredResponse({
        taskClass: "runtime",
        schemaName: "cancel_test",
        schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false },
        instructions: "Return JSON.",
        input: "private interview text",
        maxOutputTokens: 100,
      }, {
        fetchImpl,
        cancellation: {
          check: async () => {
            if (cancelled) throw Object.assign(new Error("run cancelled"), { code: "RUN_CANCELLED" });
          },
        },
      }),
      (error) => error?.code === "RUN_CANCELLED",
    );
    assert.equal(callCount, 1);
  });
});

test("all-provider failure preserves the complete sanitized attempt chain", async () => {
  await withEnvironment({
    OPENAI_API_KEY: "openai-key",
    OPENAI_MODEL: "gpt-5.6-mini",
    ANTHROPIC_API_KEY: "anthropic-key",
    ANTHROPIC_MODEL: "claude-sonnet-5",
    SKILLFLOW_MODEL_ROUTE_RUNTIME: "openai,anthropic",
  }, async () => {
    let callCount = 0;
    const fetchImpl = async () => {
      callCount += 1;
      return new Response("SECRET_TRANSCRIPT_CANARY", {
        status: callCount === 1 ? 429 : 529,
        headers: callCount === 1 ? { "x-request-id": "req_openai_failed" } : { "request-id": "req_anthropic_failed" },
      });
    };
    let caught;
    try {
      await createStructuredResponse({
        taskClass: "runtime",
        schemaName: "failure_test",
        schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false },
        instructions: "Return JSON.",
        input: "private interview text",
        maxOutputTokens: 100,
      }, { fetchImpl });
    } catch (error) {
      caught = error;
    }
    assert.ok(caught instanceof ModelGatewayError);
    assert.equal(callCount, 2);
    assert.deepEqual(caught.details.attempts.map((item) => [item.provider, item.outcome, item.requestId]), [
      ["openai", "fallback", "req_openai_failed"],
      ["anthropic", "failed", "req_anthropic_failed"],
    ]);
    assert.doesNotMatch(JSON.stringify(caught.details), /SECRET_TRANSCRIPT_CANARY|private interview text/);
  });
});
