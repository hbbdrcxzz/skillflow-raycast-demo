const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_TIMEOUT_MS = 45_000;

type RuntimeEnvironment = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  SKILLFLOW_TEST_OPENAI_RESPONSES_URL?: string;
};

export type JsonSchema = Record<string, unknown>;

export type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  reasoningTokens: number;
};

export type ModelRunReceipt = {
  provider: "openai";
  model: string;
  responseId: string;
  status: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  usage: ModelUsage;
};

export type StructuredResponse<T> = {
  data: T;
  receipt: ModelRunReceipt;
};

export type StructuredResponseRequest = {
  schemaName: string;
  schema: JsonSchema;
  instructions: string;
  input: string;
  maxOutputTokens: number;
};

type OpenAIResponse = {
  id?: unknown;
  model?: unknown;
  status?: unknown;
  output_text?: unknown;
  output?: unknown;
  error?: { code?: unknown; message?: unknown } | null;
  usage?: {
    input_tokens?: unknown;
    output_tokens?: unknown;
    total_tokens?: unknown;
    input_tokens_details?: { cached_tokens?: unknown } | null;
    output_tokens_details?: { reasoning_tokens?: unknown } | null;
  } | null;
};

export class ModelGatewayError extends Error {
  constructor(
    public readonly code:
      | "MODEL_NOT_CONFIGURED"
      | "MODEL_TIMEOUT"
      | "MODEL_UPSTREAM_ERROR"
      | "MODEL_OUTPUT_INVALID",
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "ModelGatewayError";
  }
}

export function modelConfigured(): boolean {
  // Sites/Workers exposes server-side encrypted environment variables to the
  // Node-compatible runtime. This module is never imported by a client file.
  const runtimeEnv = process.env as RuntimeEnvironment;
  return Boolean(runtimeEnv.OPENAI_API_KEY?.trim() && runtimeEnv.OPENAI_MODEL?.trim());
}

function requiredConfiguration() {
  if (!modelConfigured()) {
    throw new ModelGatewayError(
      "MODEL_NOT_CONFIGURED",
      "真实模型运行尚未配置。需要在服务端设置 OPENAI_API_KEY 和 OPENAI_MODEL。",
      503,
    );
  }

  const runtimeEnv = process.env as RuntimeEnvironment;
  return { apiKey: runtimeEnv.OPENAI_API_KEY!.trim(), model: runtimeEnv.OPENAI_MODEL!.trim() };
}

function responsesUrl(): string {
  const runtimeEnv = process.env as RuntimeEnvironment & { NODE_ENV?: string };
  const localTestUrl = runtimeEnv.SKILLFLOW_TEST_OPENAI_RESPONSES_URL?.trim();
  if (!localTestUrl) return OPENAI_RESPONSES_URL;
  const parsed = new URL(localTestUrl);
  const isLocal = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (runtimeEnv.NODE_ENV === "production" || parsed.protocol !== "http:" || !isLocal) {
    throw new ModelGatewayError("MODEL_NOT_CONFIGURED", "本地模型测试地址仅允许在开发环境使用 loopback HTTP", 503);
  }
  return parsed.toString();
}

function numericToken(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function outputText(response: OpenAIResponse): string | null {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  if (!Array.isArray(response.output)) return null;
  const chunks: string[] = [];
  for (const item of response.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown; type?: unknown }).text;
      if (typeof text === "string") chunks.push(text);
    }
  }
  return chunks.length ? chunks.join("") : null;
}

function safeErrorMessage(response: Response): string {
  return response.status === 429
    ? "模型服务当前请求较多，请稍后重试"
    : `模型服务暂时不可用（HTTP ${response.status}）`;
}

export async function createStructuredResponse<T>(
  request: StructuredResponseRequest,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<StructuredResponse<T>> {
  const { apiKey, model } = requiredConfiguration();
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  const startedAt = new Date(started).toISOString();

  let upstream: Response;
  try {
    upstream = await fetchImpl(responsesUrl(), {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        instructions: request.instructions,
        input: request.input,
        max_output_tokens: request.maxOutputTokens,
        text: {
          format: {
            type: "json_schema",
            name: request.schemaName,
            strict: true,
            schema: request.schema,
          },
        },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ModelGatewayError("MODEL_TIMEOUT", `模型运行超过 ${Math.ceil(timeoutMs / 1000)} 秒，已安全终止`, 504);
    }
    throw new ModelGatewayError("MODEL_UPSTREAM_ERROR", "无法连接模型服务，请稍后重试", 502);
  } finally {
    clearTimeout(timeout);
  }

  if (!upstream.ok) {
    const message = safeErrorMessage(upstream);
    throw new ModelGatewayError("MODEL_UPSTREAM_ERROR", message, upstream.status === 429 ? 429 : 502);
  }

  let response: OpenAIResponse;
  try {
    response = (await upstream.json()) as OpenAIResponse;
  } catch {
    throw new ModelGatewayError("MODEL_OUTPUT_INVALID", "模型服务返回了无法解析的响应", 502);
  }

  if (response.error) {
    throw new ModelGatewayError("MODEL_UPSTREAM_ERROR", "模型服务报告运行失败，请稍后重试", 502);
  }

  const rawText = outputText(response);
  if (!rawText) {
    throw new ModelGatewayError("MODEL_OUTPUT_INVALID", "模型没有返回结构化结果", 502);
  }

  let data: T;
  try {
    data = JSON.parse(rawText) as T;
  } catch {
    throw new ModelGatewayError("MODEL_OUTPUT_INVALID", "模型结果不符合约定的 JSON 结构", 502);
  }

  const completed = Date.now();
  const usage = response.usage;
  return {
    data,
    receipt: {
      provider: "openai",
      model: typeof response.model === "string" ? response.model : model,
      responseId: typeof response.id === "string" ? response.id : "unknown",
      status: typeof response.status === "string" ? response.status : "completed",
      startedAt,
      completedAt: new Date(completed).toISOString(),
      durationMs: Math.max(0, completed - started),
      usage: {
        inputTokens: numericToken(usage?.input_tokens),
        outputTokens: numericToken(usage?.output_tokens),
        totalTokens: numericToken(usage?.total_tokens),
        cachedInputTokens: numericToken(usage?.input_tokens_details?.cached_tokens),
        reasoningTokens: numericToken(usage?.output_tokens_details?.reasoning_tokens),
      },
    },
  };
}

export function modelErrorResponse(error: unknown): Response {
  if (error instanceof ModelGatewayError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.httpStatus });
  }

  return Response.json(
    { error: { code: "RUN_FAILED", message: "运行过程中发生未预期错误，请稍后重试" } },
    { status: 500 },
  );
}
