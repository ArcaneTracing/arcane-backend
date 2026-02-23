import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { UserOnboardingService } from "../../../src/rbac/services/user-onboarding.service";
import { UserRole } from "../../../src/rbac/entities/user-role.entity";
import { Repository } from "typeorm";

describe("UserOnboardingService", () => {
  let service: UserOnboardingService;
  let userRoleRepository: Repository<UserRole>;

  const mockUserRoleRepository = {
    count: jest.fn(),
    manager: {
      query: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserOnboardingService,
        {
          provide: getRepositoryToken(UserRole),
          useValue: mockUserRoleRepository,
        },
      ],
    }).compile();

    service = module.get<UserOnboardingService>(UserOnboardingService);
    userRoleRepository = module.get<Repository<UserRole>>(
      getRepositoryToken(UserRole),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("isFirstUser", () => {
    it("should return true when no user roles exist and user count is 0", async () => {
      mockUserRoleRepository.count.mockResolvedValue(0);
      mockUserRoleRepository.manager.query.mockResolvedValue([{ count: "0" }]);

      const result = await service.isFirstUser();

      expect(mockUserRoleRepository.count).toHaveBeenCalled();
      expect(mockUserRoleRepository.manager.query).toHaveBeenCalledWith(
        `SELECT COUNT(*) as count FROM "user"`,
      );
      expect(result).toBe(true);
    });

    it("should return true when no user roles exist and user count is 1", async () => {
      mockUserRoleRepository.count.mockResolvedValue(0);
      mockUserRoleRepository.manager.query.mockResolvedValue([{ count: "1" }]);

      const result = await service.isFirstUser();

      expect(result).toBe(true);
    });

    it("should return false when no user roles exist but user count is greater than 1", async () => {
      mockUserRoleRepository.count.mockResolvedValue(0);
      mockUserRoleRepository.manager.query.mockResolvedValue([{ count: "2" }]);

      const result = await service.isFirstUser();

      expect(result).toBe(false);
    });

    it("should return false when user roles exist", async () => {
      mockUserRoleRepository.count.mockResolvedValue(1);

      const result = await service.isFirstUser();

      expect(mockUserRoleRepository.count).toHaveBeenCalled();

      expect(mockUserRoleRepository.manager.query).not.toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it("should handle missing count in query result", async () => {
      mockUserRoleRepository.count.mockResolvedValue(0);
      mockUserRoleRepository.manager.query.mockResolvedValue([{}]);

      const result = await service.isFirstUser();

      expect(result).toBe(true);
    });

    it("should handle empty query result", async () => {
      mockUserRoleRepository.count.mockResolvedValue(0);
      mockUserRoleRepository.manager.query.mockResolvedValue([]);

      const result = await service.isFirstUser();

      expect(result).toBe(true);
    });
  });
});
