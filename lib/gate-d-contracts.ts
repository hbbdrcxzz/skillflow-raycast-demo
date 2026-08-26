import type { CompositionRevision, ReleasePin } from "./gate-c-contracts";
import { validatePortableCompositionRevision } from "./gate-c-composition";
import { contentDigest, nativeReleasePins } from "./gate-c-release-resolver";
import { internetProductInterviewWorkflow } from "@/runtime/skills";
import { ModelGatewayError } from "./openai-responses";

export const GATE_D_ADAPTER_ID = "internet_product_interview_v1";
export const GATE_D_ADAPTER_VERSION = "1.0.0";
export const GATE_D_IMPLEMENTATION_REVISION = "gate-d-runtime-2026-08-25-1";
export const GATE_D_PACK_TRIGGER_SLUG = "interview-evidence-extractor";

export type GateDRuntimeStage = {
  id: string;
  sequence: number;
  control: "deterministic" | "model" | "human_gate";
  dependsOn: string[];
  descriptionZh: string;
  release: ReleasePin;
};

export type GateDRuntimePlan = {
  adapterId: typeof GATE_D_ADAPTER_ID;
  adapterVersion: typeof GATE_D_ADAPTER_VERSION;
  sourceRevisionId: string;
  sourceContentDigest: string;
  packKind: "official_fixed_pack";
  sourceBinding: { nodeId: string; bindingId: string; releaseId: string; slug: typeof GATE_D_PACK_TRIGGER_SLUG };
  expansionDisclosureZh: string;
  implementationRevision: typeof GATE_D_IMPLEMENTATION_REVISION;
  stages: GateDRuntimeStage[];
  noExternalSideEffects: true;
  planDigest: string;
};

export class GateDContractError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 422,
  ) {
    super(message);
  }
}

export async function compileInterviewRuntimePlan(value: unknown): Promise<{
  revision: CompositionRevision;
  plan: GateDRuntimePlan;
}> {
  const { revision, validation } = await validatePortableCompositionRevision(value);
  if (!validation.valid || revision.state !== "composition_ready") {
    throw new GateDContractError("COMPOSITION_NOT_READY", "工作流仍有未解决的配置或权限问题");
  }
  if (revision.source.kind !== "gate_b_diagnosis" || !/访谈/.test(revision.source.taskContext)) {
    throw new GateDContractError(
      "WORKFLOW_NOT_EXECUTABLE",
      "Gate D 当前只运行由已确认工作画像生成的“访谈到 PRD”黄金工作流",
    );
  }
  if (revision.nodes.some((node) => node.executionMode === "connector_action")) {
    throw new GateDContractError("EXTERNAL_ACTION_DENIED", "当前沙箱不执行连接器或外部写入动作");
  }

  const bindings = revision.nodes.flatMap((node) => node.skillBindings.map((binding) => ({ node, binding })));
  if (bindings.length !== 1 || bindings[0].binding.release.slug !== GATE_D_PACK_TRIGGER_SLUG) {
    throw new GateDContractError(
      "OFFICIAL_PACK_TRIGGER_REQUIRED",
      "Gate D 当前只支持一个明确入口：选择“访谈证据提取器”会启动页面展示的官方七阶段固定 Pack；不能把任意 Skill 当成隐藏流水线入口",
    );
  }
  if (
    bindings.some(
      ({ binding }) =>
        binding.release.source !== "skillflow_runtime" ||
        binding.release.pinKind !== "immutable_runtime_release" ||
        binding.release.hostedExecution !== "built_in",
    )
  ) {
    throw new GateDContractError(
      "UNHOSTED_RELEASE_BLOCKED",
      "上游目录 Skill 只能安装交接，不能进入 Gate D 托管沙箱",
    );
  }

  const authoritativePins = await nativeReleasePins();
  const bySlug = new Map(authoritativePins.map((release) => [release.slug, release]));
  for (const { binding } of bindings) {
    const current = bySlug.get(binding.release.slug);
    if (!current || current.releaseId !== binding.release.releaseId || current.manifestDigest !== binding.release.manifestDigest) {
      throw new GateDContractError("RUNTIME_RELEASE_CHANGED", `内建 Skill ${binding.release.slug} 已变化，请重新核验工作流`, 409);
    }
  }

  const stages = internetProductInterviewWorkflow.map((stage, sequence) => {
    const release = bySlug.get(stage.skillSlug);
    if (!release) throw new GateDContractError("RUNTIME_PLAN_INVALID", `运行适配器缺少 ${stage.skillSlug}`, 500);
    return {
      id: stage.id,
      sequence,
      control: stage.control,
      dependsOn: [...stage.dependsOn],
      descriptionZh: stage.descriptionZh,
      release,
    } satisfies GateDRuntimeStage;
  });
  const material = {
    adapterId: GATE_D_ADAPTER_ID,
    adapterVersion: GATE_D_ADAPTER_VERSION,
    sourceRevisionId: revision.revisionId,
    sourceContentDigest: revision.contentDigest,
    packKind: "official_fixed_pack" as const,
    sourceBinding: {
      nodeId: bindings[0].node.nodeId,
      bindingId: bindings[0].binding.bindingId,
      releaseId: bindings[0].binding.release.releaseId,
      slug: GATE_D_PACK_TRIGGER_SLUG,
    },
    expansionDisclosureZh: "你选择的是官方“访谈到 PRD”固定组合包：入口 Skill 会展开为页面列出的七个受控阶段；本 Gate 暂不声称运行任意自定义组合。",
    implementationRevision: GATE_D_IMPLEMENTATION_REVISION,
    stages,
    noExternalSideEffects: true as const,
  };
  return {
    revision,
    plan: { ...material, planDigest: await contentDigest(material) },
  };
}

