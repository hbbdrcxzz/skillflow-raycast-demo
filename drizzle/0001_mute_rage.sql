ALTER TABLE `approvals` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `approvals` ADD `upstream_output_digest` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `approvals` ADD `payload_digest` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `approvals` ADD `decision_payload` text;--> statement-breakpoint
ALTER TABLE `approvals` ADD `supersedes_approval_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `approvals_run_action_revision_uq` ON `approvals` (`run_id`,`action_type`,`revision`);--> statement-breakpoint
ALTER TABLE `artifacts` ADD `status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `run_steps` ADD `step_key` text;--> statement-breakpoint
UPDATE `run_steps` SET `step_key` = 'legacy_step_' || `sequence` WHERE `step_key` IS NULL;--> statement-breakpoint
ALTER TABLE `run_steps` ADD `skill_pin_snapshot` text;--> statement-breakpoint
ALTER TABLE `run_steps` ADD `skill_manifest_digest` text;--> statement-breakpoint
ALTER TABLE `run_steps` ADD `input_digest` text;--> statement-breakpoint
ALTER TABLE `run_steps` ADD `output_digest` text;--> statement-breakpoint
ALTER TABLE `run_steps` ADD `receipt` text;--> statement-breakpoint
ALTER TABLE `run_steps` ADD `lease_token` text;--> statement-breakpoint
ALTER TABLE `run_steps` ADD `lease_expires_at` text;--> statement-breakpoint
ALTER TABLE `run_steps` ADD `updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `run_steps` SET `updated_at` = coalesce(`completed_at`, `started_at`, `created_at`, CURRENT_TIMESTAMP) WHERE `updated_at` = '';--> statement-breakpoint
CREATE TRIGGER `run_steps_step_key_not_null_insert` BEFORE INSERT ON `run_steps` WHEN NEW.`step_key` IS NULL BEGIN SELECT RAISE(ABORT, 'run_steps.step_key required'); END;--> statement-breakpoint
CREATE TRIGGER `run_steps_step_key_not_null_update` BEFORE UPDATE OF `step_key` ON `run_steps` WHEN NEW.`step_key` IS NULL BEGIN SELECT RAISE(ABORT, 'run_steps.step_key required'); END;--> statement-breakpoint
CREATE UNIQUE INDEX `run_steps_run_key_attempt_uq` ON `run_steps` (`run_id`,`step_key`,`attempt`);--> statement-breakpoint
ALTER TABLE `runs` ADD `request_digest` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `preflight_snapshot` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `preflight_digest` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `runtime_adapter_id` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `runtime_adapter_version` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `runtime_plan_digest` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `input_artifact_id` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `current_sequence` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `state_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `runs` ADD `lease_token` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `lease_expires_at` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `cancel_requested_at` text;--> statement-breakpoint
ALTER TABLE `runs` ADD `updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `runs` SET `updated_at` = coalesce(`completed_at`, `started_at`, `created_at`, CURRENT_TIMESTAMP) WHERE `updated_at` = '';--> statement-breakpoint
UPDATE `runs` SET `status` = 'blocked', `error` = '{"code":"LEGACY_RUNTIME_BLOCKED","message":"旧版本运行没有冻结的 Runtime Plan，请从已保存工作流重新开始"}' WHERE `status` IN ('waiting_approval', 'awaiting_approval', 'running', 'queued');--> statement-breakpoint
ALTER TABLE `workflow_versions` ADD `source_schema_version` text DEFAULT 'gate-c-v1' NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_versions` ADD `source_revision_id` text;--> statement-breakpoint
ALTER TABLE `workflow_versions` ADD `source_content_digest` text;--> statement-breakpoint
ALTER TABLE `workflow_versions` ADD `source_contract_digest` text;--> statement-breakpoint
ALTER TABLE `workflow_versions` ADD `composition_snapshot` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `workflow_versions` ADD `runtime_adapter_id` text;--> statement-breakpoint
ALTER TABLE `workflow_versions` ADD `runtime_adapter_version` text;--> statement-breakpoint
ALTER TABLE `workflow_versions` ADD `runtime_plan_digest` text;--> statement-breakpoint
ALTER TABLE `workflow_versions` ADD `runtime_plan_snapshot` text;--> statement-breakpoint
ALTER TABLE `workflow_versions` ADD `validation_snapshot` text;--> statement-breakpoint
ALTER TABLE `workflow_versions` ADD `parent_workflow_version_id` text;
