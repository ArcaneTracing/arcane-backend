import { DatasetMapper } from "../../../src/datasets/mappers/dataset.mapper";
import { Dataset } from "../../../src/datasets/entities/dataset.entity";
import { DatasetRow } from "../../../src/datasets/entities/dataset-row.entity";

describe("DatasetMapper", () => {
  describe("toRowDto", () => {
    it("should map dataset row to response dto", () => {
      const row = new DatasetRow();
      row.id = "row-1";
      row.values = ["a", "b"];

      const result = DatasetMapper.toRowDto(row);

      expect(result).toEqual({
        id: "row-1",
        values: ["a", "b"],
      });
    });
  });

  describe("toDto", () => {
    it("should map dataset and rows to response dto", () => {
      const dataset = new Dataset();
      dataset.id = "dataset-1";
      dataset.name = "Dataset";
      dataset.description = "Description";
      dataset.header = ["col1", "col2"];
      dataset.createdAt = new Date("2024-01-01T00:00:00Z");
      dataset.updatedAt = new Date("2024-01-02T00:00:00Z");

      const rows = [
        { id: "row-1", values: ["a"] },
        { id: "row-2", values: ["b"] },
      ];

      const result = DatasetMapper.toDto(dataset, rows);

      expect(result).toEqual({
        id: "dataset-1",
        name: "Dataset",
        description: "Description",
        header: ["col1", "col2"],
        rows,
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-02T00:00:00Z"),
      });
    });
  });

  describe("toListItemDto", () => {
    it("should map dataset to list item dto", () => {
      const dataset = new Dataset();
      dataset.id = "dataset-1";
      dataset.name = "Dataset";
      dataset.description = "Description";
      dataset.createdAt = new Date("2024-01-01T00:00:00Z");
      dataset.updatedAt = new Date("2024-01-02T00:00:00Z");

      const result = DatasetMapper.toListItemDto(dataset);

      expect(result).toEqual({
        id: "dataset-1",
        name: "Dataset",
        description: "Description",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        updatedAt: new Date("2024-01-02T00:00:00Z"),
      });
    });
  });
});
