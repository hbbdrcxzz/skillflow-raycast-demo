import assert from "node:assert/strict";

const base = process.env.SKILLFLOW_BASE_URL || "http://localhost:3000";
const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const authA = { "oai-authenticated-user-id": `gate-e-a-${nonce}`, "oai-authenticated-user-email": `gate-e-a-${nonce}@example.com` };
const authB = { "oai-authenticated-user-id": `gate-e-b-${nonce}`, "oai-authenticated-user-email": `gate-e-b-${nonce}@example.com` };

async function json(path, method = "GET", body, auth = authA) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...auth }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = await response.json();
  return { response, payload };
}

const skillText = `---
name: Gate E Weekly Insight
description: 将产品与运营工作记录整理为面向管理层的中文洞察周报，并保留事实来源和待确认项
brief_zh: 把产品与运营工作记录整理成结论先行、数字可追溯的管理层周报
license: MIT
tags: 周报, 产品运营, 管理层汇报
inputs: 产品与运营工作记录, 指标变化
outputs: 管理层周报, 风险和下一步
---

# Gate E Weekly Insight

只根据用户提供的工作记录生成中文管理层周报。先给三条以内的核心结论，再列关键数字、风险、下一步和待确认项。每个数字必须保留原始表达；不得编造未提供的事实，也不得声称已经发送、写入外部系统或执行脚本。`;

const publisherName = `Gate E 测试发布者 ${nonce.slice(-6)}`;
const created = await json("/api/creator/submissions", "POST", { inputKind: "skill_text", skillText, slug: `gate-e-weekly-${nonce.replaceAll(".", "-")}`, licenseSpdx: "MIT", rightsAttested: true, publisherName, idempotencyKey: `create:${nonce}` });
assert.equal(created.response.status, 201, JSON.stringify(created.payload));
let submission = created.payload.submission;
assert.equal(submission.status, "draft");
assert.equal(submission.publisherName, publisherName);
assert.equal(submission.source.storageStatus, "ready");

const hidden = await json(`/api/creator/submissions/${submission.id}`, "GET", undefined, authB);
assert.equal(hidden.response.status, 404, JSON.stringify(hidden.payload));

const previous = submission;
const nextDraft = { ...submission.draft, briefZh: `${submission.draft.briefZh}，并明确列出需人工确认的决策` };
const updated = await json(`/api/creator/submissions/${submission.id}`, "PATCH", { expectedRevision: submission.revision, expectedContentDigest: submission.contentDigest, mutationKind: "manual_edit", draft: nextDraft });
assert.equal(updated.response.status, 200, JSON.stringify(updated.payload));
submission = updated.payload.submission;
assert.equal(submission.revision, 2);
assert.notEqual(submission.contentDigest, previous.contentDigest);
const stale = await json(`/api/creator/submissions/${submission.id}`, "PATCH", { expectedRevision: previous.revision, expectedContentDigest: previous.contentDigest, mutationKind: "manual_edit", draft: nextDraft });
assert.equal(stale.response.status, 409, JSON.stringify(stale.payload));

const e1 = await json(`/api/creator/submissions/${submission.id}/evaluations/e1`, "POST", { expectedRevision: submission.revision, expectedContentDigest: submission.contentDigest });
assert.equal(e1.response.status, 201, JSON.stringify(e1.payload));
assert.equal(e1.payload.evaluation.status, "passed");
const e2 = await json(`/api/creator/submissions/${submission.id}/evaluations/e2`, "POST", { expectedRevision: submission.revision, expectedContentDigest: submission.contentDigest, sampleInput: "注册完成率从 42% 提升到 51%，支付页仍有 18% 退出。", criteria: ["结论先行", "保留全部数字"] });
assert.equal(e2.response.status, 201, JSON.stringify(e2.payload));
assert.equal(e2.payload.evaluation.status, "blocked");

const ready = await json(`/api/creator/submissions/${submission.id}`);
submission = ready.payload.submission;
assert.equal(submission.status, "review_ready");
const publishBody = { expectedRevision: submission.revision, expectedContentDigest: submission.contentDigest, e1EvaluationId: e1.payload.evaluation.id, e2EvaluationId: null, version: "1.0.0", idempotencyKey: `publish:${nonce}` };
const concurrentPublishes = await Promise.all([
  json(`/api/creator/submissions/${submission.id}/publish`, "POST", publishBody),
  json(`/api/creator/submissions/${submission.id}/publish`, "POST", publishBody),
]);
assert.equal(concurrentPublishes.some((item) => item.response.status === 201), true, JSON.stringify(concurrentPublishes.map((item) => item.payload)));
assert.equal(concurrentPublishes.every((item) => [201, 409].includes(item.response.status)), true, JSON.stringify(concurrentPublishes.map((item) => item.payload)));
const published = await json(`/api/creator/submissions/${submission.id}`);
submission = published.payload.submission;
assert.equal(submission.status, "published");
assert.ok(submission.published.releaseId);

