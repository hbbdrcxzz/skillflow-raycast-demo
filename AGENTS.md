# AGENTS.md — SkillFlow

## 这是什么

SkillFlow：面向大众用户的 AI Skill 商店 + 工作台。核心对象是**工作流**，
Skill 是挂在工作节点上的可替换能力，Skill 组合是用户保存复用的资产。
首发垂直：互联网产品/运营。当前推进 Golden Path 1「用户访谈 → 产品洞察」。

完整产品契约、已确认/已否决决策见
`.planning/2026-08-21-skillflow-production-build/task_plan.md`，决策时间线见同目录
`progress.md`，基准研究见 `findings.md`。**改动前先读 task_plan.md 的
“Decisions Made”和“Audit-Driven Delivery Gates”两节。**

## 技术栈

- vinext 1.0.0-beta.2（Cloudflare Next-on-Vite），**不是标准 Next.js**
- React 19.2 + Tailwind 4 + TypeScript 5.9
- Cloudflare Workers + D1 + Drizzle ORM
- 部署在 OpenAI Sites（见 `.openai/hosting.json`）
- Node >= 22.13.0

## 硬约束

1. `/signin-with-chatgpt`、`/signout-with-chatgpt`、`/callback` 由平台托管，
   **不要实现这些路由**。认证走 `app/chatgpt-auth.ts` 里的 helper。
2. 依赖 per-request 身份 header 的页面必须 `export const dynamic = "force-dynamic"`。
3. 不使用 `wrangler.jsonc`。绑定声明在 `.openai/hosting.json`，
   本地开发由 `vite.config.ts` 模拟。
4. vinext 是 beta，改 `vite.config.ts` / `next.config.ts` 前先确认真实 API，
   不要按标准 Next.js 的习惯猜。

## 代码地图

| 路径 | 作用 |
|---|---|
| `app/page.tsx` | 主入口页 |
| `app/components/RegistryBrowser.tsx` | Skill 商店浏览 |
| `app/components/InterviewRunner.tsx` | 访谈运行器 UI |
| `app/api/registry/*` | Skill 检索、解析、包管理 |
| `app/api/workflows/diagnose\|validate` | 工作流诊断与校验 |
| `app/api/runs/interview/*` | Golden Path 1 运行时接口 |
| `lib/workflow-compiler.ts` | 工作流编译 |
| `lib/interview-runtime.ts` | 访谈运行时 |
| `lib/upstream-registry.ts` | 上游 Skill 源接入 |
| `lib/contracts.ts` | 能力契约定义 |
| `db/schema.ts` | Drizzle schema |
| `runtime/skills/` | Skill 实现 |

## 命令

```
npm run dev        # 本地开发
npm run build      # 构建校验
npm test           # build + 渲染测试
npm run lint       # eslint
npm run db:generate # schema 改动后生成 Drizzle migration
```

## 已知待处理

- `app/globals.css` 1688 行手写 CSS，与 Tailwind 4 并存，疑有重复与死规则。
- `runtime/skills/internet-product-interview.ts` 1457 行，Skill 逻辑硬编码，
  与「Skill 是可替换能力」的产品契约存在张力。
- `lib/registry-localization.ts` 1000 行，需确认是否可数据化。

## 工作方式

改动前说明影响面。涉及 schema 或 API 契约的改动先给方案再动手。
每轮改完跑 `npm run build`。不要一次性重写千行文件。
