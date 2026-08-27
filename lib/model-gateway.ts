const PROVIDER_ENDPOINTS = {
  openai: "https://api.openai.com/v1/responses",
  deepseek: "https://api.deepseek.com/responses",
  anthropic: "https://api.anthropic.com/v1/messages",
} as const;

const DEFAULT_TIMEOUT_MS = 45_000;
const FALLBACK_RESERVE_MS = 15_000;
const ANTHROPIC_VERSION = "2023-06-01";

export type ModelProvider = keyof typeof PROVIDER_ENDPOINTS;
export type ModelTaskClass = "diagnosis" | "composition" | "runtime";
export type JsonSchema = Record<string, unknown>;

type RuntimeEnvironment = {
  NODE_ENV?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  SKILLFLOW_MODEL_ROUTE_DEFAULT?: string;
  SKILLFLOW_MODEL_ROUTE_DIAGNOSIS?: string;
  SKILLFLOW_MODEL_ROUTE_COMPOSITION?: string;
  SKILLFLOW_MODEL_ROUTE_RUNTIME?: string;
  SKILLFLOW_TEST_OPENAI_RESPONSES_URL?: string;
  SKILLFLOW_TEST_DEEPSEEK_RESPONSES_URL?: string;
  SKILLFLOW_TEST_ANTHROPIC_MESSAGES_URL?: string;
};

export type ModelUsage = {
  uncachedInputTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
  cacheCreationInputTokens: number;
  reasoningTokens: number;
};

export type ModelAttemptReceipt = {
  provider: ModelProvider;
  model: string;
  outcome: "succeeded" | "fallback" | "failed";
  requestAttempted: boolean;
  deliveryState: "attempted_unknown" | "provider_responded";
  usageStatus: "reported" | "unavailable";
  usage: ModelUsage | null;
  errorCode: ModelGatewayErrorCode | null;
  upstreamStatus: number | null;
  requestId: string | null;
  durationMs: number;
};

export type ModelRunReceipt = {
  provider: ModelProvider;
  model: string;
  responseId: string;
  providerRequestId: string | null;
  status: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  fallbackUsed: boolean;
  usageCompleteness: "complete" | "partial";
  attempts: ModelAttemptReceipt[];
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
  taskClass?: ModelTaskClass;
};

export type ModelGatewayErrorCode =
  | "MODEL_NOT_CONFIGURED"
  | "MODEL_CONFIGURATION_ERROR"
  | "MODEL_CANCELLED"
  | "MODEL_TIMEOUT"
  | "MODEL_UPSTREAM_ERROR"
  | "MODEL_POLICY_REJECTED"
  | "MODEL_OUTPUT_INVALID";

type ProviderConfig = {
  provider: ModelProvider;
  apiKey: string;
  model: string;
};

type ProviderOutput = {
  rawText: string;
  responseId: string;
  providerRequestId: string | null;
  status: string;
  model: string;
  usage: ModelUsage;
};

type ResponsesApiBody = {
  id?: unknown;
  model?: unknown;
  status?: unknown;
  output_text?: unknown;
  output?: unknown;
  error?: { code?: unknown; message?: unknown } | null;
  incomplete_details?: { reason?: unknown } | null;
  usage?: {
    input_tokens?: unknown;
    output_tokens?: unknown;
    total_tokens?: unknown;
    input_tokens_details?: { cached_tokens?: unknown } | null;
    output_tokens_details?: { reasoning_tokens?: unknown } | null;
  } | null;
};

type AnthropicBody = {
  id?: unknown;
  model?: unknown;
  stop_reason?: unknown;
  content?: unknown;
  usage?: {
    input_tokens?: unknown;
    output_tokens?: unknown;
    cache_read_input_tokens?: unknown;
    cache_creation_input_tokens?: unknown;
    output_tokens_details?: { thinking_tokens?: unknown } | null;
  } | null;
};

