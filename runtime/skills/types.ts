export type JsonSchema = Record<string, unknown>;

export type RuntimeControl =
  | "deterministic"
  | "model"
  | "human_gate";

export type RuntimeSkillDefinition<
  TInput = unknown,
  TOutput = unknown,
> = {
  id: string;
  slug: string;
  version: string;
  nameZh: string;
  descriptionZh: string;
  control: RuntimeControl;
  systemInstruction: string | null;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  limitationsZh: string[];
  qualityRulesZh: string[];
  /** Compile-time anchors for runtimes that want typed request/response bodies. */
  _input?: TInput;
  _output?: TOutput;
};

export type WorkflowStage = {
  id: string;
  skillSlug: string;
  control: RuntimeControl;
  dependsOn: string[];
  blocksDownstream: boolean;
  descriptionZh: string;
};

export type EvaluationFixture<TInput, TExpected = Record<string, unknown>> = {
  id: string;
  nameZh: string;
  input: TInput;
  expected: TExpected;
};
