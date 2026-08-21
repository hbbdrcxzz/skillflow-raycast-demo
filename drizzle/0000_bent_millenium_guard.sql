CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`primary_email` text,
	`display_name` text DEFAULT '' NOT NULL,
	`avatar_url` text,
	`locale` text DEFAULT 'zh-CN' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_primary_email_uq` ON `accounts` (`primary_email`);--> statement-breakpoint
CREATE INDEX `accounts_status_idx` ON `accounts` (`status`);--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`run_id` text NOT NULL,
	`run_step_id` text,
	`action_type` text NOT NULL,
	`action_payload` text NOT NULL,
	`risk_level` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_by_type` text DEFAULT 'agent' NOT NULL,
	`requested_by_id` text,
	`decided_by_account_id` text,
	`decision_reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text,
	`decided_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_step_id`) REFERENCES `run_steps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`decided_by_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `approvals_workspace_status_idx` ON `approvals` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `approvals_run_status_idx` ON `approvals` (`run_id`,`status`);--> statement-breakpoint
CREATE INDEX `approvals_pending_expiry_idx` ON `approvals` (`status`,`expires_at`);--> statement-breakpoint
CREATE TABLE `artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`run_id` text,
	`run_step_id` text,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`mime_type` text NOT NULL,
	`storage_key` text NOT NULL,
	`byte_size` integer NOT NULL,
	`content_digest` text NOT NULL,
	`data_region` text DEFAULT 'global' NOT NULL,
	`metadata` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text,
	`deleted_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`run_step_id`) REFERENCES `run_steps`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `artifacts_workspace_storage_key_uq` ON `artifacts` (`workspace_id`,`storage_key`);--> statement-breakpoint
CREATE INDEX `artifacts_run_kind_idx` ON `artifacts` (`run_id`,`kind`);--> statement-breakpoint
CREATE INDEX `artifacts_workspace_created_idx` ON `artifacts` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `artifacts_expiry_idx` ON `artifacts` (`deleted_at`,`expires_at`);--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`object_type` text NOT NULL,
	`object_id` text NOT NULL,
	`run_id` text,
	`policy_version` text,
	`before_digest` text,
	`after_digest` text,
	`data_region` text DEFAULT 'global' NOT NULL,
	`event_data` text,
	`request_id` text,
	`ip_hash` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_events_workspace_created_idx` ON `audit_events` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_events_object_created_idx` ON `audit_events` (`object_type`,`object_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_events_run_created_idx` ON `audit_events` (`run_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_events_action_created_idx` ON `audit_events` (`action`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_events_request_idx` ON `audit_events` (`request_id`);--> statement-breakpoint
CREATE TABLE `capability_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`capability` text NOT NULL,
	`effect` text NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`approval_policy` text DEFAULT 'always' NOT NULL,
	`constraints` text,
	`status` text DEFAULT 'active' NOT NULL,
	`granted_by_account_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text,
	`revoked_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `capability_grants_connection_scope_uq` ON `capability_grants` (`connection_id`,`capability`,`effect`,`resource_type`,`resource_id`);--> statement-breakpoint
CREATE INDEX `capability_grants_workspace_status_idx` ON `capability_grants` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `capability_grants_connection_status_idx` ON `capability_grants` (`connection_id`,`status`);--> statement-breakpoint
CREATE INDEX `capability_grants_capability_idx` ON `capability_grants` (`capability`,`effect`);--> statement-breakpoint
CREATE TABLE `connections` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`account_id` text,
	`provider` text NOT NULL,
	`provider_account_id` text,
	`display_name` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`auth_scheme` text NOT NULL,
	`secret_ref` text NOT NULL,
	`granted_scopes` text NOT NULL,
	`selected_resources` text NOT NULL,
	`data_region` text DEFAULT 'global' NOT NULL,
	`metadata` text,
	`token_expires_at` text,
	`last_used_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`revoked_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `connections_workspace_provider_idx` ON `connections` (`workspace_id`,`provider`);--> statement-breakpoint
CREATE INDEX `connections_workspace_status_idx` ON `connections` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `connections_account_status_idx` ON `connections` (`account_id`,`status`);--> statement-breakpoint
CREATE INDEX `connections_token_expiry_idx` ON `connections` (`status`,`token_expires_at`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`account_id` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`invited_by_account_id` text,
	`joined_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_workspace_account_uq` ON `memberships` (`workspace_id`,`account_id`);--> statement-breakpoint
CREATE INDEX `memberships_account_status_idx` ON `memberships` (`account_id`,`status`);--> statement-breakpoint
CREATE INDEX `memberships_workspace_role_idx` ON `memberships` (`workspace_id`,`role`);--> statement-breakpoint
CREATE TABLE `personal_configurations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`skill_release_id` text NOT NULL,
	`created_by_account_id` text,
	`name` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`parameters` text NOT NULL,
	`config_digest` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`skill_release_id`) REFERENCES `skill_releases`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `personal_configs_workspace_digest_uq` ON `personal_configurations` (`workspace_id`,`config_digest`);--> statement-breakpoint
