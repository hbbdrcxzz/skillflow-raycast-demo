import { env } from "cloudflare:workers";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { ChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import {
  approvals,
  artifacts,
  auditEvents,
  runs,
  runQuotaClaims,
  runSteps,
  workflowNodes,
  workflows,
  workflowVersions,
} from "@/db/schema";
import { ensurePersonalWorkspace } from "./workspace";
import { contentDigest } from "./gate-c-release-resolver";
import { GateDContractError, assertCurrentExecutablePlan, compileInterviewRuntimePlan, type GateDRuntimePlan } from "./gate-d-contracts";
import type { CompositionRevision } from "./gate-c-contracts";

export type GateDWorkspace = Awaited<ReturnType<typeof ensurePersonalWorkspace>>;

export async function gateDWorkspace(user: ChatGPTUser) {
  return ensurePersonalWorkspace(user);
}

function now() {
  return new Date().toISOString();
}

async function sha256Bytes(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function claimQuotaSlot(input: {
  workspaceId: string;
  runId: string;
  scope: "active" | "hour";
  bucket: string;
  slots: number;
  expiresAt: string;
}) {
  const db = getDb();
  for (let slot = 0; slot < input.slots; slot += 1) {
    const claimId = `quota_${crypto.randomUUID()}`;
    const inserted = await db.insert(runQuotaClaims).values({
      id: claimId, workspaceId: input.workspaceId, runId: input.runId,
      scope: input.scope, bucket: input.bucket, slot, expiresAt: input.expiresAt,
    }).onConflictDoNothing().returning({ id: runQuotaClaims.id });
    if (inserted.length) return claimId;
  }
  return null;
}

async function deleteExpiredQuotaClaims(workspaceId: string, claimedAtIso: string) {
  await getDb().delete(runQuotaClaims).where(and(
    eq(runQuotaClaims.workspaceId, workspaceId), sql`${runQuotaClaims.expiresAt} <= ${claimedAtIso}`,
  ));
}

export async function claimActiveRunQuota(workspaceId: string, runId: string) {
  const db = getDb();
  const claimedAt = new Date();
  const claimedAtIso = claimedAt.toISOString();
  await deleteExpiredQuotaClaims(workspaceId, claimedAtIso);
  const [existing] = await db.select({ id: runQuotaClaims.id }).from(runQuotaClaims).where(and(
    eq(runQuotaClaims.runId, runId), eq(runQuotaClaims.scope, "active"),
  )).limit(1);
  if (existing) {
    throw new GateDContractError("RUN_QUOTA_CLAIM_BUSY", "该任务正在被另一个请求重新打开，请刷新后重试", 409);
  }
  const claimId = await claimQuotaSlot({
    workspaceId, runId, scope: "active", bucket: "active", slots: 3,
    // Active means unfinished, not "created during the last 24 hours". The
    // claim is released only by a terminal transition or explicit recovery.
    expiresAt: "9999-12-31T23:59:59.999Z",
  });
  if (claimId) return claimId;
  const [concurrent] = await db.select({ id: runQuotaClaims.id }).from(runQuotaClaims).where(and(
    eq(runQuotaClaims.runId, runId), eq(runQuotaClaims.scope, "active"),
  )).limit(1);
  if (concurrent) throw new GateDContractError("RUN_QUOTA_CLAIM_BUSY", "该任务正在被另一个请求重新打开，请刷新后重试", 409);
  throw new GateDContractError("ACTIVE_RUN_LIMIT", "当前已有 3 个未结束任务，请先完成或取消后再开始", 429);
}

export async function releaseRunQuotaClaim(claimId: string) {
  await getDb().delete(runQuotaClaims).where(eq(runQuotaClaims.id, claimId));
}

async function claimRunQuota(workspaceId: string, runId: string) {
  const claimedAt = new Date();
  const claimedAtIso = claimedAt.toISOString();
  const activeClaimId = await claimActiveRunQuota(workspaceId, runId);
  const hourBucket = claimedAtIso.slice(0, 13);
  const hourClaimId = await claimQuotaSlot({
    workspaceId, runId, scope: "hour", bucket: hourBucket, slots: 12,
    expiresAt: new Date(claimedAt.getTime() + 2 * 60 * 60 * 1000).toISOString(),
  });
  if (!hourClaimId) {
    await releaseRunQuotaClaim(activeClaimId);
    throw new GateDContractError("RUN_RATE_LIMIT", "每个个人空间每小时最多建立 12 个运行，请稍后再试", 429);
  }
}

export async function releaseActiveRunQuota(runId: string) {
  await getDb().delete(runQuotaClaims).where(and(eq(runQuotaClaims.runId, runId), eq(runQuotaClaims.scope, "active")));
}

export async function persistComposition(
  value: unknown,
  workspace: GateDWorkspace,
): Promise<{ workflowId: string; workflowVersionId: string; plan: GateDRuntimePlan; revision: CompositionRevision }> {
  const { revision, plan } = await compileInterviewRuntimePlan(value);
  const db = getDb();
  const workflowId = `wf_${(await contentDigest({ workspace: workspace.workspaceId, source: revision.source.sourceDigest })).slice(7, 31)}`;
  const workflowVersionId = `wfv_${(await contentDigest({ workflowId, content: revision.contentDigest, plan: plan.planDigest })).slice(7, 39)}`;
  const persistedGraphDigest = await contentDigest({ compositionGraphDigest: revision.graphDigest, runtimePlanDigest: plan.planDigest });
  const createdAt = now();

  await db.insert(workflows).values({
    id: workflowId,
    workspaceId: workspace.workspaceId,
    createdByAccountId: workspace.accountId,
    name: revision.source.title,
    description: revision.source.taskContext,
    sourceType: "generated",
    visibility: "private",
    status: "active",
    updatedAt: createdAt,
  }).onConflictDoUpdate({
    target: workflows.id,
    set: { name: revision.source.title, description: revision.source.taskContext, updatedAt: createdAt },
  });

  let persistedRevision: number | null = null;
  for (let attempt = 0; attempt < 3 && persistedRevision === null; attempt += 1) {
    const [existing] = await db.select({ revision: workflowVersions.revision }).from(workflowVersions)
      .where(and(eq(workflowVersions.id, workflowVersionId), eq(workflowVersions.workflowId, workflowId))).limit(1);
    if (existing) {
      persistedRevision = existing.revision;
      break;
    }
    const [latest] = await db.select({ value: sql<number>`coalesce(max(${workflowVersions.revision}), 0)` })
      .from(workflowVersions).where(eq(workflowVersions.workflowId, workflowId));
    const nextRevision = Number(latest?.value || 0) + 1;
    const inserted = await db.insert(workflowVersions).values({
      id: workflowVersionId,
      workflowId,
      revision: nextRevision,
      versionLabel: `V${nextRevision}`,
      status: "active",
      changeSummary: revision.diffFromParent?.summaryZh || "保存 Gate C 编排并编译访谈沙箱",
      inputSchema: { transcript: "text/plain", researchGoal: "string", productContext: "string" },
      outputSchema: { artifact: "text/markdown", receipt: "application/json" },
      graphDigest: persistedGraphDigest,
      sourceSchemaVersion: revision.schemaVersion,
      sourceRevisionId: revision.revisionId,
      sourceContentDigest: revision.contentDigest,
      sourceContractDigest: revision.source.taskContractDigest,
      compositionSnapshot: revision as unknown as Record<string, unknown>,
      runtimeAdapterId: plan.adapterId,
      runtimeAdapterVersion: plan.adapterVersion,
      runtimePlanDigest: plan.planDigest,
      runtimePlanSnapshot: plan as unknown as Record<string, unknown>,
      validationSnapshot: revision.validation as unknown as Record<string, unknown>,
      createdByAccountId: workspace.accountId,
      createdAt,
      activatedAt: createdAt,
    }).onConflictDoNothing().returning({ revision: workflowVersions.revision });
    if (inserted[0]) persistedRevision = inserted[0].revision;
  }
  if (persistedRevision === null) {
    throw new GateDContractError("WORKFLOW_VERSION_CONFLICT", "工作流版本正在被另一个请求更新，请重试", 409);
  }

  for (const [ordinal, node] of revision.nodes.entries()) {
    await db.insert(workflowNodes).values({
      id: `${workflowVersionId}_${ordinal}`,
      workflowVersionId,
      nodeKey: node.nodeId,
      kind: node.executionMode === "human_only" ? "human_review" : "skill",
      name: node.label,
      capability: "gate_d_business_node",
      config: { ...node, gateDAdapter: plan.adapterId },
      positionX: ordinal,
      positionY: 0,
      ordinal,
    }).onConflictDoNothing({ target: workflowNodes.id });
  }
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(), workspaceId: workspace.workspaceId, actorType: "account", actorId: workspace.accountId,
    action: "workflow.version.persisted", objectType: "workflow_version", objectId: workflowVersionId,
    afterDigest: revision.contentDigest, dataRegion: workspace.dataRegion,
    eventData: { adapterId: plan.adapterId, planDigest: plan.planDigest, persistedRevision },
  });
  return { workflowId, workflowVersionId, plan, revision };
}

