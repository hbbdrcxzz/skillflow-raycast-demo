/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  FILES: R2Bucket;
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
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const MODEL_ENV_KEYS = [
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_MODEL",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "SKILLFLOW_MODEL_ROUTE_DEFAULT",
  "SKILLFLOW_MODEL_ROUTE_DIAGNOSIS",
  "SKILLFLOW_MODEL_ROUTE_COMPOSITION",
  "SKILLFLOW_MODEL_ROUTE_RUNTIME",
] as const satisfies readonly (keyof Env)[];

function exposeModelBindingsToServerRuntime(env: Env) {
  // Cloudflare exposes text/secrets through process.env on current compatibility
  // dates. Copying only this allowlist also keeps the contract reliable on older
  // Sites runtimes without replacing the global environment object.
  for (const key of MODEL_ENV_KEYS) {
    const value = env[key];
    if (typeof value === "string") process.env[key] = value;
  }
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    exposeModelBindingsToServerRuntime(env);
    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
