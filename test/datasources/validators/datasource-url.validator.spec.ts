import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { DatasourceUrlValidator } from "../../../src/datasources/validators/datasource-url.validator";
import { DatasourceSource } from "../../../src/datasources/entities/datasource.entity";

describe("DatasourceUrlValidator", () => {
  let validator: DatasourceUrlValidator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DatasourceUrlValidator],
    }).compile();

    validator = module.get<DatasourceUrlValidator>(DatasourceUrlValidator);
  });

  describe("validate", () => {
    it("should pass validation for tempo datasource with URL", () => {
      expect(() => {
        validator.validate("https://tempo.example.com", DatasourceSource.TEMPO);
      }).not.toThrow();
    });

    it("should pass validation for jaeger datasource with URL", () => {
      expect(() => {
        validator.validate(
          "https://jaeger.example.com",
          DatasourceSource.JAEGER,
        );
      }).not.toThrow();
    });

    it("should throw BadRequestException when URL is missing for tempo datasource", () => {
      expect(() => {
        validator.validate(undefined, DatasourceSource.TEMPO);
      }).toThrow(BadRequestException);
      expect(() => {
        validator.validate(undefined, DatasourceSource.TEMPO);
      }).toThrow("URL is required for datasources");
    });

    it("should throw BadRequestException when URL is missing for jaeger datasource", () => {
      expect(() => {
        validator.validate(undefined, DatasourceSource.JAEGER);
      }).toThrow(BadRequestException);
      expect(() => {
        validator.validate(undefined, DatasourceSource.JAEGER);
      }).toThrow("URL is required for datasources");
    });

    it("should pass validation for clickhouse datasource without URL", () => {
      expect(() => {
        validator.validate(undefined, DatasourceSource.CLICKHOUSE);
      }).not.toThrow();
    });

    it("should pass validation for custom_api datasource without URL", () => {
      expect(() => {
        validator.validate(undefined, DatasourceSource.CUSTOM_API);
      }).not.toThrow();
    });
  });
});