type ArtifactWrite = {
  workspaceId: string;
  runId: string;
  runStepId?: string | null;
  kind: "input" | "intermediate" | "output" | "receipt";
  name: string;
  mimeType: string;
  body: string;
  metadata?: Record<string, unknown>;
};

export async function commitArtifact(input: ArtifactWrite) {
  const db = getDb();
  const artifactId = `art_${crypto.randomUUID()}`;
  const bytes = new TextEncoder().encode(input.body);
  const digest = await sha256Bytes(bytes);
  const storageKey = `private/${input.workspaceId}/runs/${input.runId}/${artifactId}`;
  try {
    await db.insert(artifacts).values({
      id: artifactId,
      workspaceId: input.workspaceId,
      runId: input.runId,
      runStepId: input.runStepId || null,
      kind: input.kind,
      status: "pending",
      name: input.name.slice(0, 180),
      mimeType: input.mimeType,
      storageKey,
      byteSize: bytes.byteLength,
      contentDigest: digest,
      metadata: input.metadata || {},
      dataRegion: "global",
    });
    await env.FILES.put(storageKey, bytes, {
      httpMetadata: { contentType: input.mimeType },
      customMetadata: { digest, runId: input.runId },
    });
    const stored = await env.FILES.head(storageKey);
    if (!stored || stored.size !== bytes.byteLength || stored.customMetadata?.digest !== digest) {
      throw new GateDContractError("ARTIFACT_WRITE_FAILED", "文件存储校验失败", 503);
    }
    const promoted = await db.update(artifacts).set({ status: "ready" }).where(and(
      eq(artifacts.id, artifactId), eq(artifacts.workspaceId, input.workspaceId), eq(artifacts.status, "pending"),
    )).returning({ id: artifacts.id });
    if (!promoted.length) throw new GateDContractError("ARTIFACT_COMMIT_LOST", "文件提交权已失效", 409);
  } catch (error) {
    await db.update(artifacts).set({ status: "failed", deletedAt: now() }).where(and(
      eq(artifacts.id, artifactId), eq(artifacts.workspaceId, input.workspaceId), eq(artifacts.status, "pending"),
    ));
    await env.FILES.delete(storageKey);
    throw error;
  }
  return { artifactId, digest, byteSize: bytes.byteLength, mimeType: input.mimeType, name: input.name };
}

