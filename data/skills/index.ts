import competitorChangeAnalyzer from "./competitor-change-analyzer.json";
import deliverableQualityReviewer from "./deliverable-quality-reviewer.json";
import interviewEvidenceExtractor from "./interview-evidence-extractor.json";
import interviewMaterialNormalizer from "./interview-material-normalizer.json";
import prdDraftGenerator from "./prd-draft-generator.json";
import productOpportunitySynthesizer from "./product-opportunity-synthesizer.json";
import productWeeklyReportGenerator from "./product-weekly-report-generator.json";
import requirementPrioritizer from "./requirement-prioritizer.json";
import userInsightClusterer from "./user-insight-clusterer.json";

export const seedSkillManifests = [
  interviewMaterialNormalizer,
  interviewEvidenceExtractor,
  userInsightClusterer,
  productOpportunitySynthesizer,
  requirementPrioritizer,
  prdDraftGenerator,
  deliverableQualityReviewer,
  competitorChangeAnalyzer,
  productWeeklyReportGenerator,
] as const;

export type SeedSkillManifest = (typeof seedSkillManifests)[number];

export function publicSkillSummary(manifest: SeedSkillManifest) {
  return {
    id: manifest.skill.id,
    slug: manifest.skill.slug,
    name: manifest.skill.name_zh,
    summary: manifest.skill.summary_zh,
    domain: manifest.skill.domain,
    status: manifest.skill.status,
    sourceType: manifest.skill.source_type,
    sourceStatus: manifest.skill.source_status,
    author: manifest.skill.author,
    tags: manifest.skill.tags,
    node: manifest.node,
    execution: {
      class: manifest.execution.class,
      hosted: ["instruction-only", "built-in"].includes(manifest.execution.class),
      humanGate: manifest.execution.human_gate,
    },
    evidence: {
      currentLevel: manifest.evidence.current_level,
      targetBeforeRecommendation: manifest.evidence.target_level_before_recommendation,
      claims: manifest.evidence.claims_zh,
    },
    readiness:
      manifest.evidence.current_level === "E0" || manifest.skill.source_status === "example-only"
        ? "catalog_candidate"
        : "sandbox_ready",
  };
}

export function publicSkillDetail(manifest: SeedSkillManifest) {
  return {
    ...publicSkillSummary(manifest),
    task: manifest.task,
    contracts: manifest.contracts,
    permissions: manifest.permissions,
    connectors: manifest.connectors,
    regionDataPolicy: manifest.region_data_policy,
    failurePolicy: manifest.failure_policy,
    personalization: manifest.personalization,
    evaluations: manifest.evaluations,
    versioning: manifest.versioning,
    attribution: {
      declaredLicense: manifest.license.declared_license,
      sourceStatus: manifest.license.source_status,
      notice: manifest.license.notice_zh,
    },
  };
}