export type ModelCancellation = {
  check: () => Promise<void>;
  pollIntervalMs?: number;
};

class ProviderAttemptError extends Error {
  readonly provider: ModelProvider;
  readonly model: string;
  readonly code: ModelGatewayErrorCode;
  readonly httpStatus: number;
  readonly retryable: boolean;
  readonly upstreamStatus: number | null;
  readonly requestId: string | null;
  readonly usage: ModelUsage | null;

  constructor(
    provider: ModelProvider,
    model: string,
    code: ModelGatewayErrorCode,
    message: string,
    httpStatus: number,
    retryable: boolean,
    upstreamStatus: number | null = null,
    requestId: string | null = null,
    usage: ModelUsage | null = null,
  ) {
    super(message);
    this.name = "ProviderAttemptError";
    this.provider = provider;
    this.model = model;
    this.code = code;
    this.httpStatus = httpStatus;
    this.retryable = retryable;
    this.upstreamStatus = upstreamStatus;
    this.requestId = requestId;
    this.usage = usage;
  }
}

export class ModelGatewayError extends Error {
  readonly code: ModelGatewayErrorCode;
  readonly httpStatus: number;
  readonly details?: {
    provider?: ModelProvider;
    retryable?: boolean;
    upstreamStatus?: number | null;
    requestId?: string | null;
    attempts?: ModelAttemptReceipt[];
    modelRun?: ModelRunReceipt;
  };

