export const RAGAS_SCORES = {
  ContextPrecision: {
    id: "16070b12-c49f-4b3b-904f-533e4022d0f4",
    fields: ["user_input", "reference", "retrieved_contexts"],
  },
  ContextUtilisation: {
    id: "04b24ff4-a6f2-4d41-bde7-76bf7bd668b1",
    fields: ["user_input", "response", "retrieved_contexts"],
  },
  LLMContextRecall: {
    id: "c90f0364-481b-4bd5-a162-50897300d5e1",
    fields: ["user_input", "reference", "retrieved_contexts"],
  },
  NonLLMContextRecall: {
    id: "4c11c803-6039-49c8-8c34-24154c92db49",
    fields: ["retrieved_contexts", "reference_contexts"],
  },
  IDBasedContextRecall: {
    id: "a41e87f7-2061-4d8e-83de-f49d219d450e",
    fields: ["retrieved_context_ids", "reference_context_ids"],
  },
  ContextEntityRecall: {
    id: "848d2504-19ae-4f9c-954e-366926206034",
    fields: ["reference", "retrieved_contexts"],
  },
  NoiseSensitivity: {
    id: "d57720d3-4d82-40c8-9e17-a4768e1f5126",
    fields: ["user_input", "response", "reference", "retrieved_contexts"],
  },
  AnswerRelevancy: {
    id: "54056e81-7f85-46a9-98a5-81b75b7a0d4c",
    fields: ["user_input", "response"],
  },
  Faithfulness: {
    id: "ea8c28c7-18c1-40c7-bdf6-b834eddb5be1",
    fields: ["user_input", "response", "retrieved_contexts"],
  },
  NvidiaAnswerAccuracy: {
    id: "99795951-de16-44cb-8c1d-71d100ed36d2",
    fields: ["user_input", "response", "reference"],
  },
  ContextRelevance: {
    id: "1e819871-81f4-4248-a681-c653e1910939",
    fields: ["user_input", "retrieved_contexts"],
  },
  ResponseGroundness: {
    id: "7cadef69-f9b8-4dc7-b9eb-7245b1e3a3dc",
    fields: ["response", "retrieved_contexts"],
  },
  TopicAdherenceScore: {
    id: "5b0b6ec0-4a87-407f-a032-c2d5f9511569",
    fields: ["user_input", "reference_topics"],
  },
  ToolCallAccuracy: {
    id: "a52fe55c-5a19-476d-be53-6844891ee435",
    fields: ["user_input", "reference_tool_calls"],
  },
  ToolCallF1: {
    id: "5d9ea1e9-9f07-43d3-b22b-0431383bdd9d",
    fields: ["user_input", "reference_tool_calls"],
  },
  AgentGoalAccuracyWithReference: {
    id: "0b0dcd87-1c11-41e9-ad93-39911014c120",
    fields: ["user_input", "reference"],
  },
  FactualCorrectness: {
    id: "0d5a785c-748b-465f-b96f-6f9c7604f645",
    fields: ["response", "reference"],
  },
  NonLLMStringSimilarity: {
    id: "6eb8a58c-4419-4500-bdec-7b9b2f3fa5a8",
    fields: ["reference", "response"],
  },
  BleuScore: {
    id: "34704532-c2c8-403e-8114-09755a281969",
    fields: ["reference", "response"],
  },
  ChrfScore: {
    id: "edea8a30-999c-4b0e-9779-dc680d83a9c0",
    fields: ["response", "reference"],
  },
  RougeScore: {
    id: "b75661d8-0d69-41d2-abdb-f99800b98391",
    fields: ["reference", "response"],
  },
  StringPresence: {
    id: "a0fed9fb-075f-4c9d-9be9-093879ec04ad",
    fields: ["reference", "response"],
  },
  ExactMatch: {
    id: "ceeaa1d8-58d0-4bde-9bb6-b9380163b706",
    fields: ["reference", "response"],
  },
};
