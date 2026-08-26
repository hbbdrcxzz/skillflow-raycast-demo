CREATE TABLE `run_quota_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`run_id` text NOT NULL,
	`scope` text NOT NULL,
	`bucket` text NOT NULL,
	`slot` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `run_quota_scope_bucket_slot_uq` ON `run_quota_claims` (`workspace_id`,`scope`,`bucket`,`slot`);--> statement-breakpoint
CREATE INDEX `run_quota_run_scope_idx` ON `run_quota_claims` (`run_id`,`scope`);--> statement-breakpoint
CREATE INDEX `run_quota_expiry_idx` ON `run_quota_claims` (`expires_at`);