export async function readArtifact(workspaceId: string, artifactId: string) {
  const db = getDb();
  const [record] = await db.select().from(artifacts).where(and(
    eq(artifacts.id, artifactId),
    eq(artifacts.workspaceId, workspaceId),
    eq(artifacts.status, "ready"),
  )).limit(1);
  if (!record) throw new GateDContractError("NOT_FOUND", "没有找到该交付物", 404);
  const object = await env.FILES.get(record.storageKey);
  if (!object) throw new GateDContractError("ARTIFACT_MISSING", "交付物正文暂时不可用", 503);
  const body = await object.text();
  const digest = await sha256Bytes(new TextEncoder().encode(body));
  if (digest !== record.contentDigest) throw new GateDContractError("ARTIFACT_DIGEST_MISMATCH", "交付物完整性校验失败", 503);
  return { record, body };
}

export async function discardArtifact(workspaceId: string, artifactId: string) {
  const db = getDb();
  const [record] = await db.select().from(artifacts).where(and(
    eq(artifacts.id, artifactId), eq(artifacts.workspaceId, workspaceId),
  )).limit(1);
  if (!record) return;
  await db.update(artifacts).set({ status: "deleted", deletedAt: now() }).where(and(
    eq(artifacts.id, artifactId), eq(artifacts.workspaceId, workspaceId),
  ));
  await env.FILES.delete(record.storageKey);
}

