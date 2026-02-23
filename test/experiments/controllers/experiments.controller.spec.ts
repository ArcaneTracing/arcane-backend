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
import { ExperimentsController } from "../../../src/experiments/controllers/experiments.controller";
import { ExperimentsService } from "../../../src/experiments/services/experiments.service";
import { CreateExperimentRequestDto } from "../../../src/experiments/dto/request/create-experiment-request.dto";
import { CreateExperimentResultRequestDto } from "../../../src/experiments/dto/request/create-experiment-result-request.dto";

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

describe("ExperimentsController", () => {
  let controller: ExperimentsController;
  let service: ExperimentsService;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    rerun: jest.fn(),
    remove: jest.fn(),
    createResult: jest.fn(),
    listResults: jest.fn(),
    listResultsPaginated: jest.fn(),
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
      controllers: [ExperimentsController],
      providers: [
        {
          provide: ExperimentsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ExperimentsController>(ExperimentsController);
    service = module.get<ExperimentsService>(ExperimentsService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create an experiment", async () => {
    const dto: CreateExperimentRequestDto = {
      name: "Experiment",
      description: "desc",
      promptVersionId: "prompt-version-1",
      datasetId: "dataset-1",
      promptInputMappings: {},
    };
    const mockResult = { id: "experiment-1" };
    mockService.create.mockResolvedValue(mockResult);

    const result = await controller.create(
      "org-1",
      "project-1",
      dto,
      mockUserSession,
    );

    expect(result).toEqual(mockResult);
    expect(service.create).toHaveBeenCalledWith(
      "project-1",
      dto,
      mockUserSession.user.id,
      "org-1",
    );
  });

  it("should list experiments", async () => {
    const mockResult = [{ id: "experiment-1" }];
    mockService.findAll.mockResolvedValue(mockResult);

    const result = await controller.findAll("org-1", "project-1");

    expect(result).toEqual(mockResult);
    expect(service.findAll).toHaveBeenCalledWith("project-1");
  });

  it("should get an experiment", async () => {
    const mockResult = { id: "experiment-1" };
    mockService.findOne.mockResolvedValue(mockResult);

    const result = await controller.findOne(
      "org-1",
      "project-1",
      "experiment-1",
    );

    expect(result).toEqual(mockResult);
    expect(service.findOne).toHaveBeenCalledWith("project-1", "experiment-1");
  });

  it("should rerun an experiment", async () => {
    const mockResult = { id: "experiment-2" };
    mockService.rerun.mockResolvedValue(mockResult);

    const result = await controller.rerun(
      "org-1",
      "project-1",
      "experiment-1",
      mockUserSession,
    );

    expect(result).toEqual(mockResult);
    expect(service.rerun).toHaveBeenCalledWith(
      "project-1",
      "experiment-1",
      "user-1",
      "org-1",
    );
  });

  it("should remove an experiment", async () => {
    mockService.remove.mockResolvedValue(undefined);

    await controller.remove(
      "org-1",
      "project-1",
      "experiment-1",
      mockUserSession,
    );

    expect(service.remove).toHaveBeenCalledWith(
      "project-1",
      "experiment-1",
      mockUserSession.user.id,
      "org-1",
    );
  });

  it("should create an experiment result", async () => {
    const dto: CreateExperimentResultRequestDto = {
      datasetRowId: "row-1",
      result: "ok",
    };
    const mockResult = { id: "result-1" };
    mockService.createResult.mockResolvedValue(mockResult);

    const result = await controller.createResult(
      "org-1",
      "project-1",
      "experiment-1",
      dto,
    );

    expect(result).toEqual(mockResult);
    expect(service.createResult).toHaveBeenCalledWith(
      "project-1",
      "experiment-1",
      dto,
    );
  });

  it("should list paginated experiment results", async () => {
    const mockResult = {
      data: [{ id: "result-1" }],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
    mockService.listResultsPaginated.mockResolvedValue(mockResult);

    const query = { page: 1, limit: 20 };
    const result = await controller.listResults(
      "org-1",
      "project-1",
      "experiment-1",
      query,
    );

    expect(result).toEqual(mockResult);
    expect(service.listResultsPaginated).toHaveBeenCalledWith(
      "project-1",
      "experiment-1",
      query,
    );
  });
});
