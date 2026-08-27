import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

type JsonObject = Record<string, unknown>;
type JsonValue = JsonObject | unknown[];

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const accounts = sqliteTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    primaryEmail: text("primary_email"),
    displayName: text("display_name").notNull().default(""),
    avatarUrl: text("avatar_url"),
    locale: text("locale").notNull().default("zh-CN"),
    status: text("status", { enum: ["active", "suspended", "deleted"] })
      .notNull()
      .default("active"),
    ...timestamps,
    deletedAt: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("accounts_primary_email_uq").on(table.primaryEmail),
    index("accounts_status_idx").on(table.status),
  ],
);

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    type: text("type", { enum: ["personal", "organization"] })
      .notNull()
      .default("personal"),
    name: text("name").notNull(),
    slug: text("slug"),
    status: text("status", { enum: ["active", "suspended", "deleted"] })
      .notNull()
      .default("active"),
    dataRegion: text("data_region").notNull().default("global"),
    crossBorderProcessingAllowed: integer("cross_border_processing_allowed", {
      mode: "boolean",
    })
      .notNull()
      .default(true),
    settings: text("settings", { mode: "json" }).$type<JsonObject>(),
    ...timestamps,
    deletedAt: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("workspaces_slug_uq").on(table.slug),
    index("workspaces_status_region_idx").on(table.status, table.dataRegion),
  ],
);

export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin", "member", "viewer"] })
      .notNull()
      .default("owner"),
    status: text("status", { enum: ["invited", "active", "suspended"] })
      .notNull()
      .default("active"),
    invitedByAccountId: text("invited_by_account_id").references(
      () => accounts.id,
      { onDelete: "set null" },
    ),
    joinedAt: text("joined_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("memberships_workspace_account_uq").on(
      table.workspaceId,
      table.accountId,
    ),
    index("memberships_account_status_idx").on(table.accountId, table.status),
    index("memberships_workspace_role_idx").on(table.workspaceId, table.role),
  ],
);

export const skills = sqliteTable(
  "skills",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    ownerWorkspaceId: text("owner_workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    createdByAccountId: text("created_by_account_id").references(
      () => accounts.id,
      { onDelete: "set null" },
    ),
    name: text("name").notNull(),
    summary: text("summary").notNull().default(""),
    sourceType: text("source_type", {
      enum: ["native", "open_source_import", "fork"],
    })
      .notNull()
      .default("native"),
    visibility: text("visibility", { enum: ["private", "unlisted", "public"] })
      .notNull()
      .default("private"),
    status: text("status", { enum: ["draft", "published", "blocked", "archived"] })
      .notNull()
      .default("draft"),
    defaultReleaseId: text("default_release_id"),
    tags: text("tags", { mode: "json" }).$type<string[]>(),
    ...timestamps,
    archivedAt: text("archived_at"),
  },
  (table) => [
    uniqueIndex("skills_slug_uq").on(table.slug),
    index("skills_owner_status_idx").on(table.ownerWorkspaceId, table.status),
    index("skills_visibility_status_idx").on(table.visibility, table.status),
    index("skills_source_type_idx").on(table.sourceType),
  ],
);

