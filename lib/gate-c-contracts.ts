import type { EvidenceLevel, RiskLevel } from "./contracts";
import type { GateBTaskContract } from "./gate-b-contracts";

export const GATE_C_SCHEMA_VERSION = "gate-c-v1" as const;

export type CompositionExecutionMode =
  | "human_only"
  | "deterministic"
  | "ai_assist"
  | "ai_draft_human_approve"
  | "ai_auto"
  | "connector_action";

export type BindingRole = "prepare" | "primary" | "review" | "fallback";
export type ReleaseSource = "skillflow_runtime" | "openagentskill" | "skillflow_creator";

export type PermissionRequirement = {
  capability: string;
  access: "read" | "create" | "write" | "delete" | "send" | "unknown";
  risk: "low" | "medium" | "high" | "unknown";
  reason: string;
};

export type ReleasePin = {
  source: ReleaseSource;
  sourceSkillKey: string;
  releaseId: string;
  slug: string;
  canonicalName: string;
  version: string | null;
  manifestDigest: string;
  sourceCommit: string | null;
  artifactDigest: string | null;
  pinKind: "immutable_runtime_release" | "immutable_source_release" | "manifest_snapshot";
  resolutionStatus: "resolved" | "snapshot_only";
  author: { name: string; url: string | null; verified: boolean | null };
  sourceUrl: string | null;
  license: { id: string | null; name: string | null; url: string | null };
  safety: { blocked: false; label: string; tier: string; humanReviewRequired: boolean };
  evidenceLevel: EvidenceLevel | "unknown";
  hostedExecution: "built_in" | "allowlisted" | "install_handoff_only";
  inputs: string[];
  outputs: string[];
  semanticHints: string[];
  limitations: string[];
  permissions: PermissionRequirement[];
  registrySignals: {
    quality: { value: number | null; label: string };
    trust: { value: number | null; label: string };
    safety: { value: number | null; label: string };
  };
};

export type CompatibilityAssessment = {
  fromBindingId: string;
  toBindingId: string;
  status: "compatible" | "adapter_required" | "unknown" | "incompatible";
  reason: string;
};

export type SkillFitAssessment = {
  verdict: "recommended" | "candidate" | "not_recommended" | "insufficient_evidence";
  structureFit: {
    task: "match" | "partial" | "mismatch" | "unknown";
    input: "match" | "partial" | "mismatch" | "unknown";
    output: "match" | "partial" | "mismatch" | "unknown";
    matchedTerms: string[];
    reasons: string[];
    evidencePaths: {
      dimension: "task" | "input" | "output";
      querySource: string;
      releaseSource: string;
      matchedTerms: string[];
    }[];
  };
  registrySignals: ReleasePin["registrySignals"];
  limitations: string[];
  unknowns: string[];
  source: "deterministic";
};

export type SkillBinding = {
  bindingId: string;
  order: number;
  role: BindingRole;
  release: ReleasePin;
  fitAssessment: SkillFitAssessment;
};

export type CompositionNode = {
  nodeId: string;
  label: string;
  purpose: string;
  sourceFactIds: string[];
  aiSuitability: "do_not_use_ai" | "ai_assist" | "ai_first_with_human_review" | "needs_analysis";
  riskLevel: RiskLevel;
  executionMode: CompositionExecutionMode | null;
  executionDecisionSource: "unresolved" | "gate_b_rule" | "recommendation" | "user_override";
  humanResponsibility: string;
  aiResponsibility: string;
  constraints: string[];
  compositionMode: "none" | "single" | "sequence";
  skillBindings: SkillBinding[];
  compatibility: CompatibilityAssessment[];
  aggregatePermissions: PermissionRequirement[];
  aggregateLimitations: string[];
  permissionSurfaceDigest: string;
  permissionReviewDigest: string | null;
  status:
    | "needs_execution_decision"
    | "needs_skill_selection"
    | "needs_compatibility_resolution"
    | "needs_permission_review"
    | "configured";
};

