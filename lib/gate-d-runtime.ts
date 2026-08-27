import { desc } from "drizzle-orm";
import {
  runAssessWorkflowStep,
  runClusterInsightsStep,
  runExtractEvidenceStep,
  runGeneratePrdStep,
  runNormalizeInterviewStep,
  runPrdQualityStep,
  type PrdRuntimeInput,
} from "./interview-runtime";
import type {
  ApprovedTheme,
  EvidenceExtractionOutput,
  InsightClusteringOutput,
  PrdGenerationOutput,
  WorkflowAiAssessmentOutput,
} from "@/runtime/skills";
import { contentDigest } from "./gate-c-release-resolver";
import { GateDContractError } from "./gate-d-contracts";
import { ModelGatewayError } from "./openai-responses";
import {
  and,
  approvals,
  appendAudit,
  claimActiveRunQuota,
  commitArtifact,
  discardArtifact,
  discardUncommittedApprovalArtifacts,
  discardUncommittedStepArtifacts,
  eq,
  findLatestStep,
  getDb,
  loadRun,
  loadRunRuntimePlan,
  readArtifact,
  releaseActiveRunQuota,
  releaseRunQuotaClaim,
  runArtifactsByPurpose,
  runs,
  runSteps,
  sql,
  type GateDWorkspace,
} from "./gate-d-store";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function parseJson<T>(body: string, label: string): T {
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new GateDContractError("PERSISTED_OUTPUT_INVALID", `${label}已损坏，无法继续运行`, 503);
  }
}

function safeRuntimeError(error: unknown) {
  const value = error as { code?: string; message?: string; status?: number };
  return {
    code: typeof value?.code === "string" ? value.code : "STEP_FAILED",
    message: typeof value?.message === "string" ? value.message.slice(0, 600) : "运行步骤失败",
    retryable: ![
      "INVALID_INPUT", "MODEL_OUTPUT_INVALID", "MODEL_CONFIGURATION_ERROR",
      "MODEL_POLICY_REJECTED", "MODEL_CANCELLED", "RUN_CANCELLED",
    ].includes(String(value?.code || "")),
  };
}

function safeModelFailureReceipt(error: unknown): JsonRecord | null {
  if (!(error instanceof ModelGatewayError) || !error.details?.attempts?.length) return null;
  return {
    modelFailure: {
      code: error.code,
      completedAt: new Date().toISOString(),
      attempts: error.details.attempts.map((attempt) => ({
        provider: attempt.provider,
        model: attempt.model,
        outcome: attempt.outcome,
        requestAttempted: attempt.requestAttempted,
        deliveryState: attempt.deliveryState,
        usageStatus: attempt.usageStatus,
        usage: attempt.usage,
        errorCode: attempt.errorCode,
        upstreamStatus: attempt.upstreamStatus,
        requestId: attempt.requestId,
        durationMs: attempt.durationMs,
      })),
    },
    ...(error.details.modelRun ? { modelRun: error.details.modelRun } : {}),
  };
}

function knownFailureUsage(failureReceipt: JsonRecord | null) {
  const modelRunUsage = asRecord(asRecord(failureReceipt?.modelRun).usage);
  if (Object.keys(modelRunUsage).length) return modelRunUsage;
  const attempts = asRecord(failureReceipt?.modelFailure).attempts;
  if (!Array.isArray(attempts)) return {};
  return attempts.reduce<JsonRecord>((sum, attempt) => {
    const usage = asRecord(asRecord(attempt).usage);
    return {
      inputTokens: Number(sum.inputTokens || 0) + Number(usage.inputTokens || 0),
      outputTokens: Number(sum.outputTokens || 0) + Number(usage.outputTokens || 0),
      totalTokens: Number(sum.totalTokens || 0) + Number(usage.totalTokens || 0),
    };
  }, {});
}

function knownFailureModel(failureReceipt: JsonRecord | null) {
  const modelRun = asRecord(failureReceipt?.modelRun);
  if (typeof modelRun.provider === "string" && typeof modelRun.model === "string") {
    return { provider: modelRun.provider, model: modelRun.model };
  }
  const attempts = asRecord(failureReceipt?.modelFailure).attempts;
  if (!Array.isArray(attempts)) return { provider: null, model: null };
  const reported = attempts.map(asRecord).find((attempt) => attempt.usageStatus === "reported");
  return {
    provider: typeof reported?.provider === "string" ? reported.provider : null,
    model: typeof reported?.model === "string" ? reported.model : null,
  };
}

async function currentRun(workspaceId: string, runId: string) {
  return (await loadRun(workspaceId, runId)).run;
}

async function ensureNotCancelled(workspaceId: string, runId: string, leaseToken?: string) {
  const run = await currentRun(workspaceId, runId);
  if (run.status === "cancelled" || run.cancelRequestedAt) {
    throw new GateDContractError("RUN_CANCELLED", "该运行已经取消", 409);
  }
  if (leaseToken && run.leaseToken !== leaseToken) {
    throw new GateDContractError("LEASE_LOST", "运行步骤已由另一请求接管", 409);
  }
  return run;
}