export const skillReleases = sqliteTable(
  "skill_releases",
  {
    id: text("id").primaryKey(),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    version: text("version").notNull(),
    status: text("status", {
      enum: ["draft", "in_review", "published", "yanked", "revoked"],
    })
      .notNull()
      .default("draft"),
    format: text("format", { enum: ["agent_skills", "skillflow_native"] })
      .notNull()
      .default("agent_skills"),
    sourceUrl: text("source_url"),
    sourceCommit: text("source_commit"),
    sourcePackageDigest: text("source_package_digest"),
    sourceSubmissionId: text("source_submission_id"),
    sourceSubmissionRevisionId: text("source_submission_revision_id"),
    sourceEvaluationDigest: text("source_evaluation_digest"),
    sourcePublishLeaseToken: text("source_publish_lease_token"),
    artifactStorageKey: text("artifact_storage_key"),
    artifactDigest: text("artifact_digest").notNull(),
    manifest: text("manifest", { mode: "json" }).$type<JsonObject>().notNull(),
    permissionManifest: text("permission_manifest", { mode: "json" })
      .$type<JsonObject>()
      .notNull(),
    compatibilityManifest: text("compatibility_manifest", { mode: "json" })
      .$type<JsonObject>()
      .notNull(),
    regionPolicy: text("region_policy", { mode: "json" })
      .$type<JsonObject>()
      .notNull(),
    licenseSpdx: text("license_spdx"),
    containsExecutableScripts: integer("contains_executable_scripts", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    hostedExecutionPolicy: text("hosted_execution_policy", {
      enum: ["deny", "built_in_only", "allowlisted"],
    })
      .notNull()
      .default("deny"),
    createdByAccountId: text("created_by_account_id").references(
      () => accounts.id,
      { onDelete: "set null" },
    ),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    publishedAt: text("published_at"),
    yankedAt: text("yanked_at"),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    uniqueIndex("skill_releases_skill_version_uq").on(table.skillId, table.version),
    uniqueIndex("skill_releases_skill_digest_uq").on(table.skillId, table.artifactDigest),
    uniqueIndex("skill_releases_source_submission_uq").on(table.sourceSubmissionId),
    index("skill_releases_skill_status_idx").on(table.skillId, table.status),
    index("skill_releases_status_published_idx").on(table.status, table.publishedAt),
    index("skill_releases_source_commit_idx").on(table.sourceUrl, table.sourceCommit),
  ],
);

export const workflows = sqliteTable(
  "workflows",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByAccountId: text("created_by_account_id").references(
      () => accounts.id,
      { onDelete: "set null" },
    ),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    sourceType: text("source_type", {
      enum: ["blank", "generated", "template", "imported"],
    })
      .notNull()
      .default("blank"),
    visibility: text("visibility", { enum: ["private", "unlisted", "public"] })
      .notNull()
      .default("private"),
    status: text("status", { enum: ["draft", "active", "archived"] })
      .notNull()
      .default("draft"),
    ...timestamps,
    archivedAt: text("archived_at"),
  },
  (table) => [
    index("workflows_workspace_status_idx").on(table.workspaceId, table.status),
    index("workflows_workspace_updated_idx").on(table.workspaceId, table.updatedAt),
    index("workflows_visibility_status_idx").on(table.visibility, table.status),
  ],
);

export const workflowVersions = sqliteTable(
  "workflow_versions",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    versionLabel: text("version_label"),
    status: text("status", { enum: ["draft", "active", "superseded", "archived"] })
      .notNull()
      .default("draft"),
    changeSummary: text("change_summary").notNull().default(""),
    inputSchema: text("input_schema", { mode: "json" }).$type<JsonObject>(),
    outputSchema: text("output_schema", { mode: "json" }).$type<JsonObject>(),
    graphDigest: text("graph_digest").notNull(),
    sourceSchemaVersion: text("source_schema_version").notNull().default("gate-c-v1"),
    sourceRevisionId: text("source_revision_id"),
    sourceContentDigest: text("source_content_digest"),
    sourceContractDigest: text("source_contract_digest"),
    compositionSnapshot: text("composition_snapshot", { mode: "json" })
      .$type<JsonObject>()
      .notNull()
      .default(sql`'{}'`),
    runtimeAdapterId: text("runtime_adapter_id"),
    runtimeAdapterVersion: text("runtime_adapter_version"),
    runtimePlanDigest: text("runtime_plan_digest"),
    runtimePlanSnapshot: text("runtime_plan_snapshot", { mode: "json" }).$type<JsonObject>(),
    validationSnapshot: text("validation_snapshot", { mode: "json" }).$type<JsonObject>(),
    parentWorkflowVersionId: text("parent_workflow_version_id"),
    createdByAccountId: text("created_by_account_id").references(
      () => accounts.id,
      { onDelete: "set null" },
    ),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    activatedAt: text("activated_at"),
  },
  (table) => [
    uniqueIndex("workflow_versions_workflow_revision_uq").on(
      table.workflowId,
      table.revision,
    ),
    uniqueIndex("workflow_versions_workflow_digest_uq").on(
      table.workflowId,
      table.graphDigest,
    ),
    index("workflow_versions_workflow_status_idx").on(table.workflowId, table.status),
  ],
);