export async function discardUncommittedStepArtifacts(workspaceId: string, runId: string, runStepId: string) {
  const db = getDb();
  const [step] = await db.select({ output: runSteps.output }).from(runSteps).where(and(
    eq(runSteps.id, runStepId), eq(runSteps.runId, runId),
  )).limit(1);
  const output = step?.output && typeof step.output === "object" && !Array.isArray(step.output) ? step.output as Record<string, unknown> : {};
  const committedIds = new Set([output.artifactId, output.qualityArtifactId].filter((value): value is string => typeof value === "string"));
  const candidates = await db.select({ id: artifacts.id }).from(artifacts).where(and(
    eq(artifacts.workspaceId, workspaceId), eq(artifacts.runId, runId), eq(artifacts.runStepId, runStepId),
    sql`${artifacts.status} in ('pending','ready')`,
  ));
  for (const candidate of candidates) if (!committedIds.has(candidate.id)) await discardArtifact(workspaceId, candidate.id);
}

export async function discardUncommittedApprovalArtifacts(workspaceId: string, runId: string, approvalId: string, adoptedArtifactId?: string | null) {
  const db = getDb();
  const candidates = await db.select({ id: artifacts.id, metadata: artifacts.metadata }).from(artifacts).where(and(
    eq(artifacts.workspaceId, workspaceId), eq(artifacts.runId, runId), sql`${artifacts.status} in ('pending','ready')`,
  ));
  for (const candidate of candidates) {
    const metadata = candidate.metadata as Record<string, unknown> | null;
    if (metadata?.purpose === "approved_analysis" && metadata.approvalId === approvalId && candidate.id !== adoptedArtifactId) {
      await discardArtifact(workspaceId, candidate.id);
    }
  }
}

