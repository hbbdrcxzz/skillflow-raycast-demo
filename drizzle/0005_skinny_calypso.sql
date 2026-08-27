CREATE TABLE `creator_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`requested_by_account_id` text NOT NULL,
	`skill_id` text,
	`submission_id` text,
	`source_url` text NOT NULL,
	`claim_type` text NOT NULL,
	`evidence_type` text NOT NULL,
	`subject_name` text DEFAULT '' NOT NULL,
	`evidence` text NOT NULL,
	`evidence_digest` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by_account_id` text,
	`review_reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requested_by_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`submission_id`) REFERENCES `creator_submissions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reviewed_by_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creator_claims_workspace_source_uq` ON `creator_claims` (`workspace_id`,`source_url`);--> statement-breakpoint
CREATE INDEX `creator_claims_workspace_status_idx` ON `creator_claims` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `creator_claims_source_status_idx` ON `creator_claims` (`source_url`,`status`);--> statement-breakpoint
CREATE TABLE `creator_evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`submission_id` text NOT NULL,
	`submission_revision_id` text NOT NULL,
	`content_digest` text NOT NULL,
	`level` text NOT NULL,
	`evaluation_key` text NOT NULL,
	`request_digest` text NOT NULL,
	`result_digest` text,
	`status` text DEFAULT 'running' NOT NULL,
	`policy_version` text NOT NULL,
	`input_snapshot` text NOT NULL,
	`result` text,
	`model_receipt` text,
	`created_by_account_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submission_id`) REFERENCES `creator_submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submission_revision_id`) REFERENCES `creator_submission_revisions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creator_evaluations_submission_level_key_uq` ON `creator_evaluations` (`submission_id`,`level`,`evaluation_key`);--> statement-breakpoint
CREATE INDEX `creator_evaluations_workspace_created_idx` ON `creator_evaluations` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `creator_evaluations_submission_revision_idx` ON `creator_evaluations` (`submission_id`,`submission_revision_id`);--> statement-breakpoint
CREATE TABLE `creator_submission_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`submission_id` text NOT NULL,
	`revision` integer NOT NULL,
	`parent_revision_id` text,
	`mutation_kind` text NOT NULL,
	`source_digest` text NOT NULL,
	`snapshot` text NOT NULL,
	`content_digest` text NOT NULL,
	`structured_diff` text NOT NULL,
	`created_by_account_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submission_id`) REFERENCES `creator_submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creator_submission_revisions_number_uq` ON `creator_submission_revisions` (`submission_id`,`revision`);--> statement-breakpoint
CREATE UNIQUE INDEX `creator_submission_revisions_digest_uq` ON `creator_submission_revisions` (`submission_id`,`content_digest`);--> statement-breakpoint
CREATE INDEX `creator_submission_revisions_workspace_created_idx` ON `creator_submission_revisions` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `creator_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`created_by_account_id` text NOT NULL,
	`publisher_display_name` text,
	`input_kind` text NOT NULL,
	`status` text DEFAULT 'storage_pending' NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`current_revision_id` text NOT NULL,
	`state_version` integer DEFAULT 0 NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`brief_zh` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`tags` text NOT NULL,
	`inputs` text NOT NULL,
	`outputs` text NOT NULL,
	`permissions` text NOT NULL,
	`limitations` text NOT NULL,
	`source_url` text,
	`source_commit` text,
	`source_registry` text,
	`source_release_digest` text,
	`source_release_snapshot` text,
	`source_storage_key` text NOT NULL,
	`source_mime_type` text DEFAULT 'text/markdown; charset=utf-8' NOT NULL,
	`source_storage_status` text DEFAULT 'pending' NOT NULL,
	`source_digest` text NOT NULL,
	`source_byte_size` integer NOT NULL,
	`parser_version` text NOT NULL,
	`request_digest` text NOT NULL,
	`license_spdx` text,
	`license_evidence` text,
	`risk_snapshot` text,
	`contains_executable_scripts` integer DEFAULT false NOT NULL,
	`hosted_execution_policy` text DEFAULT 'deny' NOT NULL,
	`canonical_draft` text NOT NULL,
	`content_digest` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`publish_idempotency_key` text,
	`publish_request_digest` text,
	`publish_lease_token` text,
	`publish_lease_expires_at` text,
	`target_skill_id` text,
	`base_release_id` text,
	`published_skill_id` text,
	`published_release_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`published_at` text,
	`archived_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`target_skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`base_release_id`) REFERENCES `skill_releases`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`published_skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`published_release_id`) REFERENCES `skill_releases`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creator_submissions_workspace_idempotency_uq` ON `creator_submissions` (`workspace_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `creator_submissions_published_release_uq` ON `creator_submissions` (`published_release_id`);--> statement-breakpoint