async function createApprovalGate(workspace: GateDWorkspace, runId: string) {
  const db = getDb();
  const step = await findLatestStep(runId, "approve_themes");
  if (!step) throw new GateDContractError("RUNTIME_PLAN_INVALID", "审批节点不存在", 500);
  const createdAt = new Date().toISOString();
  let [approval] = await db.select().from(approvals).where(and(
    eq(approvals.workspaceId, workspace.workspaceId), eq(approvals.runId, runId),
    eq(approvals.actionType, "approve_interview_themes"),
  )).orderBy(desc(approvals.revision)).limit(1);
  if (approval?.status === "pending" && approval.expiresAt && approval.expiresAt <= createdAt) {
    await db.update(approvals).set({ status: "expired", decidedAt: createdAt, decisionReason: "确认窗口已过期" })
      .where(and(eq(approvals.id, approval.id), eq(approvals.status, "pending")));
    approval = { ...approval, status: "expired" };
  }
  if (!approval || approval.status !== "pending") {
    const outputs = await runArtifactsByPurpose(workspace.workspaceId, runId, [
      "extracted_evidence", "clustered_insights", "workflow_assessment",
    ]);
    if (!outputs.extracted_evidence || !outputs.clustered_insights || !outputs.workflow_assessment) {
      throw new GateDContractError("ANALYSIS_INCOMPLETE", "分析结果不完整，不能进入人工确认", 409);
    }
    const upstreamOutputDigest = await contentDigest({
      evidence: outputs.extracted_evidence.digest,
      insights: outputs.clustered_insights.digest,
      workflow: outputs.workflow_assessment.digest,
    });
    const approvalId = `approval_${crypto.randomUUID()}`;
    const revision = Number(approval?.revision || 0) + 1;
    const inserted = await db.insert(approvals).values({
      id: approvalId, workspaceId: workspace.workspaceId, runId, runStepId: step.id,
      actionType: "approve_interview_themes",
      actionPayload: {
        evidenceArtifactId: outputs.extracted_evidence.artifactId,
        insightsArtifactId: outputs.clustered_insights.artifactId,
        workflowArtifactId: outputs.workflow_assessment.artifactId,
      },
      revision, supersedesApprovalId: approval?.id || null,
      upstreamOutputDigest, payloadDigest: upstreamOutputDigest,
      riskLevel: "medium", status: "pending", requestedByType: "agent",
      requestedById: "internet_product_interview_v1", createdAt,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    }).onConflictDoNothing({ target: [approvals.runId, approvals.actionType, approvals.revision] })
      .returning({ id: approvals.id });
    if (!inserted.length) {
      [approval] = await db.select().from(approvals).where(and(
        eq(approvals.workspaceId, workspace.workspaceId), eq(approvals.runId, runId),
        eq(approvals.actionType, "approve_interview_themes"), eq(approvals.status, "pending"),
      )).orderBy(desc(approvals.revision)).limit(1);
      if (!approval) throw new GateDContractError("APPROVAL_STATE_CONFLICT", "人工确认状态已变化，请重新打开运行", 409);
    } else {
      [approval] = await db.select().from(approvals).where(eq(approvals.id, approvalId)).limit(1);
    }
  }
  if (!approval) throw new GateDContractError("APPROVAL_STATE_CONFLICT", "人工确认未能建立", 409);

  const current = await currentRun(workspace.workspaceId, runId);
  if (current.status === "awaiting_approval" && step.status === "awaiting_approval") return approval;
  const runReady = sql`exists (select 1 from ${runs} where ${runs.id} = ${runId} and ${runs.workspaceId} = ${workspace.workspaceId} and ${runs.status} = 'queued' and ${runs.currentSequence} = 4)`;
  const approvalPending = sql`exists (select 1 from ${approvals} where ${approvals.id} = ${approval.id} and ${approvals.status} = 'pending')`;
  const [updatedStep, updatedRun] = await db.batch([
    db.update(runSteps).set({ status: "awaiting_approval", updatedAt: createdAt })
      .where(and(eq(runSteps.id, step.id), eq(runSteps.status, "queued"), runReady, approvalPending))
      .returning({ id: runSteps.id }),
    db.update(runs).set({
      status: "awaiting_approval", currentSequence: 4, leaseToken: null, leaseExpiresAt: null,
      updatedAt: createdAt, stateVersion: sql`${runs.stateVersion} + 1`,
    }).where(and(
      eq(runs.id, runId), eq(runs.workspaceId, workspace.workspaceId), eq(runs.status, "queued"), eq(runs.currentSequence, 4),
      sql`exists (select 1 from ${runSteps} where ${runSteps.id} = ${step.id} and ${runSteps.status} = 'awaiting_approval')`,
    )).returning({ id: runs.id }),
  ]);
  if (!updatedStep.length || !updatedRun.length) {
    const after = await currentRun(workspace.workspaceId, runId);
    const repairedStep = await findLatestStep(runId, "approve_themes");
    if (after.status === "awaiting_approval" && repairedStep?.status === "awaiting_approval") return approval;
    await db.update(approvals).set({ status: "cancelled", decidedAt: createdAt, decisionReason: "运行状态已变化" })
      .where(and(eq(approvals.id, approval.id), eq(approvals.status, "pending")));
    throw new GateDContractError("RUN_STATE_CHANGED", "运行状态已变化，不能建立人工确认", 409);
  }
  await appendAudit({ workspace, action: "run.approval_requested", objectType: "approval", objectId: approval.id, runId, afterDigest: approval.upstreamOutputDigest })
    .catch((error) => console.error("Gate D audit append failed", { name: error instanceof Error ? error.name : "UnknownError", code: "AUDIT_APPEND_FAILED" }));
  return approval;
}