export const workflowNodes = sqliteTable(
  "workflow_nodes",
  {
    id: text("id").primaryKey(),
    workflowVersionId: text("workflow_version_id")
      .notNull()
      .references(() => workflowVersions.id, { onDelete: "cascade" }),
    nodeKey: text("node_key").notNull(),
    kind: text("kind", {
      enum: [
        "skill",
        "model",
        "document_parse",
        "transform",
        "connector_read",
        "connector_write",
        "validation",
        "human_review",
        "human_decision",
        "artifact_generate",
      ],
    }).notNull(),
    name: text("name").notNull(),
    skillReleaseId: text("skill_release_id").references(() => skillReleases.id, {
      onDelete: "restrict",
    }),
    capability: text("capability"),
    config: text("config", { mode: "json" }).$type<JsonObject>().notNull(),
    inputSchema: text("input_schema", { mode: "json" }).$type<JsonObject>(),
    outputSchema: text("output_schema", { mode: "json" }).$type<JsonObject>(),
    positionX: integer("position_x").notNull().default(0),
    positionY: integer("position_y").notNull().default(0),
    ordinal: integer("ordinal").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("workflow_nodes_version_key_uq").on(
      table.workflowVersionId,
      table.nodeKey,
    ),
    index("workflow_nodes_version_ordinal_idx").on(
      table.workflowVersionId,
      table.ordinal,
    ),
    index("workflow_nodes_skill_release_idx").on(table.skillReleaseId),
    index("workflow_nodes_capability_idx").on(table.capability),
  ],
);

export const workflowEdges = sqliteTable(
  "workflow_edges",
  {
    id: text("id").primaryKey(),
    workflowVersionId: text("workflow_version_id")
      .notNull()
      .references(() => workflowVersions.id, { onDelete: "cascade" }),
    sourceNodeId: text("source_node_id")
      .notNull()
      .references(() => workflowNodes.id, { onDelete: "cascade" }),
    targetNodeId: text("target_node_id")
      .notNull()
      .references(() => workflowNodes.id, { onDelete: "cascade" }),
    sourceHandle: text("source_handle").notNull().default("default"),
    targetHandle: text("target_handle").notNull().default("default"),
    condition: text("condition", { mode: "json" }).$type<JsonObject>(),
    ordinal: integer("ordinal").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("workflow_edges_version_path_uq").on(
      table.workflowVersionId,
      table.sourceNodeId,
      table.targetNodeId,
      table.sourceHandle,
      table.targetHandle,
    ),
    index("workflow_edges_source_idx").on(table.workflowVersionId, table.sourceNodeId),
    index("workflow_edges_target_idx").on(table.workflowVersionId, table.targetNodeId),
  ],
);

export const personalConfigurations = sqliteTable(
  "personal_configurations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    skillReleaseId: text("skill_release_id")
      .notNull()
      .references(() => skillReleases.id, { onDelete: "restrict" }),
    createdByAccountId: text("created_by_account_id").references(
      () => accounts.id,
      { onDelete: "set null" },
    ),
    name: text("name").notNull(),
    revision: integer("revision").notNull().default(1),
    parameters: text("parameters", { mode: "json" }).$type<JsonObject>().notNull(),
    configDigest: text("config_digest").notNull(),
    status: text("status", { enum: ["active", "archived"] })
      .notNull()
      .default("active"),
    ...timestamps,
    archivedAt: text("archived_at"),
  },
  (table) => [
    uniqueIndex("personal_configs_workspace_digest_uq").on(
      table.workspaceId,
      table.configDigest,
    ),
    index("personal_configs_workspace_status_idx").on(table.workspaceId, table.status),
    index("personal_configs_release_idx").on(table.skillReleaseId),
  ],
);

export const skillForks = sqliteTable(
  "skill_forks",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    sourceSkillId: text("source_skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "restrict" }),
    sourceReleaseId: text("source_release_id")
      .notNull()
      .references(() => skillReleases.id, { onDelete: "restrict" }),
    forkedSkillId: text("forked_skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    forkedReleaseId: text("forked_release_id").references(() => skillReleases.id, {
      onDelete: "set null",
    }),
    createdByAccountId: text("created_by_account_id").references(
      () => accounts.id,
      { onDelete: "set null" },
    ),
    reason: text("reason").notNull().default(""),
    structuredDiff: text("structured_diff", { mode: "json" })
      .$type<JsonValue>()
      .notNull(),
    status: text("status", { enum: ["draft", "tested", "published", "archived"] })
      .notNull()
      .default("draft"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("skill_forks_forked_skill_uq").on(table.forkedSkillId),
    index("skill_forks_source_release_idx").on(table.sourceReleaseId),
    index("skill_forks_workspace_status_idx").on(table.workspaceId, table.status),
  ],
);