  constructor(
    code: ModelGatewayErrorCode,
    message: string,
    httpStatus: number,
    details?: {
      provider?: ModelProvider;
      retryable?: boolean;
      upstreamStatus?: number | null;
      requestId?: string | null;
      attempts?: ModelAttemptReceipt[];
      modelRun?: ModelRunReceipt;
    },
  ) {
    super(message);
    this.name = "ModelGatewayError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

function runtimeEnvironment(): RuntimeEnvironment {
  return process.env as RuntimeEnvironment;
}

function providerConfig(provider: ModelProvider): ProviderConfig | null {
  const env = runtimeEnvironment();
  const values = provider === "openai"
    ? { apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL }
    : provider === "deepseek"
      ? { apiKey: env.DEEPSEEK_API_KEY, model: env.DEEPSEEK_MODEL }
      : { apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL };
  if (!values.apiKey?.trim() || !values.model?.trim()) return null;
  return { provider, apiKey: values.apiKey.trim(), model: values.model.trim() };
}

function supportsStructuredOutputs(provider: ModelProvider, model: string): boolean {
  const normalized = model.trim().toLowerCase();
  const env = runtimeEnvironment();
  const usesLocalContractEndpoint = provider === "openai"
    ? Boolean(env.SKILLFLOW_TEST_OPENAI_RESPONSES_URL)
    : provider === "deepseek"
      ? Boolean(env.SKILLFLOW_TEST_DEEPSEEK_RESPONSES_URL)
      : Boolean(env.SKILLFLOW_TEST_ANTHROPIC_MESSAGES_URL);
  if (env.NODE_ENV !== "production" && (usesLocalContractEndpoint || normalized.includes("test-model"))) return true;
  if (provider === "deepseek") {
    return new Set(["deepseek-v4-flash", "deepseek-v4-pro", "deepseek-v4-flash-vision-exp"]).has(normalized);
  }
  if (provider === "anthropic") {
    return /^claude-(?:(?:haiku-4-5)|(?:sonnet-(?:4-5|4-6|5))|(?:opus-(?:4-5|4-6|4-7|4-8|5))|(?:fable-5)|(?:mythos-5))(?:-preview)?(?:-\d{8})?$/.test(normalized);
  }
  return /^(?:gpt-(?:4o|4\.1|5)|o[134](?:-|$))/.test(normalized);
}

function providerConfigurationState(provider: ModelProvider) {
  const env = runtimeEnvironment();
  const values = provider === "openai"
    ? { apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL }
    : provider === "deepseek"
      ? { apiKey: env.DEEPSEEK_API_KEY, model: env.DEEPSEEK_MODEL }
      : { apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL };
  const hasKey = Boolean(values.apiKey?.trim());
  const hasModel = Boolean(values.model?.trim());
  return {
    provider,
    configured: hasKey && hasModel && supportsStructuredOutputs(provider, values.model!.trim()),
    fieldsReady: hasKey && hasModel,
    structuredOutputsVerified: hasModel ? supportsStructuredOutputs(provider, values.model!.trim()) : false,
    partial: hasKey !== hasModel,
    model: hasModel ? values.model!.trim() : null,
  };
}

function routeEnvironmentKey(taskClass: ModelTaskClass): keyof RuntimeEnvironment {
  return taskClass === "diagnosis"
    ? "SKILLFLOW_MODEL_ROUTE_DIAGNOSIS"
    : taskClass === "composition"
      ? "SKILLFLOW_MODEL_ROUTE_COMPOSITION"
      : "SKILLFLOW_MODEL_ROUTE_RUNTIME";
}

function parseProviderRoute(value: string | undefined): ModelProvider[] | null {
  if (!value?.trim()) return null;
  const providers = value.split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  if (!providers.length || providers.some((provider) => !(provider in PROVIDER_ENDPOINTS))) {
    throw new ModelGatewayError("MODEL_CONFIGURATION_ERROR", "服务端模型路由配置无效", 503);
  }
  return [...new Set(providers)] as ModelProvider[];
}

function routeFor(taskClass: ModelTaskClass): ModelProvider[] {
  const env = runtimeEnvironment();
  const explicit = parseProviderRoute(env[routeEnvironmentKey(taskClass)] as string | undefined)
    ?? parseProviderRoute(env.SKILLFLOW_MODEL_ROUTE_DEFAULT);
  if (explicit) return explicit;
  const configured = (["openai", "anthropic", "deepseek"] as const).filter((provider) => providerConfig(provider));
  const verified = configured.filter((provider) => supportsStructuredOutputs(provider, providerConfig(provider)!.model));
  return verified.length ? verified : configured;
}

function requiredRoute(taskClass: ModelTaskClass): ProviderConfig[] {
  const route = routeFor(taskClass);
  if (!route.length) {
    throw new ModelGatewayError(
      "MODEL_NOT_CONFIGURED",
      "真实模型运行尚未配置。至少需要为 OpenAI、DeepSeek 或 Anthropic 配置一组服务端密钥与模型。",
      503,
    );
  }
  const configs = route.map((provider) => providerConfig(provider));
  const missingIndex = configs.findIndex((config) => !config);
  if (missingIndex >= 0) {
    throw new ModelGatewayError(
      "MODEL_CONFIGURATION_ERROR",
      `模型路由包含尚未完整配置的 ${route[missingIndex]} 提供商`,
      503,
      { provider: route[missingIndex] },
    );
  }
  const complete = configs as ProviderConfig[];
  const unsupportedIndex = complete.findIndex((config) => !supportsStructuredOutputs(config.provider, config.model));
  if (unsupportedIndex >= 0) {
    const config = complete[unsupportedIndex];
    throw new ModelGatewayError(
      "MODEL_CONFIGURATION_ERROR",
      `${config.provider} 当前模型未通过本产品所需的结构化输出能力校验`,
      503,
      { provider: config.provider },
    );
  }
  return complete;
}

export function modelConfigured(taskClass: ModelTaskClass = "runtime"): boolean {
  try {
    return requiredRoute(taskClass).length > 0;
  } catch {
    return false;
  }
}

export function modelConfigurationStatus() {
  const taskClasses: ModelTaskClass[] = ["diagnosis", "composition", "runtime"];
  const routes = Object.fromEntries(taskClasses.map((taskClass) => {
    try {
      return [taskClass, { configured: requiredRoute(taskClass).length > 0, providers: routeFor(taskClass), issue: null }];
    } catch (error) {
      const issue = error instanceof ModelGatewayError ? error.code : "MODEL_CONFIGURATION_ERROR";
      let providers: ModelProvider[] = [];
      try { providers = routeFor(taskClass); } catch { /* invalid routes are reported through issue */ }
      return [taskClass, { configured: false, providers, issue }];
    }
  }));
  return {
    configured: taskClasses.every((taskClass) => (routes[taskClass] as { configured: boolean }).configured),
    providers: (["openai", "deepseek", "anthropic"] as const).map(providerConfigurationState),
    routes,
  };
}

function endpointFor(provider: ModelProvider): string {
  const env = runtimeEnvironment();
  const testUrl = provider === "openai"
    ? env.SKILLFLOW_TEST_OPENAI_RESPONSES_URL
    : provider === "deepseek"
      ? env.SKILLFLOW_TEST_DEEPSEEK_RESPONSES_URL
      : env.SKILLFLOW_TEST_ANTHROPIC_MESSAGES_URL;
  if (!testUrl?.trim()) return PROVIDER_ENDPOINTS[provider];
  const parsed = new URL(testUrl);
  const isLoopback = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (env.NODE_ENV === "production" || parsed.protocol !== "http:" || !isLoopback) {
    throw new ModelGatewayError(
      "MODEL_CONFIGURATION_ERROR",
      "本地模型测试地址仅允许在开发环境使用 loopback HTTP",
      503,
      { provider },
    );
  }
  return parsed.toString();
}

function numericToken(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function responsesOutputText(body: ResponsesApiBody): string | null {
  if (typeof body.output_text === "string" && body.output_text.trim()) return body.output_text;
  if (!Array.isArray(body.output)) return null;
  const chunks: string[] = [];
  for (const item of body.output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const candidate = part as { text?: unknown; type?: unknown };
      if (candidate.type === "output_text" && typeof candidate.text === "string") chunks.push(candidate.text);
    }
  }
  return chunks.length ? chunks.join("") : null;
}

function anthropicOutputText(body: AnthropicBody): string | null {
  if (!Array.isArray(body.content)) return null;
  const chunks = body.content.flatMap((part) => {
    if (!part || typeof part !== "object") return [];
    const candidate = part as { type?: unknown; text?: unknown };
    return candidate.type === "text" && typeof candidate.text === "string" ? [candidate.text] : [];
  });
  return chunks.length ? chunks.join("") : null;
}

function sanitizedAnthropicSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizedAnthropicSchema);
  if (!value || typeof value !== "object") return value;
  const unsupported = new Set([
    "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf",
    "minLength", "maxLength", "pattern", "minItems", "maxItems", "uniqueItems",
    "minProperties", "maxProperties", "format",
  ]);
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(input)) {
    if (!unsupported.has(key)) output[key] = sanitizedAnthropicSchema(child);
  }
  if (output.type === "object" && output.properties && output.additionalProperties === undefined) {
    output.additionalProperties = false;
  }
  return output;
}