export async function createInterviewRun(input: {
  workspace: GateDWorkspace;
  workflowVersionId: string;
  idempotencyKey: string;
  researchGoal: string;
  productContext: string;
  transcript: string;
  fileName: string;
  mimeType: string;
  disclosureAccepted: boolean;
  repairAttempted?: boolean;
}) {
  const db = getDb();
  const [version] = await db.select({
    id: workflowVersions.id,
    workflowId: workflowVersions.workflowId,
    adapterId: workflowVersions.runtimeAdapterId,
    adapterVersion: workflowVersions.runtimeAdapterVersion,
    planDigest: workflowVersions.runtimePlanDigest,
    plan: workflowVersions.runtimePlanSnapshot,
  }).from(workflowVersions)
    .innerJoin(workflows, eq(workflowVersions.workflowId, workflows.id))
    .where(and(eq(workflowVersions.id, input.workflowVersionId), eq(workflows.workspaceId, input.workspace.workspaceId)))
    .limit(1);
  if (!version) throw new GateDContractError("NOT_FOUND", "没有找到可运行的工作流版本", 404);
  if (version.adapterId !== "internet_product_interview_v1" || !version.planDigest || !version.plan) {
    throw new GateDContractError("WORKFLOW_NOT_EXECUTABLE", "该工作流没有可验证的访谈运行适配器");
  }
  const plan = await assertCurrentExecutablePlan(version.plan, version.planDigest);
  if (version.adapterVersion !== plan.adapterVersion) {
    throw new GateDContractError("ADAPTER_VERSION_CHANGED", "工作流版本与当前适配器不一致，请重新保存", 409);
  }
  if (!input.workspace.crossBorderProcessingAllowed) {
    throw new GateDContractError("CROSS_BORDER_PROCESSING_DENIED", "当前工作空间政策不允许把材料发送给境外模型", 403);
  }
  if (!input.disclosureAccepted) throw new GateDContractError("DISCLOSURE_REQUIRED", "请先确认外部模型与跨境处理说明");
  const bodyBytes = new TextEncoder().encode(input.transcript);
  const inputDigest = await sha256Bytes(bodyBytes);
  const requestDigest = await contentDigest({
    workflowVersionId: version.id,
    inputDigest,
    researchGoal: input.researchGoal,
    productContext: input.productContext,
    planDigest: version.planDigest,
  });
  const runId = `run_${crypto.randomUUID()}`;
  const preflight = {
    workflowVersionId: version.id,
    adapterId: version.adapterId,
    adapterVersion: version.adapterVersion,
    planDigest: version.planDigest,
    inputDigest,
    fileName: input.fileName.slice(0, 180),
    byteSize: bodyBytes.byteLength,
    mimeType: input.mimeType,
    externalModelProcessing: true,
    crossBorderProcessing: true,
    arbitraryScripts: false,
    limits: { maxActiveRuns: 3, maxRunsPerHour: 12, maxAttemptsPerStep: 3 },
    stages: plan.stages.map((stage) => ({ id: stage.id, control: stage.control, releaseId: stage.release.releaseId })),
  };
  const preflightDigest = await contentDigest(preflight);
  const createdAt = now();
  let inputArtifact: Awaited<ReturnType<typeof commitArtifact>> | null = null;
  try {
    // The run is the aggregate root. Create it in a non-runnable state before
    // writing its R2 artifact so SQLite foreign keys can never point forward.
    // The unique workspace/idempotency index is also the concurrency winner.
    const inserted = await db.insert(runs).values({
      id: runId,
      workspaceId: input.workspace.workspaceId,
      initiatedByAccountId: input.workspace.accountId,
      workflowVersionId: version.id,
      kind: "private",
      status: "provisioning",
      idempotencyKey: input.idempotencyKey,
      requestDigest,
      input: {
        researchGoal: input.researchGoal,
        productContext: input.productContext,
        fileName: input.fileName.slice(0, 180),
        mimeType: input.mimeType,
        byteSize: bodyBytes.byteLength,
        contentDigest: inputDigest,
      },
      runtimePolicy: { arbitraryScripts: false, externalSideEffects: false, maxAttemptsPerStep: 3, maxActiveRuns: 3, maxRunsPerHour: 12 },
      preflightSnapshot: preflight,
      preflightDigest,
      runtimeAdapterId: version.adapterId,
      runtimeAdapterVersion: version.adapterVersion,
      runtimePlanDigest: version.planDigest,
      inputArtifactId: null,
      executionRegion: "global",
      crossBorderProcessingUsed: true,
      createdAt,
      updatedAt: createdAt,
    }).onConflictDoNothing({
      target: [runs.workspaceId, runs.idempotencyKey],
    }).returning({ id: runs.id });

    if (!inserted.length) {
      const [existing] = await db.select().from(runs).where(and(
        eq(runs.workspaceId, input.workspace.workspaceId),
        eq(runs.idempotencyKey, input.idempotencyKey),
      )).limit(1);
      if (!existing || existing.requestDigest !== requestDigest) {
        throw new GateDContractError("IDEMPOTENCY_CONFLICT", "同一个提交标识对应了不同材料，请重新开始", 409);
      }
      if (existing.status === "provisioning") {
        const stale = Date.now() - new Date(existing.updatedAt || existing.createdAt).getTime() >= 3 * 60 * 1000;
        if (stale && !input.repairAttempted) {
          const repairToken = `repair_${crypto.randomUUID()}`;
          const claimed = await db.update(runs).set({
            status: "blocked", error: { code: "PROVISIONING_EXPIRED", message: "建立任务时中断，正在清理后重建" },
            leaseToken: repairToken, updatedAt: now(), stateVersion: sql`${runs.stateVersion} + 1`,
          }).where(and(
            eq(runs.id, existing.id), eq(runs.workspaceId, input.workspace.workspaceId),
            eq(runs.status, "provisioning"), eq(runs.stateVersion, existing.stateVersion),
          )).returning({ id: runs.id });
          if (claimed.length) {
            const staleArtifacts = await db.select({ id: artifacts.id }).from(artifacts).where(and(
              eq(artifacts.workspaceId, input.workspace.workspaceId), eq(artifacts.runId, existing.id),
            ));
            for (const artifact of staleArtifacts) await discardArtifact(input.workspace.workspaceId, artifact.id);
            await db.delete(runs).where(and(eq(runs.id, existing.id), eq(runs.leaseToken, repairToken)));
            await db.delete(runQuotaClaims).where(eq(runQuotaClaims.runId, existing.id));
            return createInterviewRun({ ...input, repairAttempted: true });
          }
        }
        throw new GateDContractError("RUN_PROVISIONING", "同一任务正在建立，请稍后用原提交重试", 409);
      }
      return { run: existing, replayed: true };
    }

    await claimRunQuota(input.workspace.workspaceId, runId);

    inputArtifact = await commitArtifact({
      workspaceId: input.workspace.workspaceId,
      runId,
      kind: "input",
      name: input.fileName || "访谈材料.txt",
      mimeType: input.mimeType,
      body: input.transcript,
      metadata: { inputDigest, purpose: "interview_source_copy" },
    });

    const stepRows = plan.stages.map((stage) => ({
        id: `step_${crypto.randomUUID()}`,
        runId,
        stepKey: stage.id,
        sequence: stage.sequence,
        attempt: 1,
        kind: stage.control,
        name: stage.descriptionZh,
        status: "queued",
        capability: stage.release.slug,
        skillPinSnapshot: stage.release as unknown as Record<string, unknown>,
        skillManifestDigest: stage.release.manifestDigest,
        requiresApproval: stage.control === "human_gate",
        sideEffect: "none",
        createdAt,
        updatedAt: createdAt,
      }));
    const stepInserts = [];
    for (let index = 0; index < stepRows.length; index += 3) {
      // D1 enforces SQLite's bound-variable limit per statement. Keep each
      // multi-row insert comfortably below that limit while one batch remains atomic.
      stepInserts.push(db.insert(runSteps).values(stepRows.slice(index, index + 3)));
    }
    const [finalized] = await db.batch([
      db.update(runs).set({
        status: "queued",
        inputArtifactId: inputArtifact.artifactId,
        updatedAt: createdAt,
        stateVersion: sql`${runs.stateVersion} + 1`,
      }).where(and(eq(runs.id, runId), eq(runs.status, "provisioning"))).returning({ id: runs.id }),
      ...stepInserts,
    ]);
    if (!finalized.length) throw new GateDContractError("RUN_PROVISIONING_LOST", "任务建立权已失效，已安全清理", 409);
  } catch (error) {
    if (inputArtifact) await discardArtifact(input.workspace.workspaceId, inputArtifact.artifactId);
    await db.delete(runs).where(and(eq(runs.id, runId), eq(runs.workspaceId, input.workspace.workspaceId)));
    await db.delete(runQuotaClaims).where(eq(runQuotaClaims.runId, runId));
    throw error;
  }
  const [run] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  return { run, replayed: false };
}

