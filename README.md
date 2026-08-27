# Skillflow

面向中国互联网产品与运营用户的 AI Skill 商店与工作台。当前私有 MVP 包含真实上游 Skill Registry、自然语言工作诊断、节点级 Skill 组合，以及受控的“访谈材料 → 可审阅 PRD”沙箱运行。应用运行于 [vinext](https://github.com/cloudflare/vinext)，D1 保存工作流、运行、审批与回执，R2 保存用户上传副本和生成的 Artifact。

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Product Boundary

- MVP 不执行任意第三方脚本。只有平台内置、固定版本、经过允许列表校验的运行适配器可执行。
- 公共 Skill 可以被搜索、查看、比较和组成工作流，但“被收录”不等于“已通过本地安全审查”或“可在本站运行”。
- 私有材料只在登录后的 Personal Workspace 中保存和运行；模型调用会把本次任务所需内容发送给配置的外部模型提供商。
- 缺少模型配置、输出格式错误、审批过期、用户取消或持久化失败时，系统必须返回真实失败状态，不生成模拟成功结果。

## Server-side Model Gateway

所有 AI 业务调用经过 `lib/model-gateway.ts` 的统一结构化输出契约。浏览器不能提交 API Key、任意 base URL 或模型名；提供商、模型与路由仅由服务端环境变量控制。当前适配 OpenAI Responses API、DeepSeek Responses API 与 Anthropic Messages API。

本地开发时复制 `.dev.vars.example` 为 `.dev.vars`，只填写实际需要的提供商。真实密钥不得提交到 Git：

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
```

路由值是逗号分隔的提供商顺序，可分别为工作诊断、Skill 组合和沙箱运行配置：

```dotenv
SKILLFLOW_MODEL_ROUTE_DIAGNOSIS=deepseek,anthropic
SKILLFLOW_MODEL_ROUTE_COMPOSITION=anthropic,openai
SKILLFLOW_MODEL_ROUTE_RUNTIME=anthropic,deepseek
```

只有连接失败、超时、HTTP 408/429 或上游 5xx 才会尝试下一个提供商。鉴权/模型配置错误、政策拒绝、截断、非法 JSON、语义校验失败和用户取消都不会跨模型重试，以免用另一个模型掩盖确定性问题。运行回执记录实际提供商、模型、上游 request ID、Token 分项、耗时和降级路径，但公开配置接口只返回“当前能力是否可用”。

生产环境应通过 Sites/Cloudflare 的服务端 Secret 管理配置 Key，通过普通服务端变量配置模型和路由；不要把真实 Key 写入 `.dev.vars.example`、源码、浏览器请求或聊天消息。配置后必须分别完成一次诊断调用和一条完整沙箱运行，才能把该环境认定为“真实模型验收通过”。

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Email and name are intended for display or contact purposes.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