export type CompositionSource =
  | {
      kind: "gate_b_diagnosis";
      sourceDigest: string;
      taskContractDigest: string;
      abstractWorkflowDigest: string;
      title: string;
      taskContext: string;
      taskContextStatus: "confirmed";
      confirmedContractSnapshot: GateBTaskContract & { status: "confirmed" };
      boundaries: string[];
    }
  | {
      kind: "registry_single";
      sourceDigest: string;
      taskContractDigest: null;
      abstractWorkflowDigest: null;
      title: string;
      taskContext: string;
      taskContextStatus: "minimal_unconfirmed";
      confirmedContractSnapshot: null;
      boundaries: string[];
    };

export type CompositionValidation = {
  valid: boolean;
  errors: { code: string; nodeId: string | null; message: string }[];
  warnings: { code: string; nodeId: string | null; message: string }[];
};

export type SemanticChange = {
  kind:
    | "execution_mode_changed"
    | "constraints_changed"
    | "skill_bound"
    | "skill_unbound"
    | "skill_replaced"
    | "skill_reordered"
    | "permissions_reviewed"
    | "permission_surface_changed"
    | "node_readiness_changed";
  nodeId: string;
  path: string;
  before: unknown;
  after: unknown;
  reason: string;
};

export type SemanticDiff = {
  mutationId: string;
  actor: "user" | "ai_proposal_accepted";
  changes: SemanticChange[];
  summaryZh: string;
};

export type CompositionRevision = {
  schemaVersion: typeof GATE_C_SCHEMA_VERSION;
  revisionId: string;
  revisionNumber: number;
  parentRevisionId: string | null;
  parentDigest: string | null;
  source: CompositionSource;
  graphDigest: string;
  contentDigest: string;
  session: {
    sessionId: string;
    headSequence: number;
    headToken: string;
  };
  state: "composition_draft" | "needs_configuration" | "needs_permission_review" | "composition_ready";
  nodes: CompositionNode[];
  diffFromParent: SemanticDiff | null;
  appliedMutationIds: string[];
  validation: CompositionValidation;
  createdAt: string;
  persistence: "session_only";
  saved: false;
  runnable: false;
};

export type ReleaseSelector = {
  source: ReleaseSource;
  slug: string;
  releaseId?: string;
  expectedManifestDigest?: string;
};

export type CompositionMutation =
  | { type: "set_execution_mode"; nodeId: string; mode: CompositionExecutionMode; reason?: string }
  | { type: "clear_execution_mode"; nodeId: string; reason?: string }
  | { type: "set_constraints"; nodeId: string; constraints: string[]; reason?: string }
  | { type: "bind_release"; nodeId: string; selector: ReleaseSelector; role: BindingRole; order?: number; reason?: string }
  | { type: "unbind_release"; nodeId: string; bindingId: string; reason?: string }
  | { type: "replace_release"; nodeId: string; bindingId: string; selector: ReleaseSelector; role?: BindingRole; reason?: string }
  | { type: "reorder_releases"; nodeId: string; bindingIds: string[]; reason?: string }
  | { type: "acknowledge_permissions"; nodeId: string; permissionDigest: string; reason?: string };

export type CompositionRecommendation = {
  nodeId: string;
  status: "ready" | "no_match" | "partial_sources";
  primary: { release: ReleasePin; assessment: SkillFitAssessment } | null;
  alternatives: { release: ReleasePin; assessment: SkillFitAssessment }[];
  sourceStatus: {
    native: "ready";
    registry: "ready" | "unavailable";
    registryMessage: string | null;
  };
  notice: string;
};

export type NaturalLanguageProposal = {
  proposalId: string;
  baseRevisionDigest: string;
  instruction: string;
  operations: CompositionMutation[];
  unresolvedVariantRequirements: string[];
  previewDiff: SemanticDiff;
  applied: false;
};