CREATE INDEX `personal_configs_workspace_status_idx` ON `personal_configurations` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `personal_configs_release_idx` ON `personal_configurations` (`skill_release_id`);--> statement-breakpoint
CREATE TABLE `run_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`workflow_node_id` text,
	`sequence` integer NOT NULL,
	`attempt` integer DEFAULT 1 NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`input` text,
	`output` text,
	`error` text,
	`capability` text,
	`connection_id` text,
	`requires_approval` integer DEFAULT false NOT NULL,
	`side_effect` text DEFAULT 'none' NOT NULL,
	`started_at` text,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workflow_node_id`) REFERENCES `workflow_nodes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`connection_id`) REFERENCES `connections`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `run_steps_run_sequence_attempt_uq` ON `run_steps` (`run_id`,`sequence`,`attempt`);--> statement-breakpoint
CREATE INDEX `run_steps_run_status_idx` ON `run_steps` (`run_id`,`status`);--> statement-breakpoint
CREATE INDEX `run_steps_connection_idx` ON `run_steps` (`connection_id`);--> statement-breakpoint
CREATE INDEX `run_steps_capability_idx` ON `run_steps` (`capability`);--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`initiated_by_account_id` text,
	`workflow_version_id` text,
	`skill_release_id` text,
	`personal_configuration_id` text,
	`kind` text DEFAULT 'private' NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`idempotency_key` text,
	`input` text NOT NULL,
	`output` text,
	`error` text,
	`runtime_policy` text NOT NULL,
	`model_provider` text,
	`model_id` text,
	`execution_region` text DEFAULT 'global' NOT NULL,
	`cross_border_processing_used` integer DEFAULT false NOT NULL,
	`token_input` integer DEFAULT 0 NOT NULL,
	`token_output` integer DEFAULT 0 NOT NULL,
	`cost_micros` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`started_at` text,
	`completed_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`initiated_by_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`workflow_version_id`) REFERENCES `workflow_versions`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`skill_release_id`) REFERENCES `skill_releases`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`personal_configuration_id`) REFERENCES `personal_configurations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `runs_workspace_idempotency_uq` ON `runs` (`workspace_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `runs_workspace_status_created_idx` ON `runs` (`workspace_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `runs_workflow_version_idx` ON `runs` (`workflow_version_id`);--> statement-breakpoint
CREATE INDEX `runs_skill_release_idx` ON `runs` (`skill_release_id`);--> statement-breakpoint
CREATE INDEX `runs_status_created_idx` ON `runs` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `skill_forks` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`source_skill_id` text NOT NULL,
	`source_release_id` text NOT NULL,
	`forked_skill_id` text NOT NULL,
	`forked_release_id` text,
	`created_by_account_id` text,
	`reason` text DEFAULT '' NOT NULL,
	`structured_diff` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`source_release_id`) REFERENCES `skill_releases`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`forked_skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`forked_release_id`) REFERENCES `skill_releases`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_forks_forked_skill_uq` ON `skill_forks` (`forked_skill_id`);--> statement-breakpoint
