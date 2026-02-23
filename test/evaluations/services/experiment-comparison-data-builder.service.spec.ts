import { ExperimentComparisonDataBuilder } from "../../../src/evaluations/services/comparison/experiment-comparison-data-builder.service";

describe("ExperimentComparisonDataBuilder", () => {
  const mockManagerQuery = jest.fn();
  const mockExperimentResultRepository = {
    createQueryBuilder: jest.fn(),
    manager: { query: jest.fn() },
  };
  const mockScoreResultRepository = {
    find: jest.fn(),
    manager: { query: mockManagerQuery },
  };

  let service: ExperimentComparisonDataBuilder;

  beforeEach(() => {
    jest.clearAllMocks();
    mockScoreResultRepository.manager = { query: mockManagerQuery };
    service = new ExperimentComparisonDataBuilder(
      mockExperimentResultRepository as any,
      mockScoreResultRepository as any,
    );
  });

  it("builds experiment result maps for both experiments", async () => {
    mockManagerQuery
      .mockResolvedValueOnce([
        { id: "er-1", datasetRowId: "row-1" },
        { id: "er-2", datasetRowId: "row-2" },
      ])
      .mockResolvedValueOnce([{ id: "er-3", datasetRowId: "row-1" }]);

    const result = await service.buildExperimentResultMaps("exp-a", "exp-b");

    expect(result.mapA.get("row-1")).toBe("er-1");
    expect(result.mapA.get("row-2")).toBe("er-2");
    expect(result.mapB.get("row-1")).toBe("er-3");
    expect(mockManagerQuery).toHaveBeenCalledTimes(2);
  });

  it("extracts score values as strings and ignores nulls", () => {
    const map = service.extractScoreValuesAsStrings([
      { experimentResultId: "er-1", value: "A" } as any,
      { experimentResultId: "er-2", value: null } as any,
      { experimentResultId: null, value: "B" } as any,
    ]);

    expect(map.size).toBe(1);
    expect(map.get("er-1")).toBe("A");
  });

  it("extracts score values as numbers and ignores NaN", () => {
    const map = service.extractScoreValuesAsNumbers([
      { experimentResultId: "er-1", value: 1 } as any,
      { experimentResultId: "er-2", value: "2" } as any,
      { experimentResultId: "er-3", value: "x" } as any,
    ]);

    expect(map.size).toBe(2);
    expect(map.get("er-2")).toBe(2);
  });

  it("builds paired data for strings only when both sides exist", () => {
    const paired = service.buildPairedDataForStrings(
      ["row-1", "row-2"],
      new Map([["row-1", "er-a"]]),
      new Map([["row-1", "er-b"]]),
      new Map([
        ["er-a", "A"],
        ["er-b", "B"],
      ]),
    );

    expect(paired).toEqual([{ valueA: "A", valueB: "B" }]);
  });

  it("finds common dataset row IDs", () => {
    const common = service.findCommonDatasetRowIds(
      new Map([
        ["row-1", "er-1"],
        ["row-2", "er-2"],
      ]),
      new Map([["row-2", "er-3"]]),
    );

    expect(common).toEqual(["row-2"]);
  });
});
