import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { CustomApiConfigValidator } from "../../../src/datasources/validators/custom-api-config.validator";

describe("CustomApiConfigValidator", () => {
  let validator: CustomApiConfigValidator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CustomApiConfigValidator],
    }).compile();

    validator = module.get<CustomApiConfigValidator>(CustomApiConfigValidator);
  });

  describe("validate", () => {
    it("should pass validation when config.customApi is not present", () => {
      const config = {
        other: "value",
      };
      expect(() => {
        validator.validate("https://api.example.com", config);
      }).not.toThrow();
    });

    it("should pass validation when config is null", () => {
      expect(() => {
        validator.validate("https://api.example.com", null);
      }).not.toThrow();
    });

    it("should pass validation when config is undefined", () => {
      expect(() => {
        validator.validate("https://api.example.com", undefined);
      }).not.toThrow();
    });

    it("should pass validation with baseUrl in config", () => {
      const config = {
        customApi: {
          baseUrl: "https://api.example.com",
          endpoints: {
            search: { path: "/search" },
            searchByTraceId: { path: "/trace/{traceId}" },
          },
        },
      };
      expect(() => {
        validator.validate(null, config);
      }).not.toThrow();
    });

    it("should pass validation with URL provided", () => {
      const config = {
        customApi: {
          endpoints: {
            search: { path: "/search" },
            searchByTraceId: { path: "/trace/{traceId}" },
          },
        },
      };
      expect(() => {
        validator.validate("https://api.example.com", config);
      }).not.toThrow();
    });

    it("should throw BadRequestException when baseUrl and URL are both missing", () => {
      const config = {
        customApi: {
          endpoints: {
            search: { path: "/search" },
            searchByTraceId: { path: "/trace/{traceId}" },
          },
        },
      };
      expect(() => {
        validator.validate(null, config);
      }).toThrow(BadRequestException);
      expect(() => {
        validator.validate(null, config);
      }).toThrow(
        "Custom API config must include baseUrl or datasource.url must be provided",
      );
    });

    it("should throw BadRequestException when endpoints.search.path is missing", () => {
      const config = {
        customApi: {
          baseUrl: "https://api.example.com",
          endpoints: {
            searchByTraceId: { path: "/trace/{traceId}" },
          },
        },
      };
      expect(() => {
        validator.validate(null, config);
      }).toThrow(BadRequestException);
      expect(() => {
        validator.validate(null, config);
      }).toThrow("Custom API config must include endpoints.search.path");
    });

    it("should throw BadRequestException when endpoints.searchByTraceId.path is missing", () => {
      const config = {
        customApi: {
          baseUrl: "https://api.example.com",
          endpoints: {
            search: { path: "/search" },
          },
        },
      };
      expect(() => {
        validator.validate(null, config);
      }).toThrow(BadRequestException);
      expect(() => {
        validator.validate(null, config);
      }).toThrow(
        "Custom API config must include endpoints.searchByTraceId.path",
      );
    });

    it("should throw BadRequestException when searchByTraceId path does not contain {traceId} placeholder", () => {
      const config = {
        customApi: {
          baseUrl: "https://api.example.com",
          endpoints: {
            search: { path: "/search" },
            searchByTraceId: { path: "/trace" },
          },
        },
      };
      expect(() => {
        validator.validate(null, config);
      }).toThrow(BadRequestException);
      expect(() => {
        validator.validate(null, config);
      }).toThrow(
        "Custom API endpoints.searchByTraceId.path must contain {traceId} placeholder",
      );
    });

    it("should throw BadRequestException when getAttributeNames enabled but endpoint missing", () => {
      const config = {
        customApi: {
          baseUrl: "https://api.example.com",
          endpoints: {
            search: { path: "/search" },
            searchByTraceId: { path: "/trace/{traceId}" },
          },
          capabilities: {
            getAttributeNames: true,
          },
        },
      };
      expect(() => {
        validator.validate(null, config);
      }).toThrow(BadRequestException);
      expect(() => {
        validator.validate(null, config);
      }).toThrow(
        "Custom API config must include endpoints.attributeNames.path when getAttributeNames capability is enabled",
      );
    });

    it("should throw BadRequestException when getAttributeValues enabled but endpoint missing", () => {
      const config = {
        customApi: {
          baseUrl: "https://api.example.com",
          endpoints: {
            search: { path: "/search" },
            searchByTraceId: { path: "/trace/{traceId}" },
          },
          capabilities: {
            getAttributeValues: true,
          },
        },
      };
      expect(() => {
        validator.validate(null, config);
      }).toThrow(BadRequestException);
      expect(() => {
        validator.validate(null, config);
      }).toThrow(
        "Custom API config must include endpoints.attributeValues.path when getAttributeValues capability is enabled",
      );
    });

    it("should throw BadRequestException when getAttributeValues enabled but path missing {attributeName} placeholder", () => {
      const config = {
        customApi: {
          baseUrl: "https://api.example.com",
          endpoints: {
            search: { path: "/search" },
            searchByTraceId: { path: "/trace/{traceId}" },
            attributeValues: { path: "/values" },
          },
          capabilities: {
            getAttributeValues: true,
          },
        },
      };
      expect(() => {
        validator.validate(null, config);
      }).toThrow(BadRequestException);
      expect(() => {
        validator.validate(null, config);
      }).toThrow(
        "Custom API endpoints.attributeValues.path must contain {attributeName} placeholder",
      );
    });

    it("should pass validation when all required endpoints and capabilities are configured", () => {
      const config = {
        customApi: {
          baseUrl: "https://api.example.com",
          endpoints: {
            search: { path: "/search" },
            searchByTraceId: { path: "/trace/{traceId}" },
            attributeNames: { path: "/attributes" },
            attributeValues: { path: "/attributes/{attributeName}/values" },
          },
          capabilities: {
            getAttributeNames: true,
            getAttributeValues: true,
          },
        },
      };
      expect(() => {
        validator.validate(null, config);
      }).not.toThrow();
    });

    it("should pass validation when capabilities are disabled", () => {
      const config = {
        customApi: {
          baseUrl: "https://api.example.com",
          endpoints: {
            search: { path: "/search" },
            searchByTraceId: { path: "/trace/{traceId}" },
          },
          capabilities: {
            getAttributeNames: false,
            getAttributeValues: false,
          },
        },
      };
      expect(() => {
        validator.validate(null, config);
      }).not.toThrow();
    });
  });
});