export async function loadRun(workspaceId: string, runId: string) {
  const db = getDb();
  const [run] = await db.select().from(runs).where(and(eq(runs.id, runId), eq(runs.workspaceId, workspaceId))).limit(1);
  if (!run) throw new GateDContractError("NOT_FOUND", "没有找到该运行", 404);
  const steps = await db.select().from(runSteps).where(eq(runSteps.runId, runId)).orderBy(asc(runSteps.sequence), asc(runSteps.attempt));
  const approvalRows = await db.select().from(approvals).where(and(eq(approvals.runId, runId), eq(approvals.workspaceId, workspaceId))).orderBy(desc(approvals.revision));
  const artifactRows = await db.select({
    id: artifacts.id, runStepId: artifacts.runStepId, kind: artifacts.kind, status: artifacts.status,
    name: artifacts.name, mimeType: artifacts.mimeType, byteSize: artifacts.byteSize,
    contentDigest: artifacts.contentDigest, metadata: artifacts.metadata, createdAt: artifacts.createdAt,
  }).from(artifacts).where(and(eq(artifacts.runId, runId), eq(artifacts.workspaceId, workspaceId))).orderBy(asc(artifacts.createdAt));
  return { run, steps, approvals: approvalRows, artifacts: artifactRows };
}

export async function listWorkspaceRuns(workspaceId: string) {
  const db = getDb();
  return db.select({
    id: runs.id, status: runs.status, input: runs.input, currentSequence: runs.currentSequence,
    createdAt: runs.createdAt, updatedAt: runs.updatedAt, completedAt: runs.completedAt,
    workflowVersionId: runs.workflowVersionId,
  }).from(runs).where(eq(runs.workspaceId, workspaceId)).orderBy(desc(runs.updatedAt)).limit(30);
}