CREATE INDEX `creator_submissions_workspace_status_updated_idx` ON `creator_submissions` (`workspace_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `creator_submissions_workspace_slug_idx` ON `creator_submissions` (`workspace_id`,`slug`);--> statement-breakpoint
CREATE INDEX `creator_submissions_target_status_idx` ON `creator_submissions` (`target_skill_id`,`status`);--> statement-breakpoint
CREATE INDEX `creator_submissions_source_digest_idx` ON `creator_submissions` (`source_digest`);--> statement-breakpoint
DROP INDEX `skill_releases_digest_uq`;--> statement-breakpoint
ALTER TABLE `skill_releases` ADD `source_submission_id` text;--> statement-breakpoint
ALTER TABLE `skill_releases` ADD `source_submission_revision_id` text;--> statement-breakpoint
ALTER TABLE `skill_releases` ADD `source_evaluation_digest` text;--> statement-breakpoint
ALTER TABLE `skill_releases` ADD `source_publish_lease_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `skill_releases_skill_digest_uq` ON `skill_releases` (`skill_id`,`artifact_digest`);--> statement-breakpoint
CREATE UNIQUE INDEX `skill_releases_source_submission_uq` ON `skill_releases` (`source_submission_id`);--> statement-breakpoint
CREATE TRIGGER `skill_releases_immutable_material_update`
BEFORE UPDATE OF `skill_id`, `version`, `format`, `source_url`, `source_commit`, `source_package_digest`, `source_submission_id`, `source_submission_revision_id`, `source_evaluation_digest`, `source_publish_lease_token`, `artifact_storage_key`, `artifact_digest`, `manifest`, `permission_manifest`, `compatibility_manifest`, `region_policy`, `license_spdx`, `contains_executable_scripts`, `hosted_execution_policy`, `created_by_account_id`, `created_at`, `published_at`
ON `skill_releases`
WHEN OLD.`published_at` IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'published skill release material is immutable');
END;--> statement-breakpoint
CREATE TRIGGER `skill_releases_lifecycle_transition`
BEFORE UPDATE OF `status` ON `skill_releases`
WHEN OLD.`published_at` IS NOT NULL AND NOT (
	NEW.`status` = OLD.`status`
	OR (OLD.`status` = 'published' AND NEW.`status` IN ('yanked', 'revoked'))
	OR (OLD.`status` = 'yanked' AND NEW.`status` = 'revoked')
)
BEGIN
	SELECT RAISE(ABORT, 'published skill release status transition is invalid');
END;--> statement-breakpoint
CREATE TRIGGER `skill_releases_immutable_delete`
BEFORE DELETE ON `skill_releases`
WHEN OLD.`published_at` IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'published skill release cannot be deleted');
END;--> statement-breakpoint
CREATE TRIGGER `skill_releases_creator_publish_fence`
BEFORE INSERT ON `skill_releases`
WHEN NEW.`source_submission_id` IS NOT NULL AND NOT EXISTS (
	SELECT 1 FROM `creator_submissions`
	WHERE `id` = NEW.`source_submission_id`
	AND `current_revision_id` = NEW.`source_submission_revision_id`
	AND `status` = 'publishing'
	AND `publish_lease_token` = NEW.`source_publish_lease_token`
	AND julianday(`publish_lease_expires_at`) > julianday('now')
)
BEGIN
	SELECT RAISE(ABORT, 'creator publish lease is stale or expired');