export async function approveInterviewRun(input: {
  workspace: GateDWorkspace;
  runId: string;
  expectedPayloadDigest: string;
  selectedThemeIds: string[];
  themeEdits?: Record<string, { title?: string; statement?: string; note?: string }>;
  evidenceDecisions?: Record<string, { decision?: string; interpretation?: string }>;
  addedEvidence?: { quote?: string; interpretation?: string; category?: string }[];
  addedThemes?: { title?: string; statement?: string; supportingEvidenceIds?: string[]; productImplication?: string }[];
}) {
  const db = getDb();
  const bundle = await loadRun(input.workspace.workspaceId, input.runId);
  if (bundle.run.status !== "awaiting_approval") {
    throw new GateDContractError("RUN_NOT_AWAITING_APPROVAL", "该运行当前不在等待确认状态", 409);
  }
  const [approval] = await db.select().from(approvals).where(and(
    eq(approvals.workspaceId, input.workspace.workspaceId), eq(approvals.runId, input.runId), eq(approvals.status, "pending"),
  )).orderBy(desc(approvals.revision)).limit(1);
  if (!approval) throw new GateDContractError("APPROVAL_NOT_FOUND", "没有找到待确认内容", 404);
  if (approval.payloadDigest !== input.expectedPayloadDigest || approval.expiresAt && approval.expiresAt <= new Date().toISOString()) {
    throw new GateDContractError("STALE_APPROVAL", "确认内容已变化或过期，请重新打开当前运行", 409);
  }
  await discardUncommittedApprovalArtifacts(input.workspace.workspaceId, input.runId, approval.id);
  const refs = asRecord(approval.actionPayload);
  const evidenceBody = await readArtifact(input.workspace.workspaceId, String(refs.evidenceArtifactId || ""));
  const insightsBody = await readArtifact(input.workspace.workspaceId, String(refs.insightsArtifactId || ""));
  const workflowBody = await readArtifact(input.workspace.workspaceId, String(refs.workflowArtifactId || ""));
  const evidence = parseJson<EvidenceExtractionOutput>(evidenceBody.body, "证据");
  const insights = parseJson<InsightClusteringOutput>(insightsBody.body, "洞察");
  const workflow = parseJson<WorkflowAiAssessmentOutput>(workflowBody.body, "工作流判断");
  const normalizedOutputs = await runArtifactsByPurpose(input.workspace.workspaceId, input.runId, ["normalized_interview"]);
  if (!normalizedOutputs.normalized_interview) throw new GateDContractError("ANALYSIS_INCOMPLETE", "标准化原文不存在，不能修订证据", 409);
  const normalized = parseJson<ReturnType<typeof runNormalizeInterviewStep>["output"]>(normalizedOutputs.normalized_interview.body, "标准化原文");
  const categories = new Set(["need", "behavior", "pain_point", "motivation", "workaround", "expectation", "objection", "counterexample"]);
  const acceptedEvidence = evidence.evidence_items.flatMap((item) => {
    const decision = input.evidenceDecisions?.[item.evidence_id];
    if (decision?.decision === "rejected") return [];
    const interpretation = decision?.interpretation?.trim().slice(0, 1200);
    return [{ ...item, interpretation: interpretation || item.interpretation }];
  });
  const userEvidence = (input.addedEvidence || []).slice(0, 5).map((candidate, index) => {
    const quote = candidate.quote?.trim().slice(0, 800) || "";
    const interpretation = candidate.interpretation?.trim().slice(0, 1200) || "";
    const category = candidate.category?.trim() || "need";
    const segment = normalized.segments.find((item) => item.text.includes(quote));
    if (!quote || !interpretation || !segment || !categories.has(category)) {
      throw new GateDContractError("USER_EVIDENCE_INVALID", "新增证据必须是持久化原文中的连续片段，并填写解释和合法分类");
    }
    return {
      evidence_id: `user-ev-${String(index + 1).padStart(3, "0")}`,
      segment_id: segment.segment_id, source_id: segment.source_id, category: category as EvidenceExtractionOutput["evidence_items"][number]["category"],
      quote, interpretation, confidence: 1, needs_review: false, review_reason: null,
      provenance: "user_supplied" as const,
    };
  });
  const effectiveEvidence = [...acceptedEvidence, ...userEvidence];
  const effectiveEvidenceIds = new Set(effectiveEvidence.map((item) => item.evidence_id));
  const selected = new Set(input.selectedThemeIds);
  const addedThemeCount = input.addedThemes?.length || 0;
  if (!selected.size && !addedThemeCount || selected.size + addedThemeCount > 8) throw new GateDContractError("APPROVAL_SELECTION_INVALID", "请确认或新增 1 到 8 个主题");
  const approvedThemes = insights.themes.filter((theme) => selected.has(theme.theme_id)).map((theme) => {
    const edit = input.themeEdits?.[theme.theme_id];
    const supportingEvidenceIds = theme.supporting_evidence_ids.filter((id) => effectiveEvidenceIds.has(id));
    if (!supportingEvidenceIds.length) throw new GateDContractError("THEME_EVIDENCE_REQUIRED", `主题 ${theme.title} 没有保留任何有效证据`);
    return {
      ...theme,
      supporting_evidence_ids: supportingEvidenceIds,
      approved_title: edit?.title?.trim().slice(0, 180) || theme.title,
      approved_statement: edit?.statement?.trim().slice(0, 1200) || theme.statement,
      approval_note: edit?.note?.trim().slice(0, 500) || null,
    } satisfies ApprovedTheme;
  });
  if (approvedThemes.length !== selected.size) throw new GateDContractError("APPROVAL_SELECTION_INVALID", "确认主题包含不属于本次分析的 ID");
  const addedThemes = (input.addedThemes || []).slice(0, 3).map((theme, index) => {
    const supporting = Array.isArray(theme.supportingEvidenceIds) ? [...new Set(theme.supportingEvidenceIds)].filter((id) => effectiveEvidenceIds.has(id)).slice(0, 12) : [];
    if (!theme.title?.trim() || !theme.statement?.trim() || !supporting.length) {
      throw new GateDContractError("USER_THEME_INVALID", "新增主题必须填写标题、表述并绑定至少一条有效证据");
    }
    return {
      theme_id: `user-theme-${String(index + 1).padStart(3, "0")}`,
      title: theme.title.trim().slice(0, 180), statement: theme.statement.trim().slice(0, 1200),
      supporting_evidence_ids: supporting, counter_evidence_ids: [], independent_source_count: new Set(effectiveEvidence.filter((item) => supporting.includes(item.evidence_id)).map((item) => item.source_id)).size,
      strength: "single_case" as const, product_implication: theme.productImplication?.trim().slice(0, 800) || "由用户补充，需在评审中确认产品含义",
      uncertainty: "用户在人工确认阶段补充，尚未经过模型聚类复核",
      approved_title: theme.title.trim().slice(0, 180), approved_statement: theme.statement.trim().slice(0, 1200), approval_note: "用户新增主题",
    } satisfies ApprovedTheme;
  });
  const allApprovedThemes = [...approvedThemes, ...addedThemes];
  const payload = { evidence: effectiveEvidence, approvedThemes: allApprovedThemes, workflowNodes: workflow.workflow_nodes };
  const payloadDigest = await contentDigest(payload);
  const artifact = await commitArtifact({
    workspaceId: input.workspace.workspaceId, runId: input.runId, runStepId: approval.runStepId,
    kind: "intermediate", name: "人工确认后的访谈分析.json", mimeType: "application/json",
    body: JSON.stringify(payload), metadata: { purpose: "approved_analysis", approvalId: approval.id, payloadDigest },
  });
  const decidedAt = new Date().toISOString();
  const decisionToken = `decision_${crypto.randomUUID()}`;
  const approvalPreconditions = sql`exists (select 1 from ${runs} where ${runs.id} = ${input.runId} and ${runs.workspaceId} = ${input.workspace.workspaceId} and ${runs.status} = 'awaiting_approval') and exists (select 1 from ${runSteps} where ${runSteps.id} = ${approval.runStepId} and ${runSteps.status} = 'awaiting_approval')`;
  const approvalUpdate = db.update(approvals).set({
    status: "approved", decidedByAccountId: input.workspace.accountId, decidedAt,
    decisionPayload: { selectedThemeIds: [...selected], approvedArtifactId: artifact.artifactId },
    decisionReason: "用户在 Gate D 确认台显式批准", payloadDigest, decisionToken,
  }).where(and(
    eq(approvals.id, approval.id), eq(approvals.status, "pending"),
    eq(approvals.payloadDigest, input.expectedPayloadDigest),
    sql`${approvals.expiresAt} > ${decidedAt}`,
    approvalPreconditions,
  ))
    .returning({ id: approvals.id });
  const approvalWon = sql`exists (select 1 from ${approvals} where ${approvals.id} = ${approval.id} and ${approvals.decisionToken} = ${decisionToken} and ${approvals.status} = 'approved')`;
  let updated: { id: string }[];
  let updatedStep: { id: string }[];
  let updatedRun: { id: string }[];
  try {
    [updated, updatedStep, updatedRun] = await db.batch([
      approvalUpdate,
      db.update(runSteps).set({
        status: "succeeded", output: { artifactId: artifact.artifactId, payloadDigest }, outputDigest: payloadDigest,
        completedAt: decidedAt, updatedAt: decidedAt,
      }).where(and(eq(runSteps.id, approval.runStepId!), approvalWon)).returning({ id: runSteps.id }),
      db.update(runs).set({
        status: "queued", currentSequence: 5, updatedAt: decidedAt,
        stateVersion: sql`${runs.stateVersion} + 1`, leaseToken: null, leaseExpiresAt: null,
      }).where(and(
        eq(runs.id, input.runId), eq(runs.workspaceId, input.workspace.workspaceId),
        eq(runs.status, "awaiting_approval"), approvalWon,
      )).returning({ id: runs.id }),
    ]);
  } catch (error) {
    await discardArtifact(input.workspace.workspaceId, artifact.artifactId);
    throw error;
  }
  if (!updated.length || !updatedStep.length || !updatedRun.length) {
    await discardArtifact(input.workspace.workspaceId, artifact.artifactId);
    throw new GateDContractError("STALE_APPROVAL", "该确认已被其他请求处理", 409);
  }
  await appendAudit({ workspace: input.workspace, action: "run.approval_decided", objectType: "approval", objectId: approval.id, runId: input.runId, beforeDigest: input.expectedPayloadDigest, afterDigest: payloadDigest })
    .catch((error) => console.error("Gate D audit append failed", { name: error instanceof Error ? error.name : "UnknownError", code: "AUDIT_APPEND_FAILED" }));
  return loadRun(input.workspace.workspaceId, input.runId);
}

