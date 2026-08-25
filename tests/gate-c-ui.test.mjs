import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentPath = new URL("../app/components/CompositionStudio.tsx", import.meta.url);
const stylesPath = new URL("../app/globals.css", import.meta.url);

test("Gate C UI keeps composition session-only and never exposes execution or persistence actions", async () => {
  const source = await readFile(componentPath, "utf8");
  assert.match(source, /当前会话修订/);
  assert.match(source, /未保存 · 未运行/);
  assert.match(source, /不会连接账号、授权、安装或产出结果/);
  assert.doesNotMatch(source, />\s*(?:运行|保存|安装)(?: Skill)?\s*</);
  assert.doesNotMatch(source, /\/api\/workflows\/composition\/(?:run|save|install)/);
});

test("Gate C UI supports both confirmed diagnosis and Registry single-Skill bootstrap", async () => {
  const source = await readFile(componentPath, "utf8");
  assert.match(source, /kind: "gate_b_diagnosis"; snapshot: InterviewSnapshot; workflow: AbstractWorkflow/);
  assert.match(source, /kind: "registry_single"; slug: string; taskContext\?: string/);
  assert.match(source, /`\/api\/workflows\/composition\/\$\{path\}`/);
  assert.match(source, /post<\{ revision\?: CompositionRevision \}>\("bootstrap"/);
});

test("Gate C UI separates execution decisions, ordered bindings, and zero-Skill nodes", async () => {
  const source = await readFile(componentPath, "utf8");
  for (const mode of ["human_only", "deterministic", "ai_assist", "ai_draft_human_approve", "ai_auto", "connector_action"]) {
    assert.match(source, new RegExp(`value: "${mode}"`));
  }
  assert.match(source, /当前是零 Skill 节点/);
  assert.match(source, /reorder_releases/);
  assert.match(source, /ROLE_LABELS/);
  assert.match(source, /顺序兼容性/);
  assert.match(source, /多 Skill 只表示节点内的线性先后关系/);
});

test("Gate C UI limits recommendations and distinguishes fit from upstream Registry evidence", async () => {
  const source = await readFile(componentPath, "utf8");
  assert.match(source, /alternatives\.slice\(0, 2\)/);
  assert.match(source, /当前节点适配度/);
  assert.match(source, /市场侧信号 · 不等于适配度/);
  for (const evidence of ["Release / Snapshot", "作者", "许可", "所需权限", "限制与未知", "来源"]) {
    assert.match(source, new RegExp(evidence));
  }
  assert.match(source, /没有达到门槛的 Skill/);
});

test("Gate C mutations show semantic preview before server-authoritative apply", async () => {
  const source = await readFile(componentPath, "utf8");
  assert.match(source, /SEMANTIC DIFF/);
  assert.match(source, /确认并生成新版本/);
  assert.match(source, /mode: "apply"/);
  assert.match(source, /expectedBaseDigest: revision\.graphDigest/);
  assert.match(source, /expectedHeadToken: revision\.session\.headToken/);
  assert.match(source, /requestSeq: revision\.session\.headSequence \+ 1/);
  assert.match(source, /mode: "propose"/);
  assert.match(source, /结构化提案/);
  assert.match(source, /没有可安全应用的修改/);
  assert.match(source, /disabled=\{pending === "revise" \|\| !intent\.operations\.length\}/);
  assert.match(source, /撤销上一项/);
  assert.match(source, /type: "clear_execution_mode"/);
  assert.match(source, /撤销纯人工模式并恢复原 Skill 绑定/);
});

test("Gate C permission acknowledgement submits the current surface digest rather than the old review digest", async () => {
  const source = await readFile(componentPath, "utf8");
  assert.match(source, /const surfaceDigest = permissionSurfaceDigest\(selectedNode\)/);
  assert.match(source, /permissionDigest: surfaceDigest/);
  assert.match(source, /selectedNode\.permissionReviewDigest === surfaceDigest/);
});

test("Gate C composer is IME-safe and mobile CSS provides single-panel tabs at 390px", async () => {
  const [source, css] = await Promise.all([readFile(componentPath, "utf8"), readFile(stylesPath, "utf8")]);
  assert.match(source, /onCompositionStart/);
  assert.match(source, /event\.nativeEvent\.isComposing/);
  assert.match(source, /event\.shiftKey/);
  assert.match(source, /"nodes" \| "skills" \| "changes"/);
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /\.gc-panel\.gc-mobile-active \{ display: block; \}/);
  assert.match(css, /\.gc-mobile-tabs button, \.gc-panel button, \.gc-dialog button \{ min-height: 44px; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  const gateCStyles = css.slice(css.indexOf("/* Gate C"), css.indexOf("* { box-sizing"));
  assert.doesNotMatch(gateCStyles, /font-size:\s*(?:[0-9]|1[01](?:\.\d+)?)px/);
});