export const creatorSubmissions = sqliteTable(
  "creator_submissions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdByAccountId: text("created_by_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    publisherDisplayName: text("publisher_display_name"),
    inputKind: text("input_kind", {
      enum: ["skill_text", "natural_language", "registry_fork"],
    }).notNull(),
    status: text("status", {
      enum: [
        "storage_pending",
        "draft",
        "review_ready",
        "publishing",
        "published",
        "rejected",
        "archived",
        "storage_failed",
      ],
    })
      .notNull()
      .default("storage_pending"),
    revision: integer("revision").notNull().default(1),
    currentRevisionId: text("current_revision_id").notNull(),
    stateVersion: integer("state_version").notNull().default(0),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    briefZh: text("brief_zh").notNull().default(""),
    description: text("description").notNull().default(""),
    instructions: text("instructions").notNull().default(""),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull(),
    inputs: text("inputs", { mode: "json" }).$type<string[]>().notNull(),
    outputs: text("outputs", { mode: "json" }).$type<string[]>().notNull(),
    permissions: text("permissions", { mode: "json" }).$type<JsonValue>().notNull(),
    limitations: text("limitations", { mode: "json" }).$type<string[]>().notNull(),
    sourceUrl: text("source_url"),
    sourceCommit: text("source_commit"),
    sourceRegistry: text("source_registry", {
      enum: ["openagentskill", "skillflow_creator"],
    }),
    sourceReleaseDigest: text("source_release_digest"),
    sourceReleaseSnapshot: text("source_release_snapshot", { mode: "json" }).$type<JsonObject>(),
    sourceStorageKey: text("source_storage_key").notNull(),
    sourceMimeType: text("source_mime_type").notNull().default("text/markdown; charset=utf-8"),
    sourceStorageStatus: text("source_storage_status", {
      enum: ["pending", "ready", "failed"],
    })
      .notNull()
      .default("pending"),
    sourceDigest: text("source_digest").notNull(),
    sourceByteSize: integer("source_byte_size").notNull(),
    parserVersion: text("parser_version").notNull(),
    requestDigest: text("request_digest").notNull(),
    licenseSpdx: text("license_spdx"),
    licenseEvidence: text("license_evidence", { mode: "json" }).$type<JsonObject>(),
    riskSnapshot: text("risk_snapshot", { mode: "json" }).$type<JsonObject>(),
    containsExecutableScripts: integer("contains_executable_scripts", { mode: "boolean" })
      .notNull()
      .default(false),
    hostedExecutionPolicy: text("hosted_execution_policy", {
      enum: ["deny", "built_in_only", "allowlisted"],
    })
      .notNull()
      .default("deny"),
    canonicalDraft: text("canonical_draft", { mode: "json" }).$type<JsonObject>().notNull(),
    contentDigest: text("content_digest").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    publishIdempotencyKey: text("publish_idempotency_key"),
    publishRequestDigest: text("publish_request_digest"),
    publishLeaseToken: text("publish_lease_token"),
    publishLeaseExpiresAt: text("publish_lease_expires_at"),
    targetSkillId: text("target_skill_id").references(() => skills.id, { onDelete: "restrict" }),
    baseReleaseId: text("base_release_id").references(() => skillReleases.id, { onDelete: "restrict" }),
    publishedSkillId: text("published_skill_id").references(() => skills.id, { onDelete: "set null" }),
    publishedReleaseId: text("published_release_id").references(() => skillReleases.id, { onDelete: "set null" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    publishedAt: text("published_at"),
    archivedAt: text("archived_at"),
  },
  (table) => [
    uniqueIndex("creator_submissions_workspace_idempotency_uq").on(table.workspaceId, table.idempotencyKey),
    uniqueIndex("creator_submissions_published_release_uq").on(table.publishedReleaseId),
    index("creator_submissions_workspace_status_updated_idx").on(table.workspaceId, table.status, table.updatedAt),
    index("creator_submissions_workspace_slug_idx").on(table.workspaceId, table.slug),
    index("creator_submissions_target_status_idx").on(table.targetSkillId, table.status),
    index("creator_submissions_source_digest_idx").on(table.sourceDigest),
  ],
);

export const creatorSubmissionRevisions = sqliteTable(
  "creator_submission_revisions",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    submissionId: text("submission_id")
      .notNull()
      .references(() => creatorSubmissions.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    parentRevisionId: text("parent_revision_id"),
    mutationKind: text("mutation_kind", {
      enum: ["imported", "ai_generated", "registry_fork", "manual_edit", "ai_diff"],
    }).notNull(),
    sourceDigest: text("source_digest").notNull(),
    snapshot: text("snapshot", { mode: "json" }).$type<JsonObject>().notNull(),
    contentDigest: text("content_digest").notNull(),
    structuredDiff: text("structured_diff", { mode: "json" }).$type<JsonValue>().notNull(),
    createdByAccountId: text("created_by_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("creator_submission_revisions_number_uq").on(table.submissionId, table.revision),
    uniqueIndex("creator_submission_revisions_digest_uq").on(table.submissionId, table.contentDigest),
    index("creator_submission_revisions_workspace_created_idx").on(table.workspaceId, table.createdAt),
  ],
);

export const creatorEvaluations = sqliteTable(
  "creator_evaluations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    submissionId: text("submission_id")
      .notNull()
      .references(() => creatorSubmissions.id, { onDelete: "cascade" }),
    submissionRevisionId: text("submission_revision_id")
      .notNull()
      .references(() => creatorSubmissionRevisions.id, { onDelete: "restrict" }),
    contentDigest: text("content_digest").notNull(),
    level: text("level", { enum: ["e1", "e2"] }).notNull(),
    evaluationKey: text("evaluation_key").notNull(),
    requestDigest: text("request_digest").notNull(),
    resultDigest: text("result_digest"),
    status: text("status", {
      enum: ["running", "passed", "failed", "blocked", "cancelled"],
    })
      .notNull()
      .default("running"),
    policyVersion: text("policy_version").notNull(),
    inputSnapshot: text("input_snapshot", { mode: "json" }).$type<JsonObject>().notNull(),
    result: text("result", { mode: "json" }).$type<JsonObject>(),
    modelReceipt: text("model_receipt", { mode: "json" }).$type<JsonObject>(),
    createdByAccountId: text("created_by_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("creator_evaluations_submission_level_key_uq").on(
      table.submissionId,
      table.level,
      table.evaluationKey,
    ),
    index("creator_evaluations_workspace_created_idx").on(table.workspaceId, table.createdAt),
    index("creator_evaluations_submission_revision_idx").on(
      table.submissionId,
      table.submissionRevisionId,
    ),
  ],
);

export const creatorClaims = sqliteTable(
  "creator_claims",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    requestedByAccountId: text("requested_by_account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    skillId: text("skill_id").references(() => skills.id, { onDelete: "set null" }),
    submissionId: text("submission_id").references(() => creatorSubmissions.id, { onDelete: "set null" }),
    sourceUrl: text("source_url").notNull(),
    claimType: text("claim_type", {
      enum: ["upstream_author", "repository_owner", "license_holder"],
    }).notNull(),
    evidenceType: text("evidence_type", {
      enum: ["repository", "domain", "maintainer_note"],
    }).notNull(),
    subjectName: text("subject_name").notNull().default(""),
    evidence: text("evidence", { mode: "json" }).$type<JsonObject>().notNull(),
    evidenceDigest: text("evidence_digest").notNull(),
    status: text("status", {
      enum: ["pending", "verified", "rejected", "withdrawn"],
    })
      .notNull()
      .default("pending"),
    reviewedByAccountId: text("reviewed_by_account_id").references(() => accounts.id, { onDelete: "set null" }),
    reviewReason: text("review_reason"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    reviewedAt: text("reviewed_at"),
  },
  (table) => [
    uniqueIndex("creator_claims_workspace_source_uq").on(table.workspaceId, table.sourceUrl),
    index("creator_claims_workspace_status_idx").on(table.workspaceId, table.status),
    index("creator_claims_source_status_idx").on(table.sourceUrl, table.status),
  ],
);

export const connections = sqliteTable(
  "connections",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    provider: text("provider", { enum: ["feishu_cn", "jira_cloud", "custom"] })
      .notNull(),
    providerAccountId: text("provider_account_id"),
    displayName: text("display_name").notNull(),
    status: text("status", {
      enum: ["pending", "active", "expired", "error", "revoked"],
    })
      .notNull()
      .default("pending"),
    authScheme: text("auth_scheme", {
      enum: ["oauth2", "api_token", "service_account"],
    }).notNull(),
    secretRef: text("secret_ref").notNull(),
    grantedScopes: text("granted_scopes", { mode: "json" })
      .$type<string[]>()
      .notNull(),
    selectedResources: text("selected_resources", { mode: "json" })
      .$type<JsonValue>()
      .notNull(),
    dataRegion: text("data_region").notNull().default("global"),
    metadata: text("metadata", { mode: "json" }).$type<JsonObject>(),
    tokenExpiresAt: text("token_expires_at"),
    lastUsedAt: text("last_used_at"),
    ...timestamps,
    revokedAt: text("revoked_at"),
  },
  (table) => [
    index("connections_workspace_provider_idx").on(table.workspaceId, table.provider),
    index("connections_workspace_status_idx").on(table.workspaceId, table.status),
    index("connections_account_status_idx").on(table.accountId, table.status),
    index("connections_token_expiry_idx").on(table.status, table.tokenExpiresAt),
  ],
);

export const capabilityGrants = sqliteTable(
  "capability_grants",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    connectionId: text("connection_id")
      .notNull()
      .references(() => connections.id, { onDelete: "cascade" }),
    capability: text("capability").notNull(),
    effect: text("effect", { enum: ["read", "create", "update", "delete", "send"] })
      .notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    approvalPolicy: text("approval_policy", {
      enum: ["never", "first_use", "always"],
    })
      .notNull()
      .default("always"),
    constraints: text("constraints", { mode: "json" }).$type<JsonObject>(),
    status: text("status", { enum: ["active", "expired", "revoked"] })
      .notNull()
      .default("active"),
    grantedByAccountId: text("granted_by_account_id").references(
      () => accounts.id,
      { onDelete: "set null" },
    ),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    expiresAt: text("expires_at"),
    revokedAt: text("revoked_at"),
  },
  (table) => [
    uniqueIndex("capability_grants_connection_scope_uq").on(
      table.connectionId,
      table.capability,
      table.effect,
      table.resourceType,
      table.resourceId,
    ),
    index("capability_grants_workspace_status_idx").on(table.workspaceId, table.status),
    index("capability_grants_connection_status_idx").on(table.connectionId, table.status),
    index("capability_grants_capability_idx").on(table.capability, table.effect),
  ],
);

