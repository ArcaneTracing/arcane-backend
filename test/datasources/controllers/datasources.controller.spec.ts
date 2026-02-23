jest.mock("@thallesp/nestjs-better-auth", () => ({
  Session:
    () => (target: any, propertyKey: string, parameterIndex: number) => {},
  UserSession: class UserSession {},
}));

jest.mock("../../../src/rbac/guards/org-permission.guard", () => ({
  OrgPermissionGuard: jest.fn(() => ({
    canActivate: jest.fn(() => true),
  })),
}));

import { Test, TestingModule } from "@nestjs/testing";
import { DatasourcesController } from "../../../src/datasources/controllers/datasources.controller";
import { DatasourcesService } from "../../../src/datasources/services/datasources.service";
import { DatasourceConnectivityService } from "../../../src/datasources/services/datasource-connectivity.service";
import {
  CreateDatasourceDto,
  UpdateDatasourceDto,
} from "../../../src/datasources/dto/request/create-datasource.dto";
import { DatasourceResponseDto } from "../../../src/datasources/dto/response/datasource-response.dto";
import { DatasourceListItemResponseDto } from "../../../src/datasources/dto/response/datasource-list-item-response.dto";
import { DatasourceMessageResponseDto } from "../../../src/datasources/dto/response/datasource-message-response.dto";
import {
  DatasourceType,
  DatasourceSource,
} from "../../../src/datasources/entities/datasource.entity";

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

describe("DatasourcesController", () => {
  let controller: DatasourcesController;
  let datasourcesService: DatasourcesService;

  const mockDatasourcesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findAllListItems: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockDatasourceConnectivityService = {
    testConnection: jest.fn(),
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
      email: "test@example.com",
      name: "Test User",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const mockDatasourceResponseDto: DatasourceResponseDto = {
    id: "datasource-1",
    name: "Test Datasource",
    description: "Test Description",
    url: "https://example.com",
    type: DatasourceType.TRACES,
    source: DatasourceSource.TEMPO,
    config: null,
    isSearchByQueryEnabled: true,
    isSearchByAttributesEnabled: true,
    isGetAttributeNamesEnabled: true,
    isGetAttributeValuesEnabled: true,
  };

  const mockDatasourceListItemResponseDto: DatasourceListItemResponseDto = {
    id: "datasource-1",
    name: "Test Datasource",
    description: "Test Description",
    type: DatasourceType.TRACES,
    source: DatasourceSource.TEMPO,
    isSearchByQueryEnabled: true,
    isSearchByAttributesEnabled: true,
    isGetAttributeNamesEnabled: true,
    isGetAttributeValuesEnabled: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DatasourcesController],
      providers: [
        {
          provide: DatasourcesService,
          useValue: mockDatasourcesService,
        },
        {
          provide: DatasourceConnectivityService,
          useValue: mockDatasourceConnectivityService,
        },
      ],
    }).compile();

    controller = module.get<DatasourcesController>(DatasourcesController);
    datasourcesService = module.get<DatasourcesService>(DatasourcesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    it("should create a datasource", async () => {
      const createDto: CreateDatasourceDto = {
        name: "Test Datasource",
        description: "Test Description",
        url: "https://example.com",
        type: DatasourceType.TRACES,
        source: DatasourceSource.TEMPO,
      };
      mockDatasourcesService.create.mockResolvedValue(
        mockDatasourceResponseDto,
      );

      const result = await controller.create(
        "org-1",
        createDto,
        mockUserSession,
      );

      expect(result).toEqual(mockDatasourceResponseDto);
      expect(datasourcesService.create).toHaveBeenCalledWith(
        "org-1",
        mockUserSession.user.id,
        createDto,
      );
    });
  });

  describe("findAll", () => {
    it("should return all datasources for an organisation", async () => {
      mockDatasourcesService.findAll.mockResolvedValue([
        mockDatasourceResponseDto,
      ]);

      const result = await controller.findAll("org-1");

      expect(result).toEqual([mockDatasourceResponseDto]);
      expect(datasourcesService.findAll).toHaveBeenCalledWith("org-1");
    });
  });

  describe("findAllListItems", () => {
    it("should return all datasource list items for an organisation", async () => {
      mockDatasourcesService.findAllListItems.mockResolvedValue([
        mockDatasourceListItemResponseDto,
      ]);

      const result = await controller.findAllListItems("org-1");

      expect(result).toEqual([mockDatasourceListItemResponseDto]);
      expect(datasourcesService.findAllListItems).toHaveBeenCalledWith("org-1");
    });
  });

  describe("update", () => {
    it("should update a datasource", async () => {
      const updateDto: UpdateDatasourceDto = {
        name: "Updated Datasource",
      };
      const updatedDatasource = {
        ...mockDatasourceResponseDto,
        name: "Updated Datasource",
      };
      mockDatasourcesService.update.mockResolvedValue(updatedDatasource);

      const result = await controller.update(
        "org-1",
        "datasource-1",
        updateDto,
        mockUserSession,
      );

      expect(result).toEqual(updatedDatasource);
      expect(datasourcesService.update).toHaveBeenCalledWith(
        "org-1",
        "datasource-1",
        updateDto,
        mockUserSession?.user?.id,
      );
    });
  });

  describe("remove", () => {
    it("should remove a datasource", async () => {
      const messageResponse: DatasourceMessageResponseDto = {
        message: "Datasource deleted successfully",
      };
      mockDatasourcesService.remove.mockResolvedValue(messageResponse);

      const result = await controller.remove(
        "org-1",
        "datasource-1",
        mockUserSession,
      );

      expect(result).toEqual(messageResponse);
      expect(datasourcesService.remove).toHaveBeenCalledWith(
        "org-1",
        "datasource-1",
        mockUserSession?.user?.id,
      );
    });
  });
});
