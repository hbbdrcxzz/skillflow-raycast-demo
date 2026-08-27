import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function migration(name) { return readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8"); }
function applyMigration(db, sql) {
  for (const statement of sql.split("--> statement-breakpoint").map((item) => item.trim()).filter(Boolean)) db.exec(statement);
}

test("Gate E upgrades legacy releases and enforces immutable creator evidence", async () => {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  for (const name of ["0000_bent_millenium_guard.sql", "0001_mute_rage.sql", "0002_overjoyed_night_nurse.sql", "0003_tidy_screwball.sql", "0004_complex_blacklash.sql"]) applyMigration(db, await migration(name));
  db.exec(`
    INSERT INTO accounts (id, primary_email, display_name) VALUES ('acct_e', 'e@example.com', '创作者');
    INSERT INTO workspaces (id, type, name) VALUES ('ws_e', 'personal', '创作者空间');
    INSERT INTO skills (id, slug, owner_workspace_id, created_by_account_id, name, status, visibility) VALUES ('skill_old', 'legacy-skill', 'ws_e', 'acct_e', '旧 Skill', 'published', 'public');
    INSERT INTO skill_releases (id, skill_id, version, status, artifact_digest, manifest, permission_manifest, compatibility_manifest, region_policy, created_by_account_id, published_at)
      VALUES ('release_old', 'skill_old', '1.0.0', 'published', 'sha256:legacy', '{}', '{}', '{}', '{}', 'acct_e', '2026-01-01');
    UPDATE skills SET default_release_id='release_old' WHERE id='skill_old';
    INSERT INTO personal_configurations (id, workspace_id, skill_release_id, created_by_account_id, name, parameters, config_digest)
      VALUES ('config_old', 'ws_e', 'release_old', 'acct_e', '旧版配置', '{}', 'sha256:config-old');
  `);
  db.exec("BEGIN");
  applyMigration(db, await migration("0005_skinny_calypso.sql"));
  db.exec("COMMIT");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  const release = db.prepare("SELECT id, source_submission_id, artifact_digest FROM skill_releases WHERE id='release_old'").get();
  assert.equal(release.id, "release_old");
  assert.equal(release.source_submission_id, null);
  assert.equal(release.artifact_digest, "sha256:legacy");
  assert.equal(db.prepare("SELECT skill_release_id FROM personal_configurations WHERE id='config_old'").get().skill_release_id, "release_old");
  assert.throws(() => db.exec("UPDATE skill_releases SET manifest='{} ' WHERE id='release_old'"), /published skill release material is immutable/);
  assert.throws(() => db.exec("DELETE FROM skill_releases WHERE id='release_old'"), /published skill release cannot be deleted/);
  assert.throws(() => db.exec("UPDATE skills SET default_release_id='missing' WHERE id='skill_old'"), /default release must be a published release/);
  db.exec(`
    INSERT INTO creator_submissions (id, workspace_id, created_by_account_id, input_kind, status, revision, current_revision_id, name, slug, tags, inputs, outputs, permissions, limitations, source_storage_key, source_storage_status, source_digest, source_byte_size, parser_version, request_digest, hosted_execution_policy, canonical_draft, content_digest, idempotency_key)
      VALUES ('sub_e', 'ws_e', 'acct_e', 'skill_text', 'draft', 1, 'srev_e', 'Test', 'test-e', '[]', '[]', '[]', '[]', '[]', 'private/source', 'ready', 'sha256:source', 10, 'v1', 'sha256:req', 'deny', '{}', 'sha256:draft', 'idem:e');
    INSERT INTO creator_submission_revisions (id, workspace_id, submission_id, revision, mutation_kind, source_digest, snapshot, content_digest, structured_diff, created_by_account_id)
      VALUES ('srev_e', 'ws_e', 'sub_e', 1, 'imported', 'sha256:source', '{}', 'sha256:draft', '[]', 'acct_e');
  `);
  assert.throws(() => db.exec("UPDATE creator_submission_revisions SET snapshot='{} ' WHERE id='srev_e'"), /append only/);
  assert.throws(() => db.exec("DELETE FROM creator_submission_revisions WHERE id='srev_e'"), /append only/);
  assert.throws(() => db.exec(`
    INSERT INTO creator_submission_revisions (id, workspace_id, submission_id, revision, parent_revision_id, mutation_kind, source_digest, snapshot, content_digest, structured_diff, created_by_account_id)
      VALUES ('srev_stale', 'ws_e', 'sub_e', 2, 'wrong_parent', 'manual_edit', 'sha256:source', '{}', 'sha256:stale-draft', '[]', 'acct_e')
  `), /creator revision parent is stale/);
  assert.equal(db.prepare("SELECT count(*) AS count FROM creator_submission_revisions WHERE submission_id='sub_e'").get().count, 1);
  assert.throws(() => db.exec(`
    INSERT INTO audit_events (id, workspace_id, actor_type, actor_id, action, object_type, object_id, after_digest, event_data)
      VALUES ('audit_stale_storage', 'ws_e', 'account', 'acct_e', 'creator.storage_recovered', 'creator_submission', 'sub_e', 'sha256:draft', '{"storageAttemptCommittedVersion":1}')
  `), /creator storage audit attempt is stale/);
  assert.throws(() => db.exec(`
    INSERT INTO skill_releases (id, skill_id, version, status, source_submission_id, source_submission_revision_id, source_publish_lease_token, artifact_digest, manifest, permission_manifest, compatibility_manifest, region_policy, published_at)
    VALUES ('release_stale', 'skill_old', '2.0.0', 'published', 'sub_e', 'srev_e', 'wrong-lease', 'sha256:stale', '{}', '{}', '{}', '{}', '2026-01-02')
  `), /creator publish lease is stale or expired/);
  db.exec(`
    UPDATE creator_submissions SET status='publishing', target_skill_id='skill_old', base_release_id='release_old', publish_lease_token='lease-live', publish_lease_expires_at='2999-01-01T00:00:00.000Z' WHERE id='sub_e';
    INSERT INTO skill_releases (id, skill_id, version, status, source_submission_id, source_submission_revision_id, source_publish_lease_token, artifact_digest, manifest, permission_manifest, compatibility_manifest, region_policy, published_at)
    VALUES ('release_new', 'skill_old', '2.0.0', 'published', 'sub_e', 'srev_e', 'lease-live', 'sha256:new', '{}', '{}', '{}', '{}', '2026-01-02');
    UPDATE skills SET default_release_id='release_new' WHERE id='skill_old';
    INSERT INTO creator_submissions (id, workspace_id, created_by_account_id, input_kind, status, revision, current_revision_id, name, slug, tags, inputs, outputs, permissions, limitations, source_storage_key, source_storage_status, source_digest, source_byte_size, parser_version, request_digest, hosted_execution_policy, canonical_draft, content_digest, idempotency_key, target_skill_id, base_release_id, publish_lease_token, publish_lease_expires_at)
      VALUES ('sub_head_stale', 'ws_e', 'acct_e', 'registry_fork', 'publishing', 1, 'srev_head_stale', 'Stale', 'stale-e', '[]', '[]', '[]', '[]', '[]', 'private/stale', 'ready', 'sha256:stale-source', 10, 'v1', 'sha256:req-stale', 'deny', '{}', 'sha256:stale-draft', 'idem:stale', 'skill_old', 'release_old', 'lease-stale-head', '2999-01-01T00:00:00.000Z');
    INSERT INTO skill_releases (id, skill_id, version, status, source_submission_id, source_submission_revision_id, source_publish_lease_token, artifact_digest, manifest, permission_manifest, compatibility_manifest, region_policy, published_at)
    VALUES ('release_stale_head', 'skill_old', '3.0.0', 'published', 'sub_head_stale', 'srev_head_stale', 'lease-stale-head', 'sha256:stale-head', '{}', '{}', '{}', '{}', '2026-01-03');
  `);
  assert.throws(() => db.exec("UPDATE skills SET default_release_id='release_stale_head' WHERE id='skill_old'"), /creator release base head is stale/);
  assert.equal(db.prepare("SELECT default_release_id FROM skills WHERE id='skill_old'").get().default_release_id, "release_new");
  db.exec(`
    INSERT INTO creator_submissions (id, workspace_id, created_by_account_id, input_kind, status, revision, current_revision_id, name, slug, tags, inputs, outputs, permissions, limitations, source_storage_key, source_storage_status, source_digest, source_byte_size, parser_version, request_digest, hosted_execution_policy, canonical_draft, content_digest, idempotency_key, target_skill_id, base_release_id, publish_lease_token, publish_lease_expires_at)
      VALUES ('sub_expired', 'ws_e', 'acct_e', 'registry_fork', 'publishing', 1, 'srev_expired', 'Expired', 'expired-e', '[]', '[]', '[]', '[]', '[]', 'private/expired', 'ready', 'sha256:expired-source', 10, 'v1', 'sha256:req-expired', 'deny', '{}', 'sha256:expired-draft', 'idem:expired', 'skill_old', 'release_new', 'lease-expired', '2000-01-01T00:00:00.000Z');
  `);
  assert.throws(() => db.exec(`
    INSERT INTO skill_releases (id, skill_id, version, status, source_submission_id, source_submission_revision_id, source_publish_lease_token, artifact_digest, manifest, permission_manifest, compatibility_manifest, region_policy, published_at)
    VALUES ('release_expired', 'skill_old', '4.0.0', 'published', 'sub_expired', 'srev_expired', 'lease-expired', 'sha256:expired', '{}', '{}', '{}', '{}', '2026-01-04')
  `), /creator publish lease is stale or expired/);
  db.close();
});
