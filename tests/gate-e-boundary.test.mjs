import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) { return readFile(new URL(`../${path}`, import.meta.url), "utf8"); }

test("Gate E creator APIs derive workspace identity server-side", async () => {
  const paths = [
    "app/api/creator/submissions/route.ts", "app/api/creator/submissions/[submissionId]/route.ts",
    "app/api/creator/submissions/[submissionId]/propose/route.ts", "app/api/creator/submissions/[submissionId]/evaluations/e1/route.ts",
    "app/api/creator/submissions/[submissionId]/evaluations/e2/route.ts", "app/api/creator/submissions/[submissionId]/publish/route.ts",
    "app/api/creator/submissions/[submissionId]/claims/route.ts",
  ];
  for (const path of paths) {
    const route = await source(path);
    assert.match(route, /requireGateEWorkspace\(\)/, path);
    assert.doesNotMatch(route, /body\.(?:workspaceId|accountId|artifactStorageKey|sourceStorageKey)/, path);
  }
});

test("Gate E keeps AI edits as previewed Diff and records accepted content as creator-confirmed", async () => {
  const [store, contracts, studio] = await Promise.all([
    source("lib/gate-e-store.ts"), source("lib/gate-e-contracts.ts"), source("app/components/CreatorStudio.tsx"),
  ]);
  assert.match(store, /proposeCreatorDraftChange/);
  assert.match(store, /assertNoProtectedDraftMutation\(before, after\)/);
  assert.match(store, /Presentation provenance is server-owned/);
  assert.match(store, /presentationProvenance\[field\] = "creator"/);
  assert.doesNotMatch(store, /mutationKind: input\.mutationKind === "ai_diff"/);
  assert.match(store, /applied: false/);
  assert.match(contracts, /protectedFieldChanges/);
  assert.match(contracts, /hostedExecutionPolicy: "deny"/);
  assert.match(studio, /生成修改提案/);
  assert.match(studio, /确认并生成 Revision/);
  assert.match(studio, /来源、许可证、作者、派生关系与执行策略不能由 AI 或普通编辑覆盖/);
});

