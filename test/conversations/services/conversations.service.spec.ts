import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { ConversationsService } from "../../../src/conversations/conversations.service";
import { DatasourcesService } from "../../../src/datasources/services/datasources.service";
import { ConversationConfigService } from "../../../src/conversation-configuration/services/conversation-config.service";
import { ProjectManagementService } from "../../../src/projects/services/project-management.service";
import { ConversationRepositoryFactory } from "../../../src/conversations/backends/conversation-repository.factory";
import { TraceAttributeObfuscationService } from "../../../src/traces/services/trace-attribute-obfuscation.service";
import {
  Datasource,
  DatasourceSource,
} from "../../../src/datasources/entities/datasource.entity";
import { ConversationConfiguration } from "../../../src/conversation-configuration/entities/conversation-configuration.entity";
import { GetConversationsRequestDto } from "../../../src/conversations/dto/request/get-conversations-request.dto";
import { GetFullConversationRequestDto } from "../../../src/conversations/dto/request/get-full-conversation-request.dto";
import { GetConversationsByTracesRequestDto } from "../../../src/conversations/dto/request/get-conversations-by-traces-request.dto";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../../src/common/constants/error-messages.constants";

const tempoConvTraceJson = require("../resources/tempo/conv-trace-response.json");

describe("ConversationsService", () => {
  let service: ConversationsService;
  let datasourcesService: DatasourcesService;
  let conversationConfigService: ConversationConfigService;
  let conversationRepositoryFactory: ConversationRepositoryFactory;

  const mockDatasourcesService = {
    findById: jest.fn(),
  };

  const mockConversationConfigService = {
    findById: jest.fn(),
  };

  const mockConversationRepository = {
    getConversations: jest.fn(),
    getFullConversation: jest.fn(),
    getConversationsByTraceIds: jest.fn(),
  };

  const mockConversationRepositoryFactory = {
    getRepository: jest.fn(),
  };

  const mockProject = {
    id: "project-1",
    traceFilterAttributeName: undefined,
    traceFilterAttributeValue: undefined,
  };

  const mockProjectManagementService = {
    getByIdAndOrganisationOrThrow: jest.fn().mockResolvedValue(mockProject),
  };

  const mockTraceAttributeObfuscationService = {
    obfuscateTrace: jest.fn(),
    obfuscateTraceResponse: jest.fn((trace) => Promise.resolve(trace)),
  };

  const mockDatasource: Datasource = {
    id: "datasource-1",
    name: "Test Datasource",
    description: "Test Description",
    url: "https://example.com",
    type: "traces" as any,
    source: DatasourceSource.TEMPO,
    organisationId: "org-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: "user-1",
    projectId: "project-1",
  } as unknown as Datasource;

  const mockConversationConfig: ConversationConfiguration = {
    id: "config-1",
    name: "Test Config",
    description: "Test Description",
    stitchingAttributesName: ["session.id"],
    organisationId: "org-1",
    organisation: null as any,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        ConversationsService,
        {
          provide: DatasourcesService,
          useValue: mockDatasourcesService,
        },
        {
          provide: ConversationConfigService,
          useValue: mockConversationConfigService,
        },
        {
          provide: ProjectManagementService,
          useValue: mockProjectManagementService,
        },
        {
          provide: ConversationRepositoryFactory,
          useValue: mockConversationRepositoryFactory,
        },
        {
          provide: TraceAttributeObfuscationService,
          useValue: mockTraceAttributeObfuscationService,
        },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
    datasourcesService = module.get<DatasourcesService>(DatasourcesService);
    conversationConfigService = module.get<ConversationConfigService>(
      ConversationConfigService,
    );
    conversationRepositoryFactory = module.get<ConversationRepositoryFactory>(
      ConversationRepositoryFactory,
    );
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    mockProjectManagementService.getByIdAndOrganisationOrThrow.mockResolvedValue(
      mockProject,
    );
    mockTraceAttributeObfuscationService.obfuscateTraceResponse.mockImplementation(
      (trace) => Promise.resolve(trace),
    );
  });

  describe("getConversations", () => {
    const query: GetConversationsRequestDto = {
      start: "2024-01-01T00:00:00.000Z",
      end: "2024-01-02T00:00:00.000Z",
    };

    const mockConversationList = [
      {
        conversationId: "459",
        name: "LangGraph",
        traceIds: ["trace-1", "trace-2"],
        traceCount: 2,
      },
    ];

    it("should get conversations successfully with Tempo datasource", async () => {
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockConversationConfigService.findById.mockResolvedValue(
        mockConversationConfig,
      );
      mockConversationRepositoryFactory.getRepository.mockReturnValue(
        mockConversationRepository,
      );
      mockConversationRepository.getConversations.mockResolvedValue(
        mockConversationList,
      );

      const result = await service.getConversations(
        "org-1",
        "project-1",
        "datasource-1",
        "config-1",
        "user-1",
        query,
      );

      expect(result).toEqual({ conversations: mockConversationList });
      expect(mockDatasourcesService.findById).toHaveBeenCalledWith(
        "datasource-1",
      );
      expect(mockConversationConfigService.findById).toHaveBeenCalledWith(
        "org-1",
        "config-1",
      );
      expect(conversationRepositoryFactory.getRepository).toHaveBeenCalledWith(
        DatasourceSource.TEMPO,
      );
      expect(mockConversationRepository.getConversations).toHaveBeenCalledWith(
        mockDatasource,
        ["session.id"],
        { start: query.start, end: query.end, projectTraceFilter: undefined },
      );
    });

    it("should get conversations successfully with Jaeger datasource", async () => {
      const jaegerDatasource: Datasource = {
        ...mockDatasource,
        source: DatasourceSource.JAEGER,
      };
      mockDatasourcesService.findById.mockResolvedValue(jaegerDatasource);
      mockConversationConfigService.findById.mockResolvedValue(
        mockConversationConfig,
      );
      mockConversationRepositoryFactory.getRepository.mockReturnValue(
        mockConversationRepository,
      );
      mockConversationRepository.getConversations.mockResolvedValue(
        mockConversationList,
      );

      const result = await service.getConversations(
        "org-1",
        "project-1",
        "datasource-1",
        "config-1",
        "user-1",
        query,
      );

      expect(result).toEqual({ conversations: mockConversationList });
      expect(conversationRepositoryFactory.getRepository).toHaveBeenCalledWith(
        DatasourceSource.JAEGER,
      );
    });

    it("should throw NotFoundException if datasource not found", async () => {
      mockDatasourcesService.findById.mockResolvedValue(null);

      const promise = service.getConversations(
        "org-1",
        "project-1",
        "datasource-1",
        "config-1",
        "user-1",
        query,
      );
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.DATASOURCE_NOT_FOUND, "datasource-1"),
      );
    });

    it("should throw ForbiddenException if datasource does not belong to organisation", async () => {
      const datasourceFromDifferentOrg: Datasource = {
        ...mockDatasource,
        organisationId: "org-2",
      };
      mockDatasourcesService.findById.mockResolvedValue(
        datasourceFromDifferentOrg,
      );

      const promise = service.getConversations(
        "org-1",
        "project-1",
        "datasource-1",
        "config-1",
        "user-1",
        query,
      );
      await expect(promise).rejects.toThrow(ForbiddenException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.DATASOURCE_DOES_NOT_BELONG_TO_ORGANISATION),
      );
    });

    it("should throw NotFoundException if conversation config not found", async () => {
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockConversationConfigService.findById.mockResolvedValue(null);

      const promise = service.getConversations(
        "org-1",
        "project-1",
        "datasource-1",
        "config-1",
        "user-1",
        query,
      );
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.CONVERSATION_CONFIG_NOT_FOUND, "config-1"),
      );
    });

    it("should throw BadRequestException if conversation config has no attributes", async () => {
      const emptyConfig: ConversationConfiguration = {
        ...mockConversationConfig,
        stitchingAttributesName: [],
      };
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockConversationConfigService.findById.mockResolvedValue(emptyConfig);

      const promise = service.getConversations(
        "org-1",
        "project-1",
        "datasource-1",
        "config-1",
        "user-1",
        query,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow(
        "Conversation configuration must have at least one stitching attribute",
      );
    });

    it("should throw InternalServerErrorException if repository fails", async () => {
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockConversationConfigService.findById.mockResolvedValue(
        mockConversationConfig,
      );
      mockConversationRepositoryFactory.getRepository.mockReturnValue(
        mockConversationRepository,
      );
      mockConversationRepository.getConversations.mockRejectedValue(
        new Error("Repository error"),
      );

      const promise = service.getConversations(
        "org-1",
        "project-1",
        "datasource-1",
        "config-1",
        "user-1",
        query,
      );
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        "An error has occurred while getting conversations",
      );
    });
  });

  describe("getFullConversation", () => {
    const query: GetFullConversationRequestDto = {
      start: "2024-01-01T00:00:00.000Z",
      end: "2024-01-02T00:00:00.000Z",
      value: "459",
    };

    const mockFullConversationResult = {
      traces: [tempoConvTraceJson],
    };

    it("should delegate to repository for Tempo datasource", async () => {
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockConversationConfigService.findById.mockResolvedValue(
        mockConversationConfig,
      );
      mockConversationRepositoryFactory.getRepository.mockReturnValue(
        mockConversationRepository,
      );
      mockConversationRepository.getFullConversation.mockResolvedValue(
        mockFullConversationResult,
      );

      const result = await service.getFullConversation(
        "org-1",
        "project-1",
        "datasource-1",
        "config-1",
        "user-1",
        query,
      );

      expect(result).toEqual(mockFullConversationResult);
      expect(mockDatasourcesService.findById).toHaveBeenCalledWith(
        "datasource-1",
      );
      expect(mockConversationConfigService.findById).toHaveBeenCalledWith(
        "org-1",
        "config-1",
      );
      expect(conversationRepositoryFactory.getRepository).toHaveBeenCalledWith(
        DatasourceSource.TEMPO,
      );
      expect(
        mockConversationRepository.getFullConversation,
      ).toHaveBeenCalledWith(mockDatasource, ["session.id"], {
        start: query.start,
        end: query.end,
        value: query.value,
        projectTraceFilter: undefined,
      });
    });

    it("should delegate to repository for Jaeger datasource", async () => {
      const jaegerDatasource: Datasource = {
        ...mockDatasource,
        source: DatasourceSource.JAEGER,
      };
      mockDatasourcesService.findById.mockResolvedValue(jaegerDatasource);
      mockConversationConfigService.findById.mockResolvedValue(
        mockConversationConfig,
      );
      mockConversationRepositoryFactory.getRepository.mockReturnValue(
        mockConversationRepository,
      );
      mockConversationRepository.getFullConversation.mockResolvedValue(
        mockFullConversationResult,
      );

      const result = await service.getFullConversation(
        "org-1",
        "project-1",
        "datasource-1",
        "config-1",
        "user-1",
        query,
      );

      expect(result).toEqual(mockFullConversationResult);
      expect(conversationRepositoryFactory.getRepository).toHaveBeenCalledWith(
        DatasourceSource.JAEGER,
      );
    });

    it("should throw NotFoundException if datasource not found", async () => {
      mockDatasourcesService.findById.mockResolvedValue(null);

      const promise = service.getFullConversation(
        "org-1",
        "project-1",
        "datasource-1",
        "config-1",
        "user-1",
        query,
      );
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.DATASOURCE_NOT_FOUND, "datasource-1"),
      );
    });

    it("should throw NotFoundException if conversation config not found", async () => {
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockConversationConfigService.findById.mockResolvedValue(null);

      const promise = service.getFullConversation(
        "org-1",
        "project-1",
        "datasource-1",
        "config-1",
        "user-1",
        query,
      );
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.CONVERSATION_CONFIG_NOT_FOUND, "config-1"),
      );
    });

    it("should throw InternalServerErrorException if repository fails", async () => {
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockConversationConfigService.findById.mockResolvedValue(
        mockConversationConfig,
      );
      mockConversationRepositoryFactory.getRepository.mockReturnValue(
        mockConversationRepository,
      );
      mockConversationRepository.getFullConversation.mockRejectedValue(
        new Error("Repository error"),
      );

      const promise = service.getFullConversation(
        "org-1",
        "project-1",
        "datasource-1",
        "config-1",
        "user-1",
        query,
      );
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        "An error has occurred while getting full conversation",
      );
    });

    it("should throw BadRequestException if repository throws BadRequestException", async () => {
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockConversationConfigService.findById.mockResolvedValue(
        mockConversationConfig,
      );
      mockConversationRepositoryFactory.getRepository.mockReturnValue(
        mockConversationRepository,
      );
      mockConversationRepository.getFullConversation.mockRejectedValue(
        new BadRequestException("Invalid query"),
      );

      const promise = service.getFullConversation(
        "org-1",
        "project-1",
        "datasource-1",
        "config-1",
        "user-1",
        query,
      );
      await expect(promise).rejects.toThrow(BadRequestException);
      await expect(promise).rejects.toThrow("Invalid query");
    });
  });

  describe("getConversationsByTraceIds", () => {
    const query: GetConversationsByTracesRequestDto = {
      traceIds: ["trace-1", "trace-2"],
      startDate: "2024-01-01T00:00:00.000Z",
      endDate: "2024-01-02T00:00:00.000Z",
    };

    const mockConversationsByTraceIdsResult = {
      traces: [tempoConvTraceJson],
    };

    it("should delegate to repository", async () => {
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockConversationRepositoryFactory.getRepository.mockReturnValue(
        mockConversationRepository,
      );
      mockConversationRepository.getConversationsByTraceIds.mockResolvedValue(
        mockConversationsByTraceIdsResult,
      );

      const result = await service.getConversationsByTraceIds(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        query,
      );

      expect(result).toEqual(mockConversationsByTraceIdsResult);
      expect(mockDatasourcesService.findById).toHaveBeenCalledWith(
        "datasource-1",
      );
      expect(conversationRepositoryFactory.getRepository).toHaveBeenCalledWith(
        DatasourceSource.TEMPO,
      );
      expect(
        mockConversationRepository.getConversationsByTraceIds,
      ).toHaveBeenCalledWith(mockDatasource, {
        traceIds: query.traceIds,
        startDate: query.startDate,
        endDate: query.endDate,
        projectTraceFilter: undefined,
      });
    });

    it("should throw NotFoundException if datasource not found", async () => {
      mockDatasourcesService.findById.mockResolvedValue(null);

      const promise = service.getConversationsByTraceIds(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        query,
      );
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.DATASOURCE_NOT_FOUND, "datasource-1"),
      );
    });

    it("should throw ForbiddenException if datasource does not belong to organisation", async () => {
      const datasourceFromDifferentOrg: Datasource = {
        ...mockDatasource,
        organisationId: "org-2",
      };
      mockDatasourcesService.findById.mockResolvedValue(
        datasourceFromDifferentOrg,
      );

      const promise = service.getConversationsByTraceIds(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        query,
      );
      await expect(promise).rejects.toThrow(ForbiddenException);
      await expect(promise).rejects.toThrow(
        formatError(ERROR_MESSAGES.DATASOURCE_DOES_NOT_BELONG_TO_ORGANISATION),
      );
    });

    it("should throw InternalServerErrorException if repository fails", async () => {
      mockDatasourcesService.findById.mockResolvedValue(mockDatasource);
      mockConversationRepositoryFactory.getRepository.mockReturnValue(
        mockConversationRepository,
      );
      mockConversationRepository.getConversationsByTraceIds.mockRejectedValue(
        new Error("Repository error"),
      );

      const promise = service.getConversationsByTraceIds(
        "org-1",
        "project-1",
        "datasource-1",
        "user-1",
        query,
      );
      await expect(promise).rejects.toThrow(InternalServerErrorException);
      await expect(promise).rejects.toThrow(
        "An error has occurred while getting conversations by trace IDs",
      );
    });
  });
});