function requestBody(provider: ModelProvider, config: ProviderConfig, request: StructuredResponseRequest): unknown {
  if (provider === "anthropic") {
    return {
      model: config.model,
      max_tokens: request.maxOutputTokens,
      system: request.instructions,
      messages: [{ role: "user", content: request.input }],
      output_config: {
        format: { type: "json_schema", schema: sanitizedAnthropicSchema(request.schema) },
      },
    };
  }
  return {
    model: config.model,
    store: false,
    instructions: request.instructions,
    input: request.input,
    max_output_tokens: request.maxOutputTokens,
    text: {
      format: {
        type: "json_schema",
        name: request.schemaName,
        schema: request.schema,
        ...(provider === "openai" ? { strict: true } : {}),
      },
    },
  };
}

function requestHeaders(config: ProviderConfig): HeadersInit {
  return config.provider === "anthropic"
    ? { "content-type": "application/json", "x-api-key": config.apiKey, "anthropic-version": ANTHROPIC_VERSION }
    : { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` };
}

function responseRequestId(provider: ModelProvider, response: Response): string | null {
  return provider === "anthropic"
    ? response.headers.get("request-id")
    : response.headers.get("x-request-id") ?? response.headers.get("request-id");
}

function safeUpstreamError(config: ProviderConfig, response: Response): ProviderAttemptError {
  const status = response.status;
  const retryable = status === 408 || status === 429 || status >= 500;
  const message = status === 429
    ? `${config.provider} 当前请求较多，请稍后重试`
    : status === 401 || status === 403
      ? `${config.provider} 服务端凭据或模型权限无效`
      : status === 400 || status === 404
        ? `${config.provider} 模型或结构化输出配置无效`
        : `${config.provider} 模型服务暂时不可用（HTTP ${status}）`;
  const code: ModelGatewayErrorCode = status === 401 || status === 403 || status === 400 || status === 404
    ? "MODEL_CONFIGURATION_ERROR"
    : "MODEL_UPSTREAM_ERROR";
  return new ProviderAttemptError(
    config.provider,
    config.model,
    code,
    message,
    retryable ? (status === 429 ? 429 : 502) : 503,
    retryable,
    status,
    responseRequestId(config.provider, response),
  );
}

function parseResponsesApi(config: ProviderConfig, body: ResponsesApiBody, requestId: string | null): ProviderOutput {
  const status = typeof body.status === "string" ? body.status : "unknown";
  const incompleteReason = typeof body.incomplete_details?.reason === "string" ? body.incomplete_details.reason : null;
  if (incompleteReason === "content_filter") {
    throw new ProviderAttemptError(config.provider, config.model, "MODEL_POLICY_REJECTED", "模型服务拒绝处理该内容", 422, false, 200, requestId);
  }
  if (body.error) {
    throw new ProviderAttemptError(config.provider, config.model, "MODEL_UPSTREAM_ERROR", "模型服务报告运行失败", 502, false, 200, requestId);
  }
  if (status === "incomplete" || status === "failed") {
    throw new ProviderAttemptError(config.provider, config.model, "MODEL_OUTPUT_INVALID", "模型未完成结构化输出", 502, false, 200, requestId);
  }
  const rawText = responsesOutputText(body);
  if (!rawText) {
    throw new ProviderAttemptError(config.provider, config.model, "MODEL_OUTPUT_INVALID", "模型没有返回结构化结果", 502, false, 200, requestId);
  }
  const usage = body.usage;
  return {
    rawText,
    responseId: typeof body.id === "string" ? body.id : requestId ?? "unknown",
    providerRequestId: requestId,
    status,
    model: typeof body.model === "string" ? body.model : config.model,
    usage: {
      inputTokens: numericToken(usage?.input_tokens),
      uncachedInputTokens: Math.max(0, numericToken(usage?.input_tokens) - numericToken(usage?.input_tokens_details?.cached_tokens)),
      outputTokens: numericToken(usage?.output_tokens),
      totalTokens: numericToken(usage?.total_tokens),
      cachedInputTokens: numericToken(usage?.input_tokens_details?.cached_tokens),
      cacheCreationInputTokens: 0,
      reasoningTokens: numericToken(usage?.output_tokens_details?.reasoning_tokens),
    },
  };
}

function parseAnthropic(config: ProviderConfig, body: AnthropicBody, requestId: string | null): ProviderOutput {
  const stopReason = typeof body.stop_reason === "string" ? body.stop_reason : "unknown";
  if (stopReason === "refusal") {
    throw new ProviderAttemptError(config.provider, config.model, "MODEL_POLICY_REJECTED", "模型服务拒绝处理该内容", 422, false, 200, requestId);
  }
  if (stopReason === "max_tokens" || stopReason === "model_context_window_exceeded") {
    throw new ProviderAttemptError(config.provider, config.model, "MODEL_OUTPUT_INVALID", "模型未完成结构化输出", 502, false, 200, requestId);
  }
  const rawText = anthropicOutputText(body);
  if (!rawText) {
    throw new ProviderAttemptError(config.provider, config.model, "MODEL_OUTPUT_INVALID", "模型没有返回结构化结果", 502, false, 200, requestId);
  }
  const uncachedInputTokens = numericToken(body.usage?.input_tokens);
  const cachedInputTokens = numericToken(body.usage?.cache_read_input_tokens);
  const cacheCreationInputTokens = numericToken(body.usage?.cache_creation_input_tokens);
  const inputTokens = uncachedInputTokens + cachedInputTokens + cacheCreationInputTokens;
  const outputTokens = numericToken(body.usage?.output_tokens);
  return {
    rawText,
    responseId: typeof body.id === "string" ? body.id : requestId ?? "unknown",
    providerRequestId: requestId,
    status: stopReason,
    model: typeof body.model === "string" ? body.model : config.model,
    usage: {
      inputTokens,
      uncachedInputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      cachedInputTokens,
      cacheCreationInputTokens,
      reasoningTokens: numericToken(body.usage?.output_tokens_details?.thinking_tokens),
    },
  };
}

async function invokeProvider(
  config: ProviderConfig,
  request: StructuredResponseRequest,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  cancellation?: ModelCancellation,
): Promise<ProviderOutput> {
  await cancellation?.check();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let cancellationError: unknown = null;
  let cancellationCheckRunning = false;
  const cancellationPoll = cancellation ? setInterval(() => {
    if (cancellationCheckRunning || cancellationError) return;
    cancellationCheckRunning = true;
    void cancellation.check()
      .catch((error) => {
        cancellationError = error;
        controller.abort();
      })
      .finally(() => { cancellationCheckRunning = false; });
  }, Math.max(250, cancellation.pollIntervalMs ?? 750)) : null;
  let response: Response;
  try {
    response = await fetchImpl(endpointFor(config.provider), {
      method: "POST",
      headers: requestHeaders(config),
      body: JSON.stringify(requestBody(config.provider, config, request)),
      signal: controller.signal,
    });
  } catch (error) {
    if (cancellationError) throw cancellationError;
    if (error instanceof ModelGatewayError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ProviderAttemptError(config.provider, config.model, "MODEL_TIMEOUT", `${config.provider} 模型运行超时`, 504, true);
    }
    throw new ProviderAttemptError(config.provider, config.model, "MODEL_UPSTREAM_ERROR", `无法连接 ${config.provider} 模型服务`, 502, true);
  } finally {
    clearTimeout(timeout);
    if (cancellationPoll) clearInterval(cancellationPoll);
  }
  if (!response.ok) throw safeUpstreamError(config, response);
  const requestId = responseRequestId(config.provider, response);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ProviderAttemptError(config.provider, config.model, "MODEL_OUTPUT_INVALID", "模型服务返回了无法解析的响应", 502, false, response.status, requestId);
  }
  return config.provider === "anthropic"
    ? parseAnthropic(config, body as AnthropicBody, requestId)
    : parseResponsesApi(config, body as ResponsesApiBody, requestId);
}

function attemptReceipt(
  config: ProviderConfig,
  startedAtMs: number,
  outcome: "succeeded" | "fallback" | "failed",
  error: ProviderAttemptError | null,
  requestId: string | null = null,
  usage: ModelUsage | null = null,
): ModelAttemptReceipt {
  const reportedUsage = usage ?? error?.usage ?? null;
  return {
    provider: config.provider,
    model: config.model,
    outcome,
    requestAttempted: true,
    deliveryState: !error || error.upstreamStatus !== null ? "provider_responded" : "attempted_unknown",
    usageStatus: reportedUsage ? "reported" : "unavailable",
    usage: reportedUsage,
    errorCode: error?.code ?? null,
    upstreamStatus: error?.upstreamStatus ?? null,
    requestId: error?.requestId ?? requestId,
    durationMs: Math.max(0, Date.now() - startedAtMs),
  };
}

export async function createStructuredResponse<T>(
  request: StructuredResponseRequest,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number; cancellation?: ModelCancellation } = {},
): Promise<StructuredResponse<T>> {
  const configs = requiredRoute(request.taskClass ?? "runtime");
  const fetchImpl = options.fetchImpl ?? fetch;
  const totalTimeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedMs = Date.now();
  const startedAt = new Date(startedMs).toISOString();
  const deadline = startedMs + totalTimeoutMs;
  const attempts: ModelAttemptReceipt[] = [];

  for (let index = 0; index < configs.length; index += 1) {
    await options.cancellation?.check();
    const config = configs[index];
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new ModelGatewayError("MODEL_TIMEOUT", "模型运行超过总时间预算，已安全终止", 504, { retryable: true, attempts });
    }
    const providersAfterThis = configs.length - index - 1;
    const attemptTimeout = providersAfterThis > 0
      ? Math.max(1, Math.min(remaining, Math.max(5_000, remaining - FALLBACK_RESERVE_MS)))
      : remaining;
    const attemptStarted = Date.now();
    try {
      const output = await invokeProvider(config, request, fetchImpl, attemptTimeout, options.cancellation);
      let data: T;
      try {
        data = JSON.parse(output.rawText) as T;
      } catch {
        throw new ProviderAttemptError(config.provider, config.model, "MODEL_OUTPUT_INVALID", "模型结果不符合约定的 JSON 结构", 502, false, 200, output.providerRequestId, output.usage);
      }
      attempts.push(attemptReceipt(config, attemptStarted, "succeeded", null, output.providerRequestId, output.usage));
      const completedMs = Date.now();
      return {
        data,
        receipt: {
          provider: config.provider,
          model: output.model,
          responseId: output.responseId,
          providerRequestId: output.providerRequestId,
          status: output.status,
          startedAt,
          completedAt: new Date(completedMs).toISOString(),
          durationMs: Math.max(0, completedMs - startedMs),
          fallbackUsed: attempts.length > 1,
          usageCompleteness: attempts.every((attempt) => attempt.usageStatus === "reported") ? "complete" : "partial",
          attempts,
          usage: output.usage,
        },
      };
    } catch (error) {
      if (error instanceof ModelGatewayError) {
        throw new ModelGatewayError(error.code, error.message, error.httpStatus, {
          ...error.details,
          attempts: [...attempts, ...(error.details?.attempts ?? [])],
        });
      }
      if (!(error instanceof ProviderAttemptError)) throw error;
      const providerError = error instanceof ProviderAttemptError
        ? error
        : new ProviderAttemptError(config.provider, config.model, "MODEL_UPSTREAM_ERROR", "模型服务发生未预期错误", 502, false);
      const hasFallback = index < configs.length - 1;
      if (providerError.retryable && hasFallback) {
        attempts.push(attemptReceipt(config, attemptStarted, "fallback", providerError));
        continue;
      }
      attempts.push(attemptReceipt(config, attemptStarted, "failed", providerError));
      throw new ModelGatewayError(providerError.code, providerError.message, providerError.httpStatus, {
        provider: providerError.provider,
        retryable: providerError.retryable,
        upstreamStatus: providerError.upstreamStatus,
        requestId: providerError.requestId,
        attempts,
      });
    }
  }

  throw new ModelGatewayError("MODEL_UPSTREAM_ERROR", "所有已配置的模型服务均不可用", 502, { retryable: true, attempts });
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