export async function reviseApprovedInterviewRun(workspace: GateDWorkspace, runId: string) {
  const db = getDb();
  await loadRunRuntimePlan(workspace.workspaceId, runId);
  const bundle = await loadRun(workspace.workspaceId, runId);
  if (!["succeeded", "partial_failed"].includes(bundle.run.status) || bundle.run.currentSequence < 7) {
    throw new GateDContractError("RUN_NOT_REVISION_READY", "只有已经生成 PRD 的运行可以重新打开人工确认", 409);
  }
  const latestApproval = bundle.approvals[0];
  if (!latestApproval || latestApproval.status !== "approved") {
    throw new GateDContractError("APPROVAL_NOT_FOUND", "没有找到可修订的已批准版本", 404);
  }
  const approvalStep = await findLatestStep(runId, "approve_themes");
  if (!approvalStep || approvalStep.status !== "succeeded") throw new GateDContractError("APPROVAL_STATE_CONFLICT", "人工确认步骤状态不允许修订", 409);
  const createdAt = new Date().toISOString();
  const newStepId = `step_${crypto.randomUUID()}`;
  const newApprovalId = `approval_${crypto.randomUUID()}`;
  const nextRevision = latestApproval.revision + 1;
  const latestDecision = asRecord(latestApproval.decisionPayload);
  const approvedArtifactId = String(latestDecision.approvedArtifactId || "");
  if (!approvedArtifactId) throw new GateDContractError("APPROVED_ANALYSIS_MISSING", "上一版人工确认材料不存在，不能建立新修订", 409);
  await readArtifact(workspace.workspaceId, approvedArtifactId);
  const revisionPayloadDigest = await contentDigest({
    supersedesApprovalId: latestApproval.id,
    previousPayloadDigest: latestApproval.payloadDigest,
    approvedArtifactId,
    revision: nextRevision,
  });
  const runReopened = sql`exists (
    select 1 from ${runs}
    where ${runs.id} = ${runId}
      and ${runs.workspaceId} = ${workspace.workspaceId}
      and ${runs.status} = 'awaiting_approval'
      and ${runs.updatedAt} = ${createdAt}
  )`;
  // Validate the complete previous human artifact before occupying a permanent
  // active slot. From this point onward every throwable mutation is covered by
  // the catch that releases the exact quota claim.
  const activeQuotaClaimId = await claimActiveRunQuota(workspace.workspaceId, runId);
  try {
    const [updatedRun] = await db.batch([
      db.update(runs).set({
        status: "awaiting_approval", currentSequence: 4, output: null, error: null,
        completedAt: null, updatedAt: createdAt, stateVersion: sql`${runs.stateVersion} + 1`,
      }).where(and(
        eq(runs.id, runId), eq(runs.workspaceId, workspace.workspaceId),
        eq(runs.stateVersion, bundle.run.stateVersion), sql`${runs.status} in ('succeeded','partial_failed')`,
      )).returning({ id: runs.id }),
      db.update(runSteps).set({
        status: "blocked", error: { code: "DOWNSTREAM_SUPERSEDED", message: "上游人工确认已重新打开；该结果保留为历史但不再是当前输出", retryable: false },
        updatedAt: createdAt,
      }).where(and(
        eq(runSteps.runId, runId), sql`${runSteps.sequence} >= 5`,
        sql`${runSteps.status} in ('queued','running','succeeded','partial_failed','failed')`,
        runReopened,
      )),
      db.insert(runSteps).values({
        ...approvalStep, id: newStepId, attempt: approvalStep.attempt + 1, status: "awaiting_approval",
        input: null, output: null, error: null, inputDigest: null, outputDigest: null, receipt: null,
        leaseToken: null, leaseExpiresAt: null, startedAt: null, completedAt: null, createdAt, updatedAt: createdAt,
      }),
      db.insert(approvals).values({
        id: newApprovalId, workspaceId: workspace.workspaceId, runId, runStepId: newStepId,
        actionType: latestApproval.actionType,
        actionPayload: { ...asRecord(latestApproval.actionPayload), baseApprovedArtifactId: approvedArtifactId },
        revision: nextRevision, upstreamOutputDigest: latestApproval.payloadDigest,
        payloadDigest: revisionPayloadDigest, supersedesApprovalId: latestApproval.id,
        riskLevel: latestApproval.riskLevel, status: "pending", requestedByType: "user",
        requestedById: workspace.accountId, createdAt, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }),
    ]);
    if (!updatedRun.length) throw new GateDContractError("RUN_STATE_CHANGED", "运行状态已被其他请求修改", 409);
  } catch (error) {
    await releaseRunQuotaClaim(activeQuotaClaimId);
    await db.delete(approvals).where(eq(approvals.id, newApprovalId));
    await db.delete(runSteps).where(eq(runSteps.id, newStepId));
    throw error;
  }
  await appendAudit({ workspace, action: "run.approval_reopened", objectType: "approval", objectId: newApprovalId, runId, beforeDigest: latestApproval.payloadDigest, afterDigest: revisionPayloadDigest, eventData: { revision: nextRevision, baseApprovedArtifactId: approvedArtifactId } })
    .catch((error) => console.error("Gate D audit append failed", { name: error instanceof Error ? error.name : "UnknownError", code: "AUDIT_APPEND_FAILED" }));
  return loadRun(workspace.workspaceId, runId);
}

