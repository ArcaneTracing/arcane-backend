jest.mock("@thallesp/nestjs-better-auth", () => ({
  Session:
    () => (target: any, propertyKey: string, parameterIndex: number) => {},
  UserSession: class UserSession {},
}));

jest.mock("../../../src/rbac/guards/org-project-permission.guard", () => ({
  OrgProjectPermissionGuard: jest.fn(() => ({
    canActivate: jest.fn(() => true),
  })),
}));

import { Test, TestingModule } from "@nestjs/testing";
import { TracesController } from "../../../src/traces/traces.controller";
import { TracesService } from "../../../src/traces/services/traces.service";
import { SearchTracesRequestDto } from "../../../src/traces/dto/request/search-traces-request.dto";

type UserSession = {
  session: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    expiresAt: Date;
    token: string;
  };
  user: {
    id: string;
    email?: string;
    name: string;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
};

describe("TracesController", () => {
  let controller: TracesController;
  let service: TracesService;

  const mockService = {
    search: jest.fn(),
    searchByTraceId: jest.fn(),
    getAttributeNames: jest.fn(),
    getAttributeValues: jest.fn(),
  };

  const mockUserSession: UserSession = {
    session: {
      id: "session-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: "user-1",
      expiresAt: new Date(),
      token: "token-1",
    },
    user: {
      id: "user-1",
      email: "user@example.com",
      name: "Test User",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      controllers: [TracesController],
      providers: [
        {
          provide: TracesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<TracesController>(TracesController);
    service = module.get<TracesService>(TracesService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("search", () => {
    const searchParams: SearchTracesRequestDto = {
      limit: 10,
      q: "test",
    };

    const mockSearchResult = {
      traces: [
        {
          traceID: "trace-1",
          rootServiceName: "service-1",
          rootTraceName: "Test Trace",
        },
      ],
    };

    it("should search traces", async () => {
      mockService.search.mockResolvedValue(mockSearchResult);

      const result = await controller.search(
        "org-1",
        "project-1",
        "datasource-1",
        mockUserSession,
        searchParams,
      );

      expect(result).toEqual(mockSearchResult);
      expect(service.search).toHaveBeenCalledWith(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        searchParams,
      );
    });
  });

  describe("searchByTraceId", () => {
    const traceId = "trace-123";
    const mockTraceResult = {
      trace: {
        traceID: traceId,
        rootServiceName: "service-1",
        rootTraceName: "Test Trace",
      },
    };

    it("should search trace by ID", async () => {
      mockService.searchByTraceId.mockResolvedValue(mockTraceResult);

      const result = await controller.searchByTraceId(
        "org-1",
        "project-1",
        "datasource-1",
        mockUserSession,
        traceId,
      );

      expect(result).toEqual(mockTraceResult);
      expect(service.searchByTraceId).toHaveBeenCalledWith(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        traceId,
      );
    });
  });

  describe("getAttributeNames", () => {
    const mockTags = ["tag1", "tag2", "tag3"];

    it("should get all attribute names", async () => {
      mockService.getAttributeNames.mockResolvedValue(mockTags);

      const result = await controller.getAttributeNames(
        "org-1",
        "project-1",
        "datasource-1",
        mockUserSession,
      );

      expect(result).toEqual(mockTags);
      expect(service.getAttributeNames).toHaveBeenCalledWith(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
      );
    });
  });

  describe("getAttributeValues", () => {
    const attributeName = "service.name";
    const mockAttributeValues = ["value1", "value2", "value3"];

    it("should get attribute values", async () => {
      mockService.getAttributeValues.mockResolvedValue(mockAttributeValues);

      const result = await controller.getAttributeValues(
        "org-1",
        "project-1",
        "datasource-1",
        mockUserSession,
        attributeName,
      );

      expect(result).toEqual(mockAttributeValues);
      expect(service.getAttributeValues).toHaveBeenCalledWith(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        attributeName,
      );
    });
  });
});
