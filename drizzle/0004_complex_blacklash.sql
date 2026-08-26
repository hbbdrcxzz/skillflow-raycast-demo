DROP INDEX `run_quota_run_scope_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `run_quota_run_scope_uq` ON `run_quota_claims` (`run_id`,`scope`);