export async function advanceInterviewRun(workspace: GateDWorkspace, runId: string) {
  const db = getDb();
  const plan = await loadRunRuntimePlan(workspace.workspaceId, runId);
  const bundle = await loadRun(workspace.workspaceId, runId);
  const run = bundle.run;
  if (["succeeded", "cancelled", "blocked"].includes(run.status)) return bundle;
  if (run.status === "awaiting_approval") {
    await createApprovalGate(workspace, runId);
    return loadRun(workspace.workspaceId, runId);
  }
  if (run.status === "running") {
    const nowIso = new Date().toISOString();
    if (!run.leaseToken || !run.leaseExpiresAt || run.leaseExpiresAt > nowIso) {
      throw new GateDContractError("RUN_BUSY", "当前节点仍由另一个请求执行，请稍后刷新", 409);
    }
    const runningStep = bundle.steps.find((candidate) => candidate.status === "running" && candidate.leaseToken === run.leaseToken);
    if (!runningStep) throw new GateDContractError("LEASE_RECOVERY_CONFLICT", "过期租约没有对应步骤，请联系管理员", 409);
    const recoveredAt = new Date().toISOString();
    const leaseExpired = sql`exists (select 1 from ${runs} where ${runs.id} = ${runId} and ${runs.workspaceId} = ${workspace.workspaceId} and ${runs.status} = 'running' and ${runs.leaseToken} = ${run.leaseToken} and ${runs.leaseExpiresAt} <= ${recoveredAt})`;
    const failedStep = sql`exists (select 1 from ${runSteps} where ${runSteps.id} = ${runningStep.id} and ${runSteps.status} = 'failed' and ${runSteps.leaseToken} is null)`;
    const [stepRecovered, runRecovered] = await db.batch([
      db.update(runSteps).set({
        status: "failed", error: { code: "LEASE_EXPIRED", message: "Worker 租约过期，已保留旧 attempt 并准备安全重试", retryable: true },
        completedAt: recoveredAt, updatedAt: recoveredAt, leaseToken: null, leaseExpiresAt: null,
      }).where(and(eq(runSteps.id, runningStep.id), eq(runSteps.status, "running"), eq(runSteps.leaseToken, run.leaseToken), leaseExpired))
        .returning({ id: runSteps.id }),
      db.update(runs).set({
        status: run.currentSequence > 0 ? "partial_failed" : "failed",
        error: { code: "LEASE_EXPIRED", message: "上一次执行中断，系统已恢复到可重试状态", retryable: true },
        updatedAt: recoveredAt, leaseToken: null, leaseExpiresAt: null,
        stateVersion: sql`${runs.stateVersion} + 1`,
      }).where(and(eq(runs.id, runId), eq(runs.workspaceId, workspace.workspaceId), eq(runs.leaseToken, run.leaseToken), failedStep))
        .returning({ id: runs.id }),
    ]);
    if (!stepRecovered.length || !runRecovered.length) throw new GateDContractError("RUN_BUSY", "该过期任务已被另一请求恢复", 409);
    await discardUncommittedStepArtifacts(workspace.workspaceId, runId, runningStep.id);
    await appendAudit({ workspace, action: "run.lease_recovered", objectType: "run_step", objectId: runningStep.id, runId, eventData: { previousLease: "redacted" } })
      .catch((error) => console.error("Gate D audit append failed", { name: error instanceof Error ? error.name : "UnknownError", code: "AUDIT_APPEND_FAILED" }));
    return advanceInterviewRun(workspace, runId);
  }
  if (run.currentSequence === 4) {
    await createApprovalGate(workspace, runId);
    return loadRun(workspace.workspaceId, runId);
  }
  if (run.status === "partial_failed" && run.currentSequence >= plan.stages.length) return bundle;
  if (run.currentSequence < 0 || run.currentSequence >= plan.stages.length) throw new GateDContractError("RUNTIME_SEQUENCE_INVALID", "运行序号无效", 500);

  const runtimeStage = plan.stages[run.currentSequence];
  const stepKey = runtimeStage.id;
  let step = await findLatestStep(runId, stepKey);
  if (!step) throw new GateDContractError("RUNTIME_PLAN_INVALID", "运行步骤不存在", 500);
  const stepPin = asRecord(step.skillPinSnapshot);
  if (
    step.sequence !== runtimeStage.sequence || step.kind !== runtimeStage.control ||
    step.skillManifestDigest !== runtimeStage.release.manifestDigest ||
    stepPin.releaseId !== runtimeStage.release.releaseId
  ) {
    throw new GateDContractError("RUNTIME_RELEASE_CHANGED", "运行步骤与冻结 Release Pin 不一致，已阻止执行", 409);
  }
  let retryStepId: string | null = null;
  if (["failed", "partial_failed", "cancelled", "blocked"].includes(step.status)) {
    if (step.attempt >= 3) throw new GateDContractError("RETRY_LIMIT_REACHED", "该步骤已经达到三次重试上限", 409);
    const retryId = `step_${crypto.randomUUID()}`;
    await db.insert(runSteps).values({
      ...step, id: retryId, attempt: step.attempt + 1, status: "queued", input: null, output: null, error: null,
      inputDigest: null, outputDigest: null, receipt: null, leaseToken: null, leaseExpiresAt: null,
      startedAt: null, completedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    retryStepId = retryId;
    step = (await db.select().from(runSteps).where(eq(runSteps.id, retryId)).limit(1))[0];
  }
  const leaseToken = `lease_${crypto.randomUUID()}`;
  const leaseExpiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
  const claimTime = new Date().toISOString();
  const stepQueued = sql`exists (select 1 from ${runSteps} where ${runSteps.id} = ${step.id} and ${runSteps.status} = 'queued')`;
  const runClaimed = sql`exists (select 1 from ${runs} where ${runs.id} = ${runId} and ${runs.workspaceId} = ${workspace.workspaceId} and ${runs.leaseToken} = ${leaseToken} and ${runs.status} = 'running')`;
  const [claimed, claimedStep] = await db.batch([
    db.update(runs).set({
      status: "running", leaseToken, leaseExpiresAt, startedAt: run.startedAt || claimTime,
      updatedAt: claimTime, stateVersion: sql`${runs.stateVersion} + 1`,
    }).where(and(
      eq(runs.id, runId), eq(runs.workspaceId, workspace.workspaceId), eq(runs.stateVersion, run.stateVersion),
      inRunStates(["queued", "failed", "partial_failed"]), stepQueued,
    )).returning({ id: runs.id }),
    db.update(runSteps).set({ status: "running", leaseToken, leaseExpiresAt, startedAt: claimTime, updatedAt: claimTime })
      .where(and(eq(runSteps.id, step.id), eq(runSteps.status, "queued"), runClaimed))
      .returning({ id: runSteps.id }),
  ]);
  if (!claimed.length || !claimedStep.length) {
    if (retryStepId) await db.delete(runSteps).where(and(eq(runSteps.id, retryStepId), eq(runSteps.status, "queued")));
    throw new GateDContractError("RUN_BUSY", "另一个请求正在推进该运行", 409);
  }

  let committedArtifactIds: string[] = [];
  let durableCommitted = false;
  try {
    await ensureNotCancelled(workspace.workspaceId, runId, leaseToken);
    const inputMeta = asRecord(run.input);
    const prior = await runArtifactsByPurpose(workspace.workspaceId, runId, [
      "interview_source_copy", "normalized_interview", "extracted_evidence", "clustered_insights",
      "workflow_assessment", "approved_analysis", "prd_draft",
    ]);
    const modelOptions = {
      cancellation: {
        check: async () => { await ensureNotCancelled(workspace.workspaceId, runId, leaseToken); },
        pollIntervalMs: 750,
      },
    };
    let output: unknown;
    let receipt: JsonRecord;
    let purpose: string;
    let name: string;
    let kind: "intermediate" | "output" = "intermediate";
    let mimeType = "application/json";
    if (stepKey === "normalize") {
      const source = prior.interview_source_copy || await (async () => {
        const loaded = await readArtifact(workspace.workspaceId, String(run.inputArtifactId || ""));
        return { artifactId: loaded.record.id, digest: loaded.record.contentDigest, body: loaded.body };
      })();
      const result = runNormalizeInterviewStep({ runId, transcript: source.body, researchGoal: String(inputMeta.researchGoal || "") });
      output = result.output; receipt = result.receipt as unknown as JsonRecord; purpose = "normalized_interview"; name = "标准化访谈.json";
    } else if (stepKey === "extract_evidence") {
      const normalized = parseJson<ReturnType<typeof runNormalizeInterviewStep>["output"]>(prior.normalized_interview.body, "标准化材料");
      const result = await runExtractEvidenceStep({ researchGoal: String(inputMeta.researchGoal || ""), normalized }, modelOptions);
      output = result.output; receipt = result.receipt as unknown as JsonRecord; purpose = "extracted_evidence"; name = "逐字证据.json";
    } else if (stepKey === "cluster_insights") {
      const evidence = parseJson<EvidenceExtractionOutput>(prior.extracted_evidence.body, "证据");
      const result = await runClusterInsightsStep({ researchGoal: String(inputMeta.researchGoal || ""), evidence }, modelOptions);
      output = result.output; receipt = result.receipt as unknown as JsonRecord; purpose = "clustered_insights"; name = "洞察主题.json";
    } else if (stepKey === "assess_workflow_ai") {
      const evidence = parseJson<EvidenceExtractionOutput>(prior.extracted_evidence.body, "证据");
      const insights = parseJson<InsightClusteringOutput>(prior.clustered_insights.body, "洞察");
      const result = await runAssessWorkflowStep({ researchGoal: String(inputMeta.researchGoal || ""), evidence, insights }, modelOptions);
      output = result.output; receipt = result.receipt as unknown as JsonRecord; purpose = "workflow_assessment"; name = "工作流 AI 判断.json";
    } else if (stepKey === "generate_prd") {
      const approved = parseJson<{ evidence: EvidenceExtractionOutput["evidence_items"]; approvedThemes: ApprovedTheme[]; workflowNodes: WorkflowAiAssessmentOutput["workflow_nodes"] }>(prior.approved_analysis.body, "已确认分析");
      const result = await runGeneratePrdStep({
        researchGoal: String(inputMeta.researchGoal || ""), productContext: String(inputMeta.productContext || ""),
        evidence: approved.evidence, approvedThemes: approved.approvedThemes, workflowNodes: approved.workflowNodes,
      } satisfies PrdRuntimeInput, modelOptions);
      output = result.output; receipt = result.receipt as unknown as JsonRecord; purpose = "prd_draft"; name = "PRD 草稿.json";
    } else {
      const prd = parseJson<PrdGenerationOutput>(prior.prd_draft.body, "PRD 草稿");
      const approved = parseJson<{ evidence: EvidenceExtractionOutput["evidence_items"]; approvedThemes: ApprovedTheme[] }>(prior.approved_analysis.body, "已确认分析");
      const result = runPrdQualityStep({ prd, approvedThemeIds: approved.approvedThemes.map((item) => item.theme_id), evidenceIds: approved.evidence.map((item) => item.evidence_id) });
      output = { prd, quality: result.quality, markdown: result.markdown };
      receipt = result.receipt as unknown as JsonRecord; purpose = "prd_result"; name = `${prd.prd.title.replace(/[\\/:*?"<>|]/g, "-")}.md`;
      kind = "output"; mimeType = "text/markdown;charset=utf-8";
    }
    await ensureNotCancelled(workspace.workspaceId, runId, leaseToken);
    const outputDigest = await contentDigest(output);
    const body = purpose === "prd_result" ? String(asRecord(output).markdown || "") : JSON.stringify(output);
    const artifact = await commitArtifact({
      workspaceId: workspace.workspaceId, runId, runStepId: step.id, kind, name, mimeType, body,
      metadata: { purpose, outputDigest, stepKey, attempt: step.attempt, quality: purpose === "prd_result" ? asRecord(asRecord(output).quality).decision : undefined },
    });
    committedArtifactIds.push(artifact.artifactId);
    const qualityArtifact = purpose === "prd_result" ? await commitArtifact({
      workspaceId: workspace.workspaceId, runId, runStepId: step.id, kind: "receipt",
      name: "PRD 质量报告与可重算结果.json", mimeType: "application/json",
      body: JSON.stringify(output),
      metadata: { purpose: "quality_report", outputDigest, stepKey, attempt: step.attempt },
    }) : null;
    if (qualityArtifact) committedArtifactIds.push(qualityArtifact.artifactId);
    const modelRun = asRecord(receipt.modelRun);
    const usage = asRecord(modelRun.usage);
    const actualModelProvider = typeof modelRun.provider === "string" && modelRun.provider ? modelRun.provider : null;
    const actualModelId = typeof modelRun.model === "string" && modelRun.model ? modelRun.model : null;
    const modelSummary = actualModelProvider && actualModelId ? {
      modelProvider: sql<string>`case
        when ${runs.modelProvider} is null then ${actualModelProvider}
        when ${runs.modelProvider} = ${actualModelProvider} then ${runs.modelProvider}
        else 'mixed'
      end`,
      modelId: sql<string>`case
        when ${runs.modelId} is null then ${actualModelId}
        when ${runs.modelId} = ${actualModelId} then ${runs.modelId}
        else 'mixed'
      end`,
    } : {};
    const completedAt = new Date().toISOString();
    const qualityDecision = purpose === "prd_result" ? String(asRecord(asRecord(output).quality).decision || "blocked") : null;
    const nextStatus = purpose === "prd_result" ? (qualityDecision === "pass_with_notes" ? "succeeded" : "partial_failed") : "queued";
    const nextSequence = Math.min(7, run.currentSequence + 1);
    const stepStatus = qualityDecision && qualityDecision !== "pass_with_notes" ? "partial_failed" : "succeeded";
    const runLeaseHeld = sql`exists (select 1 from ${runs} where ${runs.id} = ${runId} and ${runs.workspaceId} = ${workspace.workspaceId} and ${runs.leaseToken} = ${leaseToken} and ${runs.status} = 'running')`;
    const stepCommitted = sql`exists (select 1 from ${runSteps} where ${runSteps.id} = ${step.id} and ${runSteps.leaseToken} = ${leaseToken} and ${runSteps.status} = ${stepStatus})`;
    const runCommitted = sql`exists (select 1 from ${runs} where ${runs.id} = ${runId} and ${runs.workspaceId} = ${workspace.workspaceId} and ${runs.status} = ${nextStatus} and ${runs.updatedAt} = ${completedAt} and ${runs.leaseToken} is null)`;
    const [updatedStep, updated, clearedStep] = await db.batch([
      db.update(runSteps).set({
        status: stepStatus,
        output: { artifactId: artifact.artifactId, qualityArtifactId: qualityArtifact?.artifactId || null, purpose }, outputDigest, receipt,
        completedAt, updatedAt: completedAt,
      }).where(and(eq(runSteps.id, step.id), eq(runSteps.leaseToken, leaseToken), runLeaseHeld))
        .returning({ id: runSteps.id }),
      db.update(runs).set({
      status: nextStatus,
      currentSequence: nextSequence,
      output: purpose === "prd_result" ? { artifactId: artifact.artifactId, qualityArtifactId: qualityArtifact?.artifactId || null, qualityDecision, outputDigest } : run.output,
      tokenInput: sql`${runs.tokenInput} + ${Number(usage.inputTokens || 0)}`,
      tokenOutput: sql`${runs.tokenOutput} + ${Number(usage.outputTokens || 0)}`,
      ...modelSummary,
      leaseToken: null, leaseExpiresAt: null, updatedAt: completedAt,
      completedAt: purpose === "prd_result" ? completedAt : null,
      stateVersion: sql`${runs.stateVersion} + 1`,
      }).where(and(
        eq(runs.id, runId), eq(runs.workspaceId, workspace.workspaceId),
        eq(runs.leaseToken, leaseToken), eq(runs.status, "running"), stepCommitted,
      )).returning({ id: runs.id }),
      db.update(runSteps).set({ leaseToken: null, leaseExpiresAt: null })
        .where(and(eq(runSteps.id, step.id), eq(runSteps.leaseToken, leaseToken), runCommitted))
        .returning({ id: runSteps.id }),
    ]);
    if (!updated.length || !updatedStep.length || !clearedStep.length) {
      for (const artifactId of committedArtifactIds) await discardArtifact(workspace.workspaceId, artifactId);
      committedArtifactIds = [];
      throw new GateDContractError("LEASE_LOST", "步骤结果没有取得提交权，已安全丢弃", 409);
    }
    durableCommitted = true;
    committedArtifactIds = [];
    if (purpose === "prd_result") {
      await releaseActiveRunQuota(runId).catch((error) => console.error("Gate D quota release failed", { name: error instanceof Error ? error.name : "UnknownError", code: "QUOTA_RELEASE_FAILED" }));
    }
    await appendAudit({ workspace, action: "run.step.completed", objectType: "run_step", objectId: step.id, runId, afterDigest: outputDigest, eventData: { stepKey, attempt: step.attempt, status: nextStatus } })
      .catch((error) => console.error("Gate D audit append failed", { name: error instanceof Error ? error.name : "UnknownError", code: "AUDIT_APPEND_FAILED" }));
    return loadRun(workspace.workspaceId, runId);
  } catch (error) {
    if (durableCommitted) throw error;
    for (const artifactId of committedArtifactIds) await discardArtifact(workspace.workspaceId, artifactId);
    const failure = safeRuntimeError(error);
    const failureReceipt = safeModelFailureReceipt(error);
    const failedUsage = knownFailureUsage(failureReceipt);
    const failedModel = knownFailureModel(failureReceipt);
    const failedModelProvider = failedModel.provider;
    const failedModelId = failedModel.model;
    const failedModelSummary = failedModelProvider && failedModelId ? {
      modelProvider: sql<string>`case
        when ${runs.modelProvider} is null then ${failedModelProvider}
        when ${runs.modelProvider} = ${failedModelProvider} then ${runs.modelProvider}
        else 'mixed'
      end`,
      modelId: sql<string>`case
        when ${runs.modelId} is null then ${failedModelId}
        when ${runs.modelId} = ${failedModelId} then ${runs.modelId}
        else 'mixed'
      end`,
    } : {};
    const failedAt = new Date().toISOString();
    const current = await currentRun(workspace.workspaceId, runId);
    if (current.status !== "cancelled") {
      const failureStatus = run.currentSequence > 0 ? "partial_failed" : "failed";
      const failureRunHeld = sql`exists (select 1 from ${runs} where ${runs.id} = ${runId} and ${runs.workspaceId} = ${workspace.workspaceId} and ${runs.leaseToken} = ${leaseToken} and ${runs.status} = 'running')`;
      const failureStepCommitted = sql`exists (select 1 from ${runSteps} where ${runSteps.id} = ${step.id} and ${runSteps.leaseToken} = ${leaseToken} and ${runSteps.status} = 'failed')`;
      await db.batch([
        db.update(runSteps).set({ status: "failed", error: failure, receipt: failureReceipt, completedAt: failedAt, updatedAt: failedAt })
          .where(and(eq(runSteps.id, step.id), eq(runSteps.leaseToken, leaseToken), failureRunHeld)),
        db.update(runs).set({
          status: failureStatus, error: failure,
          tokenInput: sql`${runs.tokenInput} + ${Number(failedUsage.inputTokens || 0)}`,
          tokenOutput: sql`${runs.tokenOutput} + ${Number(failedUsage.outputTokens || 0)}`,
          ...failedModelSummary,
          leaseToken: null, leaseExpiresAt: null, updatedAt: failedAt,
          stateVersion: sql`${runs.stateVersion} + 1`,
        }).where(and(
          eq(runs.id, runId), eq(runs.workspaceId, workspace.workspaceId),
          eq(runs.leaseToken, leaseToken), eq(runs.status, "running"), failureStepCommitted,
        )),
        db.update(runSteps).set({ leaseToken: null, leaseExpiresAt: null })
          .where(and(eq(runSteps.id, step.id), eq(runSteps.leaseToken, leaseToken))),
      ]);
      await appendAudit({ workspace, action: "run.step.failed", objectType: "run_step", objectId: step.id, runId, eventData: { stepKey, attempt: step.attempt, code: failure.code } })
        .catch((auditError) => console.error("Gate D audit append failed", { name: auditError instanceof Error ? auditError.name : "UnknownError", code: "AUDIT_APPEND_FAILED" }));
    }
    throw error;
  }
}

function inRunStates(values: Array<"queued" | "failed" | "partial_failed">) {
  return sql`${runs.status} in (${sql.join(values.map((value) => sql`${value}`), sql`, `)})`;
}

export async function cancelInterviewRun(workspace: GateDWorkspace, runId: string) {
  const db = getDb();
  await loadRun(workspace.workspaceId, runId);
  const cancelledAt = new Date().toISOString();
  const cancelledRun = sql`exists (select 1 from ${runs} where ${runs.id} = ${runId} and ${runs.workspaceId} = ${workspace.workspaceId} and ${runs.status} = 'cancelled' and ${runs.cancelRequestedAt} = ${cancelledAt})`;
  const [updated] = await db.batch([
    db.update(runs).set({
      status: "cancelled", cancelRequestedAt: cancelledAt, completedAt: cancelledAt,
      leaseToken: null, leaseExpiresAt: null, updatedAt: cancelledAt,
      stateVersion: sql`${runs.stateVersion} + 1`,
    }).where(and(
      eq(runs.id, runId), eq(runs.workspaceId, workspace.workspaceId),
      sql`${runs.status} not in ('succeeded', 'cancelled')`,
    )).returning({ id: runs.id }),
    db.update(runSteps).set({ status: "cancelled", completedAt: cancelledAt, updatedAt: cancelledAt, leaseToken: null, leaseExpiresAt: null })
      .where(and(eq(runSteps.runId, runId), sql`${runSteps.status} in ('queued', 'running', 'awaiting_approval')`, cancelledRun)),
    db.update(approvals).set({ status: "cancelled", decidedAt: cancelledAt, decisionReason: "运行已取消" })
      .where(and(eq(approvals.runId, runId), eq(approvals.workspaceId, workspace.workspaceId), eq(approvals.status, "pending"), cancelledRun)),
  ]);
  if (!updated.length) throw new GateDContractError("RUN_NOT_CANCELLABLE", "该运行已经结束", 409);
  await releaseActiveRunQuota(runId).catch((error) => console.error("Gate D quota release failed", { name: error instanceof Error ? error.name : "UnknownError", code: "QUOTA_RELEASE_FAILED" }));
  await appendAudit({ workspace, action: "run.cancelled", objectType: "run", objectId: runId, runId })
    .catch((error) => console.error("Gate D audit append failed", { name: error instanceof Error ? error.name : "UnknownError", code: "AUDIT_APPEND_FAILED" }));
  return loadRun(workspace.workspaceId, runId);
}
