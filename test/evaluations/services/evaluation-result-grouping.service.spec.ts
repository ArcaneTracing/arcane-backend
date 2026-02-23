import { EvaluationResultGroupingService } from "../../../src/evaluations/services/results/evaluation-result-grouping.service";

describe("EvaluationResultGroupingService", () => {
  let service: EvaluationResultGroupingService;

  beforeEach(() => {
    service = new EvaluationResultGroupingService();
  });

  it("groups results by datasetRowId and filters nulls", () => {
    const results = service.groupResultsByDatasetRow([
      { datasetRowId: "row-1" } as any,
      { datasetRowId: null } as any,
      { datasetRowId: "row-1" } as any,
      { datasetRowId: "row-2" } as any,
    ]);

    expect(results.size).toBe(2);
    expect(results.get("row-1")?.length).toBe(2);
    expect(results.get("row-2")?.length).toBe(1);
  });

  it("groups results by datasetRowId and experimentResultId and filters nulls", () => {
    const results = service.groupResultsByDatasetRowAndExperiment([
      { datasetRowId: "row-1", experimentResultId: "exp-1" } as any,
      { datasetRowId: "row-1", experimentResultId: null } as any,
      { datasetRowId: null, experimentResultId: "exp-1" } as any,
      { datasetRowId: "row-2", experimentResultId: "exp-2" } as any,
    ]);

    expect(results.size).toBe(2);
    expect(results.get("row-1::exp-1")?.length).toBe(1);
    expect(results.get("row-2::exp-2")?.length).toBe(1);
  });
});
