import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { ClickHouseConfigValidator } from "../../../src/datasources/validators/clickhouse-config.validator";

describe("ClickHouseConfigValidator", () => {
  let validator: ClickHouseConfigValidator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClickHouseConfigValidator],
    }).compile();

    validator = module.get<ClickHouseConfigValidator>(
      ClickHouseConfigValidator,
    );
  });

  describe("validate", () => {
    it("should pass validation when URL is provided", () => {
      expect(() => {
        validator.validate("https://clickhouse.example.com", null);
      }).not.toThrow();
    });

    it("should pass validation when config.clickhouse is provided", () => {
      const config = {
        clickhouse: {
          host: "localhost",
          database: "testdb",
          tableName: "traces",
        },
      };
      expect(() => {
        validator.validate(undefined, config);
      }).not.toThrow();
    });

    it("should throw BadRequestException when neither URL nor config.clickhouse is provided", () => {
      expect(() => {
        validator.validate(undefined, null);
      }).toThrow(BadRequestException);
      expect(() => {
        validator.validate(undefined, null);
      }).toThrow(
        "URL or config.clickhouse is required for ClickHouse datasources",
      );
    });

    it("should pass validation when config is null but URL is provided", () => {
      expect(() => {
        validator.validate("https://clickhouse.example.com", null);
      }).not.toThrow();
    });

    it("should pass validation when config is undefined but URL is provided", () => {
      expect(() => {
        validator.validate("https://clickhouse.example.com", undefined);
      }).not.toThrow();
    });

    it("should pass validation when config.clickhouse is not present but URL is provided", () => {
      const config = {
        other: "value",
      };
      expect(() => {
        validator.validate("https://clickhouse.example.com", config);
      }).not.toThrow();
    });

    it("should pass validation when config.clickhouse has all required fields", () => {
      const config = {
        clickhouse: {
          host: "localhost",
          database: "testdb",
          tableName: "traces",
        },
      };
      expect(() => {
        validator.validate(undefined, config);
      }).not.toThrow();
    });

    it("should throw BadRequestException when config.clickhouse missing host", () => {
      const config = {
        clickhouse: {
          database: "testdb",
          tableName: "traces",
        },
      };
      expect(() => {
        validator.validate(undefined, config);
      }).toThrow(BadRequestException);
      expect(() => {
        validator.validate(undefined, config);
      }).toThrow(
        "ClickHouse config must include host, database, and tableName",
      );
    });

    it("should throw BadRequestException when config.clickhouse missing database", () => {
      const config = {
        clickhouse: {
          host: "localhost",
          tableName: "traces",
        },
      };
      expect(() => {
        validator.validate(undefined, config);
      }).toThrow(BadRequestException);
      expect(() => {
        validator.validate(undefined, config);
      }).toThrow(
        "ClickHouse config must include host, database, and tableName",
      );
    });

    it("should throw BadRequestException when config.clickhouse missing tableName", () => {
      const config = {
        clickhouse: {
          host: "localhost",
          database: "testdb",
        },
      };
      expect(() => {
        validator.validate(undefined, config);
      }).toThrow(BadRequestException);
      expect(() => {
        validator.validate(undefined, config);
      }).toThrow(
        "ClickHouse config must include host, database, and tableName",
      );
    });

    it("should throw BadRequestException when config.clickhouse missing all required fields", () => {
      const config = {
        clickhouse: {},
      };
      expect(() => {
        validator.validate(undefined, config);
      }).toThrow(BadRequestException);
      expect(() => {
        validator.validate(undefined, config);
      }).toThrow(
        "ClickHouse config must include host, database, and tableName",
      );
    });
  });
});