export async function listWorkspaceWorkflowVersions(workspaceId: string) {
  const db = getDb();
  return db.select({
    id: workflowVersions.id,
    workflowId: workflowVersions.workflowId,
    revision: workflowVersions.revision,
    versionLabel: workflowVersions.versionLabel,
    status: workflowVersions.status,
    name: workflows.name,
    description: workflows.description,
    planDigest: workflowVersions.runtimePlanDigest,
    plan: workflowVersions.runtimePlanSnapshot,
    composition: workflowVersions.compositionSnapshot,
    createdAt: workflowVersions.createdAt,
  }).from(workflowVersions)
    .innerJoin(workflows, eq(workflowVersions.workflowId, workflows.id))
    .where(and(eq(workflows.workspaceId, workspaceId), eq(workflowVersions.status, "active")))
    .orderBy(desc(workflowVersions.createdAt)).limit(30);
}

export async function loadWorkflowVersion(workspaceId: string, workflowVersionId: string) {
  const db = getDb();
  const [version] = await db.select({
    id: workflowVersions.id,
    workflowId: workflowVersions.workflowId,
    revision: workflowVersions.revision,
    versionLabel: workflowVersions.versionLabel,
    status: workflowVersions.status,
    name: workflows.name,
    description: workflows.description,
    planDigest: workflowVersions.runtimePlanDigest,
    plan: workflowVersions.runtimePlanSnapshot,
    composition: workflowVersions.compositionSnapshot,
    createdAt: workflowVersions.createdAt,
  }).from(workflowVersions)
    .innerJoin(workflows, eq(workflowVersions.workflowId, workflows.id))
    .where(and(eq(workflowVersions.id, workflowVersionId), eq(workflows.workspaceId, workspaceId)))
    .limit(1);
  if (!version) throw new GateDContractError("NOT_FOUND", "没有找到该工作流版本", 404);
  return version;
}

export async function loadRunRuntimePlan(workspaceId: string, runId: string) {
  const db = getDb();
  const [record] = await db.select({
    plan: workflowVersions.runtimePlanSnapshot,
    planDigest: workflowVersions.runtimePlanDigest,
    runPlanDigest: runs.runtimePlanDigest,
    adapterVersion: workflowVersions.runtimeAdapterVersion,
  }).from(runs)
    .innerJoin(workflowVersions, eq(runs.workflowVersionId, workflowVersions.id))
    .innerJoin(workflows, eq(workflowVersions.workflowId, workflows.id))
    .where(and(eq(runs.id, runId), eq(runs.workspaceId, workspaceId), eq(workflows.workspaceId, workspaceId)))
    .limit(1);
  if (!record || !record.planDigest || record.planDigest !== record.runPlanDigest) {
    throw new GateDContractError("RUNTIME_PLAN_DIGEST_MISMATCH", "运行引用的工作流计划不一致", 409);
  }
  const plan = await assertCurrentExecutablePlan(record.plan, record.planDigest);
  if (record.adapterVersion !== plan.adapterVersion) {
    throw new GateDContractError("ADAPTER_VERSION_CHANGED", "运行计划适配器已变化", 409);
  }
  return plan;
}