export const runs = sqliteTable(
  "runs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    initiatedByAccountId: text("initiated_by_account_id").references(
      () => accounts.id,
      { onDelete: "set null" },
    ),
    workflowVersionId: text("workflow_version_id").references(
      () => workflowVersions.id,
      { onDelete: "restrict" },
    ),
    skillReleaseId: text("skill_release_id").references(() => skillReleases.id, {
      onDelete: "restrict",
    }),
    personalConfigurationId: text("personal_configuration_id").references(
      () => personalConfigurations.id,
      { onDelete: "set null" },
    ),
    kind: text("kind", { enum: ["official_sample", "private"] })
      .notNull()
      .default("private"),
    status: text("status", {
      enum: [
        "queued",
        "provisioning",
        "running",
        "awaiting_approval",
        "succeeded",
        "partial_failed",
        "failed",
        "cancelled",
        "blocked",
      ],
    })
      .notNull()
      .default("queued"),
    idempotencyKey: text("idempotency_key"),
    requestDigest: text("request_digest"),
    input: text("input", { mode: "json" }).$type<JsonValue>().notNull(),
    output: text("output", { mode: "json" }).$type<JsonValue>(),
    error: text("error", { mode: "json" }).$type<JsonObject>(),
    runtimePolicy: text("runtime_policy", { mode: "json" })
      .$type<JsonObject>()
      .notNull(),
    preflightSnapshot: text("preflight_snapshot", { mode: "json" }).$type<JsonObject>(),
    preflightDigest: text("preflight_digest"),
    runtimeAdapterId: text("runtime_adapter_id"),
    runtimeAdapterVersion: text("runtime_adapter_version"),
    runtimePlanDigest: text("runtime_plan_digest"),
    inputArtifactId: text("input_artifact_id"),
    currentSequence: integer("current_sequence").notNull().default(0),
    stateVersion: integer("state_version").notNull().default(0),
    leaseToken: text("lease_token"),
    leaseExpiresAt: text("lease_expires_at"),
    cancelRequestedAt: text("cancel_requested_at"),
    modelProvider: text("model_provider"),
    modelId: text("model_id"),
    executionRegion: text("execution_region").notNull().default("global"),
    crossBorderProcessingUsed: integer("cross_border_processing_used", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    tokenInput: integer("token_input").notNull().default(0),
    tokenOutput: integer("token_output").notNull().default(0),
    costMicros: integer("cost_micros").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
  },
  (table) => [
    uniqueIndex("runs_workspace_idempotency_uq").on(
      table.workspaceId,
      table.idempotencyKey,
    ),
    index("runs_workspace_status_created_idx").on(
      table.workspaceId,
      table.status,
      table.createdAt,
    ),
    index("runs_workflow_version_idx").on(table.workflowVersionId),
    index("runs_skill_release_idx").on(table.skillReleaseId),
    index("runs_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const runQuotaClaims = sqliteTable(
  "run_quota_claims",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
    runId: text("run_id").notNull(),
    scope: text("scope", { enum: ["active", "hour"] }).notNull(),
    bucket: text("bucket").notNull(),
    slot: integer("slot").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [
    uniqueIndex("run_quota_scope_bucket_slot_uq").on(table.workspaceId, table.scope, table.bucket, table.slot),
    uniqueIndex("run_quota_run_scope_uq").on(table.runId, table.scope),
    index("run_quota_expiry_idx").on(table.expiresAt),
  ],
);

export const runSteps = sqliteTable(
  "run_steps",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    workflowNodeId: text("workflow_node_id").references(() => workflowNodes.id, {
      onDelete: "set null",
    }),
    stepKey: text("step_key").notNull(),
    sequence: integer("sequence").notNull(),
    attempt: integer("attempt").notNull().default(1),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    status: text("status", {
      enum: [
        "queued",
        "running",
        "awaiting_approval",
        "succeeded",
        "partial_failed",
        "failed",
        "skipped",
        "cancelled",
        "blocked",
      ],
    })
      .notNull()
      .default("queued"),
    input: text("input", { mode: "json" }).$type<JsonValue>(),
    output: text("output", { mode: "json" }).$type<JsonValue>(),
    error: text("error", { mode: "json" }).$type<JsonObject>(),
    skillPinSnapshot: text("skill_pin_snapshot", { mode: "json" }).$type<JsonObject>(),
    skillManifestDigest: text("skill_manifest_digest"),
    inputDigest: text("input_digest"),
    outputDigest: text("output_digest"),
    receipt: text("receipt", { mode: "json" }).$type<JsonObject>(),
    leaseToken: text("lease_token"),
    leaseExpiresAt: text("lease_expires_at"),
    capability: text("capability"),
    connectionId: text("connection_id").references(() => connections.id, {
      onDelete: "set null",
    }),
    requiresApproval: integer("requires_approval", { mode: "boolean" })
      .notNull()
      .default(false),
    sideEffect: text("side_effect", {
      enum: ["none", "read", "create", "update", "delete", "send"],
    })
      .notNull()
      .default("none"),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("run_steps_run_sequence_attempt_uq").on(
      table.runId,
      table.sequence,
      table.attempt,
    ),
    uniqueIndex("run_steps_run_key_attempt_uq").on(
      table.runId,
      table.stepKey,
      table.attempt,
    ),
    index("run_steps_run_status_idx").on(table.runId, table.status),
    index("run_steps_connection_idx").on(table.connectionId),
    index("run_steps_capability_idx").on(table.capability),
  ],
);