const registry = await json(`/api/registry/search?task=${encodeURIComponent("Gate E Weekly Insight")}&limit=12`, "GET", undefined, {});
assert.equal(registry.response.status, 200, JSON.stringify(registry.payload));
const listing = registry.payload.skills.find((item) => item.releaseId === submission.published.releaseId);
assert.ok(listing, JSON.stringify(registry.payload));
assert.equal(listing.registrySourceId, "skillflow_creator");
assert.equal(listing.author.verified, false);
assert.equal(listing.author.name, publisherName);
assert.equal(listing.fork.exactContent, true);
const download = await fetch(`${base}${listing.install.downloadUrl}`);
assert.equal(download.status, 200);
assert.match(download.headers.get("content-disposition") || "", /^attachment;/);
assert.match(await download.text(), /skillflow-release-v1/);

const composed = await json("/api/workflows/composition/bootstrap", "POST", { source: { kind: "registry_single", source: "skillflow_creator", slug: listing.slug, releaseId: listing.releaseId, expectedManifestDigest: listing.manifestDigest } }, {});
assert.equal(composed.response.status, 201, JSON.stringify(composed.payload));
assert.equal(composed.payload.revision.nodes[0].skillBindings[0].release.releaseId, listing.releaseId);
assert.equal(composed.payload.revision.nodes[0].skillBindings[0].release.source, "skillflow_creator");

const forked = await json("/api/creator/submissions", "POST", { inputKind: "registry_fork", slug: `gate-e-fork-${nonce.replaceAll(".", "-")}`, rightsAttested: true, publisherName, idempotencyKey: `fork:${nonce}`, fork: { source: "skillflow_creator", slug: listing.slug, releaseId: listing.releaseId, expectedDigest: listing.manifestDigest } });
assert.equal(forked.response.status, 201, JSON.stringify(forked.payload));
assert.equal(forked.payload.submission.draft.attribution.derivedFromReleaseId, listing.releaseId);
assert.equal(forked.payload.submission.draft.attribution.publisherRole, "derivative_creator");
assert.equal(forked.payload.submission.source.digest, listing.manifestDigest, "精确 Fork 的私有来源快照必须与公开 Release 摘要一致");

