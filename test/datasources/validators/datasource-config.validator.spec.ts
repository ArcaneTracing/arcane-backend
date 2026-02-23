import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { DatasourceConfigValidator } from "../../../src/datasources/validators/datasource-config.validator";
import { DatasourceUrlValidator } from "../../../src/datasources/validators/datasource-url.validator";
import { ClickHouseConfigValidator } from "../../../src/datasources/validators/clickhouse-config.validator";
import { CustomApiConfigValidator } from "../../../src/datasources/validators/custom-api-config.validator";
import { DatasourceSource } from "../../../src/datasources/entities/datasource.entity";

describe("DatasourceConfigValidator", () => {
  let validator: DatasourceConfigValidator;
  let urlValidator: DatasourceUrlValidator;
  let clickHouseConfigValidator: ClickHouseConfigValidator;
  let customApiConfigValidator: CustomApiConfigValidator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatasourceConfigValidator,
        DatasourceUrlValidator,
        ClickHouseConfigValidator,
        CustomApiConfigValidator,
      ],
    }).compile();

    validator = module.get<DatasourceConfigValidator>(
      DatasourceConfigValidator,
    );
    urlValidator = module.get<DatasourceUrlValidator>(DatasourceUrlValidator);
    clickHouseConfigValidator = module.get<ClickHouseConfigValidator>(
      ClickHouseConfigValidator,
    );
    customApiConfigValidator = module.get<CustomApiConfigValidator>(
      CustomApiConfigValidator,
    );
  });

  describe("validate", () => {
    it("should call urlValidator for all sources", () => {
      const urlValidatorSpy = jest.spyOn(urlValidator, "validate");

      validator.validate("https://tempo.example.com", DatasourceSource.TEMPO);

      expect(urlValidatorSpy).toHaveBeenCalledWith(
        "https://tempo.example.com",
        DatasourceSource.TEMPO,
      );
    });

    it("should call clickHouseConfigValidator for ClickHouse source", () => {
      const clickHouseValidatorSpy = jest.spyOn(
        clickHouseConfigValidator,
        "validate",
      );
      const config = {
        clickhouse: {
          host: "localhost",
          database: "testdb",
          tableName: "traces",
        },
      };

      validator.validate(
        "https://clickhouse.example.com",
        DatasourceSource.CLICKHOUSE,
        config,
      );

      expect(clickHouseValidatorSpy).toHaveBeenCalledWith(
        "https://clickhouse.example.com",
        config,
      );
    });

    it("should call customApiConfigValidator for Custom API source", () => {
      const customApiValidatorSpy = jest.spyOn(
        customApiConfigValidator,
        "validate",
      );
      const config = {
        customApi: {
          baseUrl: "https://api.example.com",
          endpoints: {
            search: { path: "/search" },
            searchByTraceId: { path: "/trace/{traceId}" },
          },
        },
      };

      validator.validate(null, DatasourceSource.CUSTOM_API, config);

      expect(customApiValidatorSpy).toHaveBeenCalledWith(null, config);
    });

    it("should not call clickHouseConfigValidator for non-ClickHouse sources", () => {
      const clickHouseValidatorSpy = jest.spyOn(
        clickHouseConfigValidator,
        "validate",
      );

      validator.validate("https://tempo.example.com", DatasourceSource.TEMPO);

      expect(clickHouseValidatorSpy).not.toHaveBeenCalled();
    });

    it("should not call customApiConfigValidator for non-Custom API sources", () => {
      const customApiValidatorSpy = jest.spyOn(
        customApiConfigValidator,
        "validate",
      );

      validator.validate("https://tempo.example.com", DatasourceSource.TEMPO);

      expect(customApiValidatorSpy).not.toHaveBeenCalled();
    });

    it("should propagate errors from urlValidator", () => {
      expect(() => {
        validator.validate(undefined, DatasourceSource.TEMPO);
      }).toThrow(BadRequestException);
      expect(() => {
        validator.validate(undefined, DatasourceSource.TEMPO);
      }).toThrow("URL is required for datasources");
    });

    it("should propagate errors from clickHouseConfigValidator for missing URL and config", () => {
      expect(() => {
        validator.validate(undefined, DatasourceSource.CLICKHOUSE, null);
      }).toThrow(BadRequestException);
      expect(() => {
        validator.validate(undefined, DatasourceSource.CLICKHOUSE, null);
      }).toThrow(
        "URL or config.clickhouse is required for ClickHouse datasources",
      );
    });

    it("should propagate errors from clickHouseConfigValidator for incomplete config", () => {
      const config = {
        clickhouse: {
          host: "localhost",
        },
      };
      expect(() => {
        validator.validate(undefined, DatasourceSource.CLICKHOUSE, config);
      }).toThrow(BadRequestException);
      expect(() => {
        validator.validate(undefined, DatasourceSource.CLICKHOUSE, config);
      }).toThrow(
        "ClickHouse config must include host, database, and tableName",
      );
    });

    it("should propagate errors from customApiConfigValidator", () => {
      const config = {
        customApi: {
          baseUrl: "https://api.example.com",
          endpoints: {
            search: { path: "/search" },
          },
        },
      };
      expect(() => {
        validator.validate(null, DatasourceSource.CUSTOM_API, config);
      }).toThrow(BadRequestException);
      expect(() => {
        validator.validate(null, DatasourceSource.CUSTOM_API, config);
      }).toThrow(
        "Custom API config must include endpoints.searchByTraceId.path",
      );
    });
  });
});