export const artifacts = sqliteTable(
  "artifacts",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => runs.id, { onDelete: "set null" }),
    runStepId: text("run_step_id").references(() => runSteps.id, {
      onDelete: "set null",
    }),
    kind: text("kind", { enum: ["input", "intermediate", "output", "receipt"] })
      .notNull(),
    status: text("status", { enum: ["pending", "ready", "failed", "deleted"] })
      .notNull()
      .default("pending"),
    name: text("name").notNull(),
    mimeType: text("mime_type").notNull(),
    storageKey: text("storage_key").notNull(),
    byteSize: integer("byte_size").notNull(),
    contentDigest: text("content_digest").notNull(),
    dataRegion: text("data_region").notNull().default("global"),
    metadata: text("metadata", { mode: "json" }).$type<JsonObject>(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    expiresAt: text("expires_at"),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("artifacts_workspace_storage_key_uq").on(
      table.workspaceId,
      table.storageKey,
    ),
    index("artifacts_run_kind_idx").on(table.runId, table.kind),
    index("artifacts_workspace_created_idx").on(table.workspaceId, table.createdAt),
    index("artifacts_expiry_idx").on(table.deletedAt, table.expiresAt),
  ],
);

export const approvals = sqliteTable(
  "approvals",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    runStepId: text("run_step_id").references(() => runSteps.id, {
      onDelete: "cascade",
    }),
    actionType: text("action_type").notNull(),
    actionPayload: text("action_payload", { mode: "json" })
      .$type<JsonObject>()
      .notNull(),
    revision: integer("revision").notNull().default(1),
    upstreamOutputDigest: text("upstream_output_digest").notNull().default(""),
    payloadDigest: text("payload_digest").notNull().default(""),
    decisionPayload: text("decision_payload", { mode: "json" }).$type<JsonObject>(),
    decisionToken: text("decision_token"),
    supersedesApprovalId: text("supersedes_approval_id"),
    riskLevel: text("risk_level", { enum: ["low", "medium", "high", "critical"] })
      .notNull()
      .default("medium"),
    status: text("status", {
      enum: ["pending", "approved", "denied", "expired", "cancelled"],
    })
      .notNull()
      .default("pending"),
    requestedByType: text("requested_by_type", { enum: ["system", "agent", "user"] })
      .notNull()
      .default("agent"),
    requestedById: text("requested_by_id"),
    decidedByAccountId: text("decided_by_account_id").references(
      () => accounts.id,
      { onDelete: "set null" },
    ),
    decisionReason: text("decision_reason"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    expiresAt: text("expires_at"),
    decidedAt: text("decided_at"),
  },
  (table) => [
    uniqueIndex("approvals_run_action_revision_uq").on(
      table.runId,
      table.actionType,
      table.revision,
    ),
    index("approvals_workspace_status_idx").on(table.workspaceId, table.status),
    index("approvals_run_status_idx").on(table.runId, table.status),
    index("approvals_pending_expiry_idx").on(table.status, table.expiresAt),
  ],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    actorType: text("actor_type", {
      enum: ["system", "account", "agent", "connector", "worker"],
    }).notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    objectType: text("object_type").notNull(),
    objectId: text("object_id").notNull(),
    runId: text("run_id").references(() => runs.id, { onDelete: "set null" }),
    policyVersion: text("policy_version"),
    beforeDigest: text("before_digest"),
    afterDigest: text("after_digest"),
    dataRegion: text("data_region").notNull().default("global"),
    eventData: text("event_data", { mode: "json" }).$type<JsonObject>(),
    requestId: text("request_id"),
    ipHash: text("ip_hash"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("audit_events_workspace_created_idx").on(table.workspaceId, table.createdAt),
    index("audit_events_object_created_idx").on(
      table.objectType,
      table.objectId,
      table.createdAt,
    ),
    index("audit_events_run_created_idx").on(table.runId, table.createdAt),
    index("audit_events_action_created_idx").on(table.action, table.createdAt),
    index("audit_events_request_idx").on(table.requestId),
  ],
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type Membership = typeof memberships.$inferSelect;
export type Skill = typeof skills.$inferSelect;
export type SkillRelease = typeof skillReleases.$inferSelect;
export type Workflow = typeof workflows.$inferSelect;
export type WorkflowVersion = typeof workflowVersions.$inferSelect;
export type WorkflowNode = typeof workflowNodes.$inferSelect;
export type WorkflowEdge = typeof workflowEdges.$inferSelect;
export type PersonalConfiguration = typeof personalConfigurations.$inferSelect;
export type SkillFork = typeof skillForks.$inferSelect;
export type CreatorSubmission = typeof creatorSubmissions.$inferSelect;
export type CreatorSubmissionRevision = typeof creatorSubmissionRevisions.$inferSelect;
export type CreatorEvaluation = typeof creatorEvaluations.$inferSelect;
export type CreatorClaim = typeof creatorClaims.$inferSelect;
export type Connection = typeof connections.$inferSelect;
export type CapabilityGrant = typeof capabilityGrants.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type RunStep = typeof runSteps.$inferSelect;
export type Artifact = typeof artifacts.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
