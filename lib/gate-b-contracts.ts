import type { ModelRunReceipt } from "./openai-responses";

export const GATE_B_SCHEMA_VERSION = "gate-b-v1" as const;

export const interviewFactFields = [
  "goal",
  "current_step",
  "input_system",
  "input_data",
  "output",
  "output_consumer",
  "acceptance_criterion",
  "frequency",
  "volume",
  "duration",
  "tool",
  "responsible_person",
  "human_approval",
  "exception_case",
  "sensitive_boundary",
] as const;

export type InterviewFactField = (typeof interviewFactFields)[number];
export type InterviewFactStatus = "user_confirmed" | "system_inferred" | "unknown" | "conflicted";
export type InterviewState = "collecting" | "review_ready" | "confirmed";

export type InterviewMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export type FactProvenance = {
  messageId: string;
  quote: string;
};

export type InterviewFact = {
  factId: string;
  field: InterviewFactField;
  value: string;
  status: InterviewFactStatus;
  provenance: FactProvenance[];
  confidence: number;
  dependsOnFactIds: string[];
  updatedAt: string;
  confirmedBy: FactProvenance | null;
};

export type ContractFact = Pick<InterviewFact, "factId" | "value" | "status" | "confidence">;

export type GateBTaskContract = {
  status: "unconfirmed_draft" | "confirmed";
  goal: ContractFact[];
  currentProcess: ContractFact[];
  inputs: ContractFact[];
  outputs: ContractFact[];
  outputConsumers: ContractFact[];
  acceptanceCriteria: ContractFact[];
  cadence: ContractFact[];
  tools: ContractFact[];
  ownersAndApprovals: ContractFact[];
  exceptions: ContractFact[];
  sensitiveBoundaries: ContractFact[];
  assumptions: ContractFact[];
  unknowns: ContractFact[];
  factDigest: string;
};

export type InterviewSufficiency = {
  canReview: boolean;
  canConfirm: boolean;
  missingCriticalFields: InterviewFactField[];
  conflictedCriticalFields: InterviewFactField[];
  reasons: string[];
};

export type AdaptiveQuestion = {
  text: string;
  targetFields: InterviewFactField[];
  reason: string;
};

export type TurnAcknowledgement = {
  text: string;
  factIds: string[];
};

export type InterviewConfirmation = {
  confirmedAt: string;
  factDigest: string;
  messageId: string;
};

export type InterviewSnapshot = {
  schemaVersion: typeof GATE_B_SCHEMA_VERSION;
  state: InterviewState;
  requestSeq: number;
  messages: InterviewMessage[];
  facts: InterviewFact[];
  taskContract: GateBTaskContract;
  sufficiency: InterviewSufficiency;
  acknowledgement: TurnAcknowledgement | null;
  nextQuestion: AdaptiveQuestion | null;
  confirmation: InterviewConfirmation | null;
};

export type InterviewTurnRequest = {
  requestSeq: number;
  snapshot?: InterviewSnapshot;
  message: Pick<InterviewMessage, "id" | "content">;
};

export type InterviewTurnResponse = {
  snapshot: InterviewSnapshot;
  receipt: ModelRunReceipt;
};

export type InterviewEditOperation =
  | { type: "set"; field: InterviewFactField; value: string; replacesFactIds: string[] }
  | { type: "delete"; factIds: string[] }
  | { type: "confirm"; factIds: string[] };

export type InterviewEditRequest = {
  requestSeq: number;
  snapshot: InterviewSnapshot;
  message: Pick<InterviewMessage, "id" | "content">;
  operation: InterviewEditOperation;
};

export type AbstractWorkflowNode = {
  nodeId: string;
  label: string;
  purpose: string;
  sourceFactIds: string[];
  aiSuitability: "do_not_use_ai" | "ai_assist" | "ai_first_with_human_review" | "needs_analysis";
  aiResponsibility: string;
  humanResponsibility: string;
  riskLevel: "low" | "medium" | "high";
};

export type AbstractWorkflow = {
  status: "abstract_confirmed";
  title: string;
  sourceFactDigest: string;
  nodes: AbstractWorkflowNode[];
  boundaries: string[];
  generatedAt: string;
  gateCRequired: true;
};

export type InterviewConfirmRequest = {
  requestSeq: number;
  snapshot: InterviewSnapshot;
  message: Pick<InterviewMessage, "id" | "content">;
  accept: true;
};

export type InterviewConfirmResponse = {
  snapshot: InterviewSnapshot;
  workflow: AbstractWorkflow;
};

export type GateBErrorCode =
  | "INVALID_INPUT"
  | "REQUEST_OUT_OF_SEQUENCE"
  | "SNAPSHOT_INVALID"
  | "NOT_READY_FOR_CONFIRMATION"
  | "MODEL_NOT_CONFIGURED"
  | "MODEL_TIMEOUT"
  | "MODEL_UPSTREAM_ERROR"
  | "MODEL_OUTPUT_INVALID"
  | "INPUT_TOO_LARGE";

export type GateBErrorResponse = {
  error: { code: GateBErrorCode; message: string };
};