export async function findLatestStep(runId: string, stepKey: string) {
  const db = getDb();
  const [step] = await db.select().from(runSteps).where(and(eq(runSteps.runId, runId), eq(runSteps.stepKey, stepKey))).orderBy(desc(runSteps.attempt)).limit(1);
  return step || null;
}

export async function runArtifactsByPurpose(workspaceId: string, runId: string, purposes: string[]) {
  const db = getDb();
  const [run] = await db.select({ inputArtifactId: runs.inputArtifactId }).from(runs).where(and(
    eq(runs.id, runId), eq(runs.workspaceId, workspaceId),
  )).limit(1);
  if (!run) throw new GateDContractError("NOT_FOUND", "没有找到该运行", 404);
  const [rows, steps, approvalRows] = await Promise.all([
    db.select().from(artifacts).where(and(
    eq(artifacts.workspaceId, workspaceId), eq(artifacts.runId, runId), eq(artifacts.status, "ready"),
    )).orderBy(asc(artifacts.createdAt)),
    db.select({ id: runSteps.id, status: runSteps.status, attempt: runSteps.attempt, output: runSteps.output })
      .from(runSteps).where(eq(runSteps.runId, runId)),
    db.select({ status: approvals.status, actionPayload: approvals.actionPayload, decisionPayload: approvals.decisionPayload })
      .from(approvals).where(and(eq(approvals.workspaceId, workspaceId), eq(approvals.runId, runId)))
      .orderBy(desc(approvals.revision)).limit(1),
  ]);
  const currentApproval = approvalRows[0];
  const currentApprovalPayload = currentApproval?.status === "pending" ? currentApproval.actionPayload : currentApproval?.decisionPayload;
  const approvedAnalysisId = currentApprovalPayload && typeof currentApprovalPayload === "object" && !Array.isArray(currentApprovalPayload)
    ? String((currentApprovalPayload as Record<string, unknown>)[currentApproval.status === "pending" ? "baseApprovedArtifactId" : "approvedArtifactId"] || "")
    : "";
  const stepById = new Map(steps.map((step) => [step.id, step]));
  const selected = rows.filter((item) => {
    const purpose = String((item.metadata as Record<string, unknown> | null)?.purpose || "");
    if (!purposes.includes(purpose)) return false;
    if (purpose === "interview_source_copy") return item.id === run.inputArtifactId;
    if (purpose === "approved_analysis") return Boolean(approvedAnalysisId && item.id === approvedAnalysisId);
    if (!item.runStepId) return false;
    const step = stepById.get(item.runStepId);
    const output = step?.output && typeof step.output === "object" && !Array.isArray(step.output) ? step.output as Record<string, unknown> : {};
    const expectedArtifactId = purpose === "quality_report" ? output.qualityArtifactId : output.artifactId;
    return Boolean(step && ["succeeded", "partial_failed"].includes(step.status) && expectedArtifactId === item.id);
  });
  const result: Record<string, { artifactId: string; digest: string; body: string }> = {};
  for (const item of selected) {
    const purpose = String((item.metadata as Record<string, unknown>).purpose);
    const loaded = await readArtifact(workspaceId, item.id);
    result[purpose] = { artifactId: item.id, digest: item.contentDigest, body: loaded.body };
  }
  return result;
}

export async function appendAudit(input: {
  workspace: GateDWorkspace;
  action: string;
  objectType: string;
  objectId: string;
  runId?: string;
  beforeDigest?: string | null;
  afterDigest?: string | null;
  eventData?: Record<string, unknown>;
}) {
  const db = getDb();
  await db.insert(auditEvents).values({
    id: crypto.randomUUID(), workspaceId: input.workspace.workspaceId, actorType: "account",
    actorId: input.workspace.accountId, action: input.action, objectType: input.objectType,
    objectId: input.objectId, runId: input.runId, beforeDigest: input.beforeDigest,
    afterDigest: input.afterDigest, dataRegion: input.workspace.dataRegion, eventData: input.eventData || {},
  });
}

export { approvals, artifacts, runs, runSteps, workflowVersions, workflows, and, eq, inArray, sql, getDb };