CREATE INDEX `skill_forks_source_release_idx` ON `skill_forks` (`source_release_id`);--> statement-breakpoint
CREATE INDEX `skill_forks_workspace_status_idx` ON `skill_forks` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `skill_releases` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`version` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`format` text DEFAULT 'agent_skills' NOT NULL,
	`source_url` text,
	`source_commit` text,
	`source_package_digest` text,
	`artifact_storage_key` text,
	`artifact_digest` text NOT NULL,
	`manifest` text NOT NULL,
	`permission_manifest` text NOT NULL,
	`compatibility_manifest` text NOT NULL,
	`region_policy` text NOT NULL,
	`license_spdx` text,
	`contains_executable_scripts` integer DEFAULT false NOT NULL,
	`hosted_execution_policy` text DEFAULT 'deny' NOT NULL,
	`created_by_account_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`published_at` text,
	`yanked_at` text,
	`revoked_at` text,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_releases_skill_version_uq` ON `skill_releases` (`skill_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `skill_releases_digest_uq` ON `skill_releases` (`artifact_digest`);--> statement-breakpoint
CREATE INDEX `skill_releases_skill_status_idx` ON `skill_releases` (`skill_id`,`status`);--> statement-breakpoint
CREATE INDEX `skill_releases_status_published_idx` ON `skill_releases` (`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `skill_releases_source_commit_idx` ON `skill_releases` (`source_url`,`source_commit`);--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`owner_workspace_id` text,
	`created_by_account_id` text,
	`name` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`source_type` text DEFAULT 'native' NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`default_release_id` text,
	`tags` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`owner_workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skills_slug_uq` ON `skills` (`slug`);--> statement-breakpoint
CREATE INDEX `skills_owner_status_idx` ON `skills` (`owner_workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `skills_visibility_status_idx` ON `skills` (`visibility`,`status`);--> statement-breakpoint
CREATE INDEX `skills_source_type_idx` ON `skills` (`source_type`);--> statement-breakpoint
CREATE TABLE `workflow_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_version_id` text NOT NULL,
	`source_node_id` text NOT NULL,
	`target_node_id` text NOT NULL,
	`source_handle` text DEFAULT 'default' NOT NULL,
	`target_handle` text DEFAULT 'default' NOT NULL,
	`condition` text,
	`ordinal` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workflow_version_id`) REFERENCES `workflow_versions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_node_id`) REFERENCES `workflow_nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_node_id`) REFERENCES `workflow_nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workflow_edges_version_path_uq` ON `workflow_edges` (`workflow_version_id`,`source_node_id`,`target_node_id`,`source_handle`,`target_handle`);--> statement-breakpoint
CREATE INDEX `workflow_edges_source_idx` ON `workflow_edges` (`workflow_version_id`,`source_node_id`);--> statement-breakpoint
CREATE INDEX `workflow_edges_target_idx` ON `workflow_edges` (`workflow_version_id`,`target_node_id`);--> statement-breakpoint
CREATE TABLE `workflow_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_version_id` text NOT NULL,
	`node_key` text NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`skill_release_id` text,
	`capability` text,
	`config` text NOT NULL,
	`input_schema` text,
	`output_schema` text,
	`position_x` integer DEFAULT 0 NOT NULL,
	`position_y` integer DEFAULT 0 NOT NULL,
	`ordinal` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workflow_version_id`) REFERENCES `workflow_versions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`skill_release_id`) REFERENCES `skill_releases`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workflow_nodes_version_key_uq` ON `workflow_nodes` (`workflow_version_id`,`node_key`);--> statement-breakpoint
CREATE INDEX `workflow_nodes_version_ordinal_idx` ON `workflow_nodes` (`workflow_version_id`,`ordinal`);--> statement-breakpoint
CREATE INDEX `workflow_nodes_skill_release_idx` ON `workflow_nodes` (`skill_release_id`);--> statement-breakpoint
CREATE INDEX `workflow_nodes_capability_idx` ON `workflow_nodes` (`capability`);--> statement-breakpoint
CREATE TABLE `workflow_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`revision` integer NOT NULL,
	`version_label` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`change_summary` text DEFAULT '' NOT NULL,
	`input_schema` text,
	`output_schema` text,
	`graph_digest` text NOT NULL,
	`created_by_account_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`activated_at` text,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workflow_versions_workflow_revision_uq` ON `workflow_versions` (`workflow_id`,`revision`);--> statement-breakpoint
CREATE UNIQUE INDEX `workflow_versions_workflow_digest_uq` ON `workflow_versions` (`workflow_id`,`graph_digest`);--> statement-breakpoint
CREATE INDEX `workflow_versions_workflow_status_idx` ON `workflow_versions` (`workflow_id`,`status`);--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`created_by_account_id` text,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`source_type` text DEFAULT 'blank' NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `workflows_workspace_status_idx` ON `workflows` (`workspace_id`,`status`);--> statement-breakpoint
CREATE INDEX `workflows_workspace_updated_idx` ON `workflows` (`workspace_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `workflows_visibility_status_idx` ON `workflows` (`visibility`,`status`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text DEFAULT 'personal' NOT NULL,
	`name` text NOT NULL,
	`slug` text,
	`status` text DEFAULT 'active' NOT NULL,
	`data_region` text DEFAULT 'global' NOT NULL,
	`cross_border_processing_allowed` integer DEFAULT true NOT NULL,
	`settings` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_slug_uq` ON `workspaces` (`slug`);--> statement-breakpoint
CREATE INDEX `workspaces_status_region_idx` ON `workspaces` (`status`,`data_region`);