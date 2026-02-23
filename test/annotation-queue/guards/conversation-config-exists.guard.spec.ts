import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ExecutionContext, NotFoundException } from "@nestjs/common";
import { Repository } from "typeorm";
import { ConversationConfigExistsGuard } from "../../../src/annotation-queue/guards/conversation-config-exists.guard";
import { ConversationConfiguration } from "../../../src/conversation-configuration/entities/conversation-configuration.entity";

describe("ConversationConfigExistsGuard", () => {
  let guard: ConversationConfigExistsGuard;
  let repository: Repository<ConversationConfiguration>;

  const mockRepository = {
    createQueryBuilder: jest.fn(),
  };

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getExists: jest.fn(),
  };

  const createMockContext = (
    params: any = {},
    body: any = {},
    query: any = {},
  ): ExecutionContext => {
    const request = {
      params,
      body,
      query,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationConfigExistsGuard,
        {
          provide: getRepositoryToken(ConversationConfiguration),
          useValue: mockRepository,
        },
      ],
    }).compile();

    guard = module.get<ConversationConfigExistsGuard>(
      ConversationConfigExistsGuard,
    );
    repository = module.get<Repository<ConversationConfiguration>>(
      getRepositoryToken(ConversationConfiguration),
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
  });

  describe("canActivate", () => {
    it("should return true when conversation config exists in organisation (from params)", async () => {
      const params = {
        organisationId: "org-1",
        conversationConfigId: "config-1",
      };
      const context = createMockContext(params);
      mockQueryBuilder.getExists.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith("cc");
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "cc.id = :conversationConfigId",
        {
          conversationConfigId: "config-1",
        },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        "cc.organisationId = :organisationId",
        {
          organisationId: "org-1",
        },
      );
      expect(mockQueryBuilder.getExists).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should return true when conversation config exists (from body)", async () => {
      const params = { organisationId: "org-1" };
      const body = { conversationConfigId: "config-1" };
      const context = createMockContext(params, body);
      mockQueryBuilder.getExists.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "cc.id = :conversationConfigId",
        {
          conversationConfigId: "config-1",
        },
      );
      expect(result).toBe(true);
    });

    it("should return true when conversation config exists (from query)", async () => {
      const params = { organisationId: "org-1" };
      const query = { conversationConfigId: "config-1" };
      const context = createMockContext(params, {}, query);
      mockQueryBuilder.getExists.mockResolvedValue(true);

      const result = await guard.canActivate(context);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "cc.id = :conversationConfigId",
        {
          conversationConfigId: "config-1",
        },
      );
      expect(result).toBe(true);
    });

    it("should throw NotFoundException when organisationId is missing", async () => {
      const params = { conversationConfigId: "config-1" };
      const context = createMockContext(params);

      const promise = guard.canActivate(context);
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        "Organisation ID and Conversation Config ID are required",
      );
      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when conversationConfigId is missing", async () => {
      const params = { organisationId: "org-1" };
      const context = createMockContext(params);

      await expect(guard.canActivate(context)).rejects.toThrow(
        NotFoundException,
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        "Organisation ID and Conversation Config ID are required",
      );
      expect(mockRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when conversation config does not exist", async () => {
      const params = {
        organisationId: "org-1",
        conversationConfigId: "config-1",
      };
      const context = createMockContext(params);
      mockQueryBuilder.getExists.mockResolvedValue(false);

      const promise = guard.canActivate(context);
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.toThrow(
        "Conversation configuration with ID config-1 not found",
      );
      expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
    });
  });
});