const nextVersion = await json("/api/creator/submissions", "POST", { inputKind: "registry_fork", slug: listing.slug, rightsAttested: true, publisherName, publishAsNextVersion: true, idempotencyKey: `next:${nonce}`, fork: { source: "skillflow_creator", slug: listing.slug, releaseId: listing.releaseId, expectedDigest: listing.manifestDigest } });
assert.equal(nextVersion.response.status, 201, JSON.stringify(nextVersion.payload));
let nextSubmission = nextVersion.payload.submission;
assert.equal(nextSubmission.targetSkillId, submission.published.skillId);
assert.equal(nextSubmission.baseReleaseId, listing.releaseId);
assert.notEqual(nextSubmission.draft.attribution.publisherRole, "derivative_creator");
const staleBranch = await json("/api/creator/submissions", "POST", { inputKind: "registry_fork", slug: listing.slug, rightsAttested: true, publisherName, publishAsNextVersion: true, idempotencyKey: `next-stale:${nonce}`, fork: { source: "skillflow_creator", slug: listing.slug, releaseId: listing.releaseId, expectedDigest: listing.manifestDigest } });
assert.equal(staleBranch.response.status, 201, JSON.stringify(staleBranch.payload));
let staleSubmission = staleBranch.payload.submission;
const staleE1 = await json(`/api/creator/submissions/${staleSubmission.id}/evaluations/e1`, "POST", { expectedRevision: staleSubmission.revision, expectedContentDigest: staleSubmission.contentDigest });
assert.equal(staleE1.response.status, 201, JSON.stringify(staleE1.payload));
staleSubmission = (await json(`/api/creator/submissions/${staleSubmission.id}`)).payload.submission;
const nextVersionDraft = { ...nextSubmission.draft, canonicalName: `${nextSubmission.draft.canonicalName} V2`, briefZh: `${nextSubmission.draft.briefZh}；新版增加决策负责人字段` };
const nextEdited = await json(`/api/creator/submissions/${nextSubmission.id}`, "PATCH", { expectedRevision: nextSubmission.revision, expectedContentDigest: nextSubmission.contentDigest, mutationKind: "manual_edit", draft: nextVersionDraft });
assert.equal(nextEdited.response.status, 200, JSON.stringify(nextEdited.payload));
nextSubmission = nextEdited.payload.submission;
const nextE1 = await json(`/api/creator/submissions/${nextSubmission.id}/evaluations/e1`, "POST", { expectedRevision: nextSubmission.revision, expectedContentDigest: nextSubmission.contentDigest });
assert.equal(nextE1.response.status, 201, JSON.stringify(nextE1.payload));
assert.equal(nextE1.payload.evaluation.status, "passed");
nextSubmission = (await json(`/api/creator/submissions/${nextSubmission.id}`)).payload.submission;
const lowerVersion = await json(`/api/creator/submissions/${nextSubmission.id}/publish`, "POST", { expectedRevision: nextSubmission.revision, expectedContentDigest: nextSubmission.contentDigest, e1EvaluationId: nextE1.payload.evaluation.id, e2EvaluationId: null, version: "1.0.0-alpha.1", idempotencyKey: `publish-lower:${nonce}` });
assert.equal(lowerVersion.response.status, 409, JSON.stringify(lowerVersion.payload));
assert.equal(lowerVersion.payload.error.code, "VERSION_NOT_NEWER");
const nextPublished = await json(`/api/creator/submissions/${nextSubmission.id}/publish`, "POST", { expectedRevision: nextSubmission.revision, expectedContentDigest: nextSubmission.contentDigest, e1EvaluationId: nextE1.payload.evaluation.id, e2EvaluationId: null, version: "1.1.0", idempotencyKey: `publish-next:${nonce}` });
assert.equal(nextPublished.response.status, 201, JSON.stringify(nextPublished.payload));
const stalePublish = await json(`/api/creator/submissions/${staleSubmission.id}/publish`, "POST", { expectedRevision: staleSubmission.revision, expectedContentDigest: staleSubmission.contentDigest, e1EvaluationId: staleE1.payload.evaluation.id, e2EvaluationId: null, version: "1.2.0", idempotencyKey: `publish-stale:${nonce}` });
assert.equal(stalePublish.response.status, 409, JSON.stringify(stalePublish.payload));
assert.equal(stalePublish.payload.error.code, "BASE_RELEASE_STALE");
const oldDownloadAfterNext = await fetch(`${base}${listing.install.downloadUrl}`);
assert.equal(oldDownloadAfterNext.status, 200, "旧 Release 在发布新版后仍必须可下载");
const oldCompositionAfterNext = await json("/api/workflows/composition/bootstrap", "POST", { source: { kind: "registry_single", source: "skillflow_creator", slug: listing.slug, releaseId: listing.releaseId, expectedManifestDigest: listing.manifestDigest } }, {});
assert.equal(oldCompositionAfterNext.response.status, 201, JSON.stringify(oldCompositionAfterNext.payload));
assert.equal(oldCompositionAfterNext.payload.revision.nodes[0].skillBindings[0].release.canonicalName, listing.name, "旧 Release pin 不得继承新版名称");
const oldDetailAfterNext = await json(`/api/registry/skills/${encodeURIComponent(listing.slug)}?source=skillflow_creator&releaseId=${encodeURIComponent(listing.releaseId)}`, "GET", undefined, {});
assert.equal(oldDetailAfterNext.response.status, 200, JSON.stringify(oldDetailAfterNext.payload));
assert.equal(oldDetailAfterNext.payload.skill.name, listing.name, "旧 Release 商品页不得继承新版名称");
assert.equal(oldDetailAfterNext.payload.skill.briefZh, listing.briefZh, "旧 Release 商品页不得继承新版 Brief");

console.log(JSON.stringify({ status: "PASS", submissionId: submission.id, releaseId: listing.releaseId, nextReleaseId: nextPublished.payload.submission.published.releaseId, creatorRegistryIdentity: listing.identityKey, gateCRevisionId: composed.payload.revision.revisionId, forkSubmissionId: forked.payload.submission.id }, null, 2));