END;--> statement-breakpoint
CREATE TRIGGER `skills_default_release_integrity`
BEFORE UPDATE OF `default_release_id` ON `skills`
WHEN NEW.`default_release_id` IS NOT NULL AND NOT EXISTS (
	SELECT 1 FROM `skill_releases`
	WHERE `id` = NEW.`default_release_id`
	AND `skill_id` = NEW.`id`
	AND `status` = 'published'
)
BEGIN
	SELECT RAISE(ABORT, 'default release must be a published release of the same skill');
END;--> statement-breakpoint
CREATE TRIGGER `skills_creator_release_head_fence`
BEFORE UPDATE OF `default_release_id` ON `skills`
WHEN OLD.`default_release_id` IS NOT NULL
	AND NEW.`default_release_id` IS NOT OLD.`default_release_id`
	AND EXISTS (SELECT 1 FROM `skill_releases` WHERE `id` = NEW.`default_release_id` AND `source_submission_id` IS NOT NULL)
	AND NOT EXISTS (
		SELECT 1
		FROM `skill_releases` AS release
		JOIN `creator_submissions` AS submission ON submission.`id` = release.`source_submission_id`
		WHERE release.`id` = NEW.`default_release_id`
		AND release.`skill_id` = NEW.`id`
		AND submission.`target_skill_id` = NEW.`id`
		AND submission.`base_release_id` = OLD.`default_release_id`
		AND submission.`status` = 'publishing'
		AND submission.`publish_lease_token` = release.`source_publish_lease_token`
	)
BEGIN
	SELECT RAISE(ABORT, 'creator release base head is stale');
END;--> statement-breakpoint
CREATE TRIGGER `creator_submission_revisions_immutable_update`
BEFORE UPDATE ON `creator_submission_revisions`
BEGIN
	SELECT RAISE(ABORT, 'creator submission revisions are append only');
END;--> statement-breakpoint
CREATE TRIGGER `creator_submission_revision_parent_fence`
BEFORE INSERT ON `creator_submission_revisions`
WHEN NOT (
	(NEW.`revision` = 1 AND NEW.`parent_revision_id` IS NULL AND EXISTS (
		SELECT 1 FROM `creator_submissions`
		WHERE `id` = NEW.`submission_id`
		AND `workspace_id` = NEW.`workspace_id`
		AND `revision` = 1
		AND `current_revision_id` = NEW.`id`
	))
	OR
	(NEW.`revision` > 1 AND EXISTS (
		SELECT 1 FROM `creator_submissions`
		WHERE `id` = NEW.`submission_id`
		AND `workspace_id` = NEW.`workspace_id`
		AND `current_revision_id` = NEW.`parent_revision_id`
		AND `revision` + 1 = NEW.`revision`
		AND `status` IN ('draft', 'review_ready', 'rejected')
	))
)
BEGIN
	SELECT RAISE(ABORT, 'creator revision parent is stale');
END;--> statement-breakpoint
CREATE TRIGGER `creator_submission_revisions_immutable_delete`
BEFORE DELETE ON `creator_submission_revisions`
BEGIN
	SELECT RAISE(ABORT, 'creator submission revisions are append only');
END;--> statement-breakpoint
CREATE TRIGGER `creator_evaluations_completed_immutable_update`
BEFORE UPDATE ON `creator_evaluations`
WHEN OLD.`completed_at` IS NOT NULL
BEGIN
	SELECT RAISE(ABORT, 'completed creator evaluations are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `creator_evaluations_immutable_delete`
BEFORE DELETE ON `creator_evaluations`
BEGIN
	SELECT RAISE(ABORT, 'creator evaluations are append only');
END;--> statement-breakpoint
CREATE TRIGGER `creator_storage_ready_audit_fence`
BEFORE INSERT ON `audit_events`
WHEN NEW.`action` IN ('creator.created', 'creator.storage_recovered') AND NOT EXISTS (
	SELECT 1 FROM `creator_submissions`
	WHERE `id` = NEW.`object_id`
	AND `workspace_id` = NEW.`workspace_id`
	AND `status` = 'draft'
	AND `source_storage_status` = 'ready'
	AND `content_digest` = NEW.`after_digest`
	AND `state_version` = CAST(json_extract(NEW.`event_data`, '$.storageAttemptCommittedVersion') AS INTEGER)
)
BEGIN
	SELECT RAISE(ABORT, 'creator storage audit attempt is stale');
END;