function runtimePlanMaterial(plan: GateDRuntimePlan) {
  const material = { ...plan } as Partial<GateDRuntimePlan>;
  delete material.planDigest;
  return material;
}

export async function assertCurrentExecutablePlan(value: unknown, expectedDigest?: string | null): Promise<GateDRuntimePlan> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new GateDContractError("RUNTIME_PLAN_INVALID", "保存的运行计划无法解析", 409);
  }
  const plan = value as GateDRuntimePlan;
  if (plan.adapterId !== GATE_D_ADAPTER_ID) {
    throw new GateDContractError("RUNTIME_ADAPTER_CHANGED", "运行适配器已经变化，请重新保存工作流", 409);
  }
  if (plan.adapterVersion !== GATE_D_ADAPTER_VERSION || plan.implementationRevision !== GATE_D_IMPLEMENTATION_REVISION) {
    throw new GateDContractError("ADAPTER_VERSION_CHANGED", "运行适配器版本已经变化，请重新核验并保存工作流", 409);
  }
  if (
    plan.packKind !== "official_fixed_pack" ||
    plan.sourceBinding?.slug !== GATE_D_PACK_TRIGGER_SLUG ||
    plan.noExternalSideEffects !== true ||
    !Array.isArray(plan.stages)
  ) {
    throw new GateDContractError("RUNTIME_PLAN_INVALID", "保存的官方组合包契约不完整", 409);
  }
  const recalculatedDigest = await contentDigest(runtimePlanMaterial(plan));
  if (!plan.planDigest || plan.planDigest !== recalculatedDigest || expectedDigest && expectedDigest !== recalculatedDigest) {
    throw new GateDContractError("RUNTIME_PLAN_DIGEST_MISMATCH", "运行计划摘要不一致，请重新保存工作流", 409);
  }
  const currentPins = await nativeReleasePins();
  const currentBySlug = new Map(currentPins.map((release) => [release.slug, release]));
  if (plan.stages.length !== internetProductInterviewWorkflow.length) {
    throw new GateDContractError("RUNTIME_PLAN_INVALID", "官方组合包阶段数量不一致", 409);
  }
  for (const [sequence, definition] of internetProductInterviewWorkflow.entries()) {
    const stage = plan.stages[sequence];
    const current = currentBySlug.get(definition.skillSlug);
    if (
      !stage || stage.id !== definition.id || stage.sequence !== sequence || stage.control !== definition.control ||
      JSON.stringify(stage.dependsOn) !== JSON.stringify(definition.dependsOn) ||
      !current || stage.release.releaseId !== current.releaseId || stage.release.manifestDigest !== current.manifestDigest
    ) {
      throw new GateDContractError("RUNTIME_RELEASE_CHANGED", `运行阶段 ${definition.id} 或其 Release 已变化，请重新保存工作流`, 409);
    }
  }
  return plan;
}

export function assertSameOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new GateDContractError("CROSS_ORIGIN_DENIED", "拒绝跨站写入请求", 403);
  }
}

export function gateDErrorResponse(error: unknown) {
  if (error instanceof GateDContractError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof ModelGatewayError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.httpStatus },
    );
  }
  const details = error && typeof error === "object" ? error as { name?: unknown; code?: unknown } : null;
  console.error("Gate D internal error", {
    name: typeof details?.name === "string" ? details.name : "UnknownError",
    code: typeof details?.code === "string" ? details.code : "UNEXPECTED",
  });
  return Response.json(
    { error: { code: "GATE_D_FAILED", message: "服务端未能完成该请求，请稍后重试" } },
    { status: 500 },
  );
}
