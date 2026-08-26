import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function migration(name) {
  return readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8");
}

function applyMigration(db, sql) {
  for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) {
    db.exec(statement);
  }
}

test("Gate D upgrades the deployed Gate C schema with legacy rows", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  applyMigration(db, await migration("0000_bent_millenium_guard.sql"));
  db.exec(`
    INSERT INTO accounts (id, primary_email, display_name) VALUES ('acct_old', 'old@example.com', '旧用户');
    INSERT INTO workspaces (id, type, name) VALUES ('ws_old', 'personal', '旧空间');
    INSERT INTO workflows (id, workspace_id, created_by_account_id, name, status) VALUES ('wf_old', 'ws_old', 'acct_old', '旧工作流', 'active');
    INSERT INTO workflow_versions (id, workflow_id, revision, status, graph_digest, created_by_account_id) VALUES ('wfv_old', 'wf_old', 1, 'active', 'sha256:old', 'acct_old');
    INSERT INTO runs (id, workspace_id, initiated_by_account_id, workflow_version_id, status, input, runtime_policy) VALUES ('run_old', 'ws_old', 'acct_old', 'wfv_old', 'waiting_approval', '{}', '{}');
    INSERT INTO run_steps (id, run_id, sequence, kind, name, status) VALUES ('step_old', 'run_old', 0, 'model', '旧步骤', 'running');
  `);

  applyMigration(db, await migration("0001_mute_rage.sql"));
  applyMigration(db, await migration("0002_overjoyed_night_nurse.sql"));
  applyMigration(db, await migration("0003_tidy_screwball.sql"));
  applyMigration(db, await migration("0004_complex_blacklash.sql"));

  const runColumns = db.prepare("PRAGMA table_info(runs)").all().map((row) => row.name);
  const stepColumns = db.prepare("PRAGMA table_info(run_steps)").all().map((row) => row.name);
  assert.ok(runColumns.includes("updated_at"));
  assert.ok(stepColumns.includes("updated_at"));
  const legacy = db.prepare("SELECT status, error, updated_at FROM runs WHERE id='run_old'").get();
  assert.equal(legacy.status, "blocked");
  assert.match(legacy.error, /LEGACY_RUNTIME_BLOCKED/);
  assert.ok(legacy.updated_at);
  assert.equal(db.prepare("SELECT step_key IS NOT NULL AS ok, updated_at <> '' AS updated FROM run_steps WHERE id='step_old'").get().ok, 1);
  assert.equal(db.prepare("SELECT step_key IS NOT NULL AS ok, updated_at <> '' AS updated FROM run_steps WHERE id='step_old'").get().updated, 1);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type='table' AND name='run_quota_claims'").get().count, 1);
  db.exec("INSERT INTO run_quota_claims (id, workspace_id, run_id, scope, bucket, slot, expires_at) VALUES ('quota_a', 'ws_old', 'run_old', 'active', 'active', 0, '2099-01-01')");
  assert.throws(
    () => db.exec("INSERT INTO run_quota_claims (id, workspace_id, run_id, scope, bucket, slot, expires_at) VALUES ('quota_b', 'ws_old', 'run_old', 'active', 'active', 1, '2099-01-01')"),
    /UNIQUE constraint failed/,
  );
  assert.throws(
    () => db.exec("INSERT INTO run_steps (id, run_id, step_key, sequence, kind, name) VALUES ('step_bad', 'run_old', NULL, 1, 'model', '坏步骤')"),
    /run_steps\.step_key required/,
  );
  db.close();
});