test("Gate E publishes immutable directory-only releases and never runs arbitrary scripts", async () => {
  const [store, migration, creatorRegistry, resolver] = await Promise.all([
    source("lib/gate-e-store.ts"), source("drizzle/0005_skinny_calypso.sql"), source("lib/creator-registry.ts"), source("lib/gate-c-release-resolver.ts"),
  ]);
  assert.match(store, /writeR2Verified\(artifactStorageKey/);
  assert.match(store, /hostedExecutionPolicy: "deny"/);
  assert.doesNotMatch(store, /(?:child_process|execSync|spawnSync|eval\()/);
  assert.match(migration, /published skill release material is immutable/);
  assert.match(migration, /creator submission revisions are append only/);
  assert.doesNotMatch(migration, /DROP TABLE `skill_releases`|PRAGMA foreign_keys/);
  assert.match(creatorRegistry, /identityKey: `skillflow_creator:\$\{row\.releaseId\}`/);
  assert.match(resolver, /创作者 Skill 必须携带不可变 Release ID/);
  assert.match(resolver, /expectedManifestDigest/);
});

test("Gate E public Registry projection does not expose workspace or private evidence", async () => {
  const serializer = await source("lib/creator-registry.ts");
  assert.doesNotMatch(serializer, /ownerWorkspaceId/);
  assert.doesNotMatch(serializer, /riskSnapshot/);
  assert.doesNotMatch(serializer, /claimEvidence|evidenceDigest/);
  assert.match(serializer, /upstreamAuthorVerified|作者身份待核验|发布者身份/);
});

test("Gate E exposes honest publisher identity, next-version and claim workflows", async () => {
  const [store, studio] = await Promise.all([
    source("lib/gate-e-store.ts"), source("app/components/CreatorStudio.tsx"),
  ]);
  assert.match(store, /publisherDisplayName/);
  assert.match(store, /upstreamAuthorVerified: false/);
  assert.match(store, /publishAsNextVersion/);
  assert.match(store, /TARGET_SKILL_FORBIDDEN/);
  assert.match(store, /NO_MATERIAL_CHANGE/);
  assert.match(studio, /公开发布署名/);
  assert.match(studio, /基于此 Release 创建下一版本/);
  assert.match(studio, /提交待审核认领/);
  assert.match(studio, /发布者声明，不代表平台已验证/);
});

test("Gate E preserves exact old release resolution after a newer default release", async () => {
  const [store, pin] = await Promise.all([
    source("lib/gate-e-store.ts"), source("lib/creator-release-pin.ts"),
  ]);
  const exactLookup = store.slice(store.indexOf("export async function creatorReleaseByIdentity"), store.indexOf("export async function searchCreatorReleases"));
  const exactPin = pin.slice(pin.indexOf("export async function resolveCreatorReleasePin"), pin.indexOf("export async function searchCreatorReleasePins"));
  assert.doesNotMatch(exactLookup, /defaultReleaseId/);
  assert.doesNotMatch(exactPin, /defaultReleaseId/);
  assert.match(store, /baseReleaseId/);
  assert.match(store, /targetSkillId/);
  assert.match(store, /readR2VerifiedText\(release\.artifactStorageKey, release\.artifactDigest\)/);
  assert.match(pin, /canonicalName: releaseName/);
});

test("Gate E fences concurrent revision and publish commits before durable mutation", async () => {
  const [store, migration] = await Promise.all([
    source("lib/gate-e-store.ts"), source("drizzle/0005_skinny_calypso.sql"),
  ]);
  assert.match(migration, /creator_submission_revision_parent_fence/);
  assert.match(migration, /creator revision parent is stale/);
  assert.match(migration, /skill_releases_creator_publish_fence/);
  assert.match(migration, /julianday\(`publish_lease_expires_at`\) > julianday\('now'\)/);
  assert.match(migration, /skills_creator_release_head_fence/);
  assert.match(store, /publishLeaseToken[\s\S]*writeR2Verified\(artifactStorageKey/);
  assert.match(store, /sourcePublishLeaseToken: publishLeaseToken/);
  assert.match(store, /BASE_RELEASE_STALE/);
  assert.match(store, /VERSION_NOT_NEWER/);
});

test("Gate E creation failures keep a resumable idempotent storage contract", async () => {
  const store = await source("lib/gate-e-store.ts");
  assert.match(store, /existing\.status === "storage_failed"/);
  assert.match(store, /pendingRecoveryExpired/);
  assert.match(store, /creator\.storage_recovered/);
  assert.match(store, /SOURCE_RETRY_MISMATCH/);
  assert.match(store, /sourceStorageStatus: "ready"/);
  assert.match(store, /eq\(creatorSubmissions\.stateVersion, claimed\.stateVersion\)/);
  assert.match(store, /storageAttemptCommittedVersion: claimed\.stateVersion \+ 1/);
  const reconciliation = store.slice(store.indexOf("async function reconcileSourceStorageCommit"), store.indexOf("export async function listCreatorSubmissions"));
  assert.match(reconciliation, /Preserve R2 under ambiguity/);
  assert.match(reconciliation, /Do not delete the shared content-addressed source key/);
  assert.match(reconciliation, /eq\(creatorSubmissions\.stateVersion, expectedStateVersion\)/);
  assert.doesNotMatch(reconciliation, /env\.FILES\.delete/);
  assert.match(store, /purpose: "creator_source" \}, false\)/);
});

test("Gate E exact historical projections never fall back to mutable latest Skill metadata", async () => {
  const [store, serializer, pin] = await Promise.all([
    source("lib/gate-e-store.ts"), source("lib/creator-registry.ts"), source("lib/creator-release-pin.ts"),
  ]);
  const exactLookup = store.slice(store.indexOf("export async function creatorReleaseByIdentity"), store.indexOf("export async function searchCreatorReleases"));
  assert.doesNotMatch(exactLookup, /name: skills\.name|summary: skills\.summary|tags: skills\.tags/);
  assert.doesNotMatch(serializer, /draft\.canonicalName : row\.name|draft\.briefZh : row\.summary|row\.tags \|\|/);
  assert.doesNotMatch(pin.slice(0, pin.indexOf("export async function searchCreatorReleasePins")), /name: skills\.name/);
  assert.match(pin, /不可变 Manifest 缺少 canonicalName/);
});
