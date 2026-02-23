import { BetterAuthUserService } from "src/auth/services/better-auth-user.service";

describe("BetterAuthUserService", () => {
  let service: BetterAuthUserService;
  let userRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    count: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let cacheManager: {
    get: jest.Mock;
    set: jest.Mock;
  };

  beforeEach(() => {
    userRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };
    service = new BetterAuthUserService(
      userRepository as any,
      cacheManager as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getUserById", () => {
    it("should return cached user when available", async () => {
      cacheManager.get.mockResolvedValue({
        id: "user-1",
        email: "a@test.com",
        name: "A",
      });

      const result = await service.getUserById("user-1");

      expect(result).toEqual({ id: "user-1", email: "a@test.com", name: "A" });
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });

    it("should fetch user and cache when not in cache", async () => {
      cacheManager.get.mockResolvedValue(undefined);
      userRepository.findOne.mockResolvedValue({
        id: "user-1",
        email: "a@test.com",
        name: "A",
      });

      const result = await service.getUserById("user-1");

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: "user-1" },
        select: ["id", "email", "name"],
      });
      expect(cacheManager.set).toHaveBeenCalled();
      expect(result).toEqual({ id: "user-1", email: "a@test.com", name: "A" });
    });

    it("should return null when repository throws", async () => {
      cacheManager.get.mockResolvedValue(undefined);
      userRepository.findOne.mockRejectedValue(new Error("db error"));

      const result = await service.getUserById("user-1");

      expect(result).toBeNull();
    });
  });

  describe("getUserIdByEmail", () => {
    it("should return cached user id when available", async () => {
      cacheManager.get.mockResolvedValue("user-1");

      const result = await service.getUserIdByEmail("a@test.com");

      expect(result).toBe("user-1");
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });

    it("should fetch user id and cache when not in cache", async () => {
      cacheManager.get.mockResolvedValue(undefined);
      userRepository.findOne.mockResolvedValue({ id: "user-2" });

      const result = await service.getUserIdByEmail("b@test.com");

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: "b@test.com" },
        select: ["id"],
      });
      expect(cacheManager.set).toHaveBeenCalled();
      expect(result).toBe("user-2");
    });

    it("should return null when repository throws", async () => {
      cacheManager.get.mockResolvedValue(undefined);
      userRepository.findOne.mockRejectedValue(new Error("db error"));

      const result = await service.getUserIdByEmail("c@test.com");

      expect(result).toBeNull();
    });
  });

  describe("getUsersByIds", () => {
    it("should return empty array when input is empty", async () => {
      const result = await service.getUsersByIds([]);

      expect(result).toEqual([]);
      expect(userRepository.find).not.toHaveBeenCalled();
    });

    it("should return users from repository", async () => {
      userRepository.find.mockResolvedValue([
        { id: "user-1", email: "a@test.com", name: "A" },
      ]);

      const result = await service.getUsersByIds(["user-1"]);

      expect(userRepository.find).toHaveBeenCalledWith({
        where: { id: expect.anything() },
        select: ["id", "email", "name"],
        order: { name: "ASC" },
      });
      expect(result).toEqual([
        { id: "user-1", email: "a@test.com", name: "A" },
      ]);
    });
  });

  describe("getAllUsers", () => {
    it("should return users from repository", async () => {
      userRepository.find.mockResolvedValue([
        { id: "user-1", email: "a@test.com", name: "A" },
      ]);

      const result = await service.getAllUsers();

      expect(userRepository.find).toHaveBeenCalledWith({
        select: ["id", "email", "name"],
        order: { name: "ASC" },
      });
      expect(result).toEqual([
        { id: "user-1", email: "a@test.com", name: "A" },
      ]);
    });
  });

  describe("getUsersNotInList", () => {
    it("should return all users when list is empty", async () => {
      const allUsers = [{ id: "user-1", email: "a@test.com", name: "A" }];
      userRepository.find.mockResolvedValue(allUsers);

      const result = await service.getUsersNotInList([]);

      expect(userRepository.find).toHaveBeenCalledWith({
        select: ["id", "email", "name"],
        order: { name: "ASC" },
      });
      expect(result).toEqual(allUsers);
    });

    it("should return users not in list from repository", async () => {
      userRepository.find.mockResolvedValue([
        { id: "user-2", email: "b@test.com", name: "B" },
      ]);

      const result = await service.getUsersNotInList(["user-1"]);

      expect(userRepository.find).toHaveBeenCalledWith({
        where: { id: expect.anything() },
        select: ["id", "email", "name"],
        order: { name: "ASC" },
      });
      expect(result).toEqual([
        { id: "user-2", email: "b@test.com", name: "B" },
      ]);
    });
  });

  describe("searchUsersByEmail", () => {
    it("should return users matching email search term", async () => {
      const searchTerm = "john";
      const mockUsers = [
        { id: "user-1", email: "john@example.com", name: "John Doe" },
        { id: "user-2", email: "johnny@example.com", name: "Johnny Smith" },
      ];
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockUsers),
      };
      userRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.searchUsersByEmail(searchTerm);

      expect(userRepository.createQueryBuilder).toHaveBeenCalledWith("user");
      expect(mockQueryBuilder.select).toHaveBeenCalledWith([
        "user.id",
        "user.email",
        "user.name",
      ]);
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        "LOWER(user.email) LIKE LOWER(:searchTerm)",
        { searchTerm: "%john%" },
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith("user.name", "ASC");
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
      expect(result).toEqual(mockUsers);
    });

    it("should return empty array when search term is empty", async () => {
      const result = await service.searchUsersByEmail("");

      expect(result).toEqual([]);
      expect(userRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it("should return empty array when search term is whitespace only", async () => {
      const result = await service.searchUsersByEmail("   ");

      expect(result).toEqual([]);
      expect(userRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it("should use custom limit when provided", async () => {
      const searchTerm = "test";
      const limit = 10;
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      userRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      await service.searchUsersByEmail(searchTerm, limit);

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(limit);
    });

    it("should handle database errors gracefully", async () => {
      const searchTerm = "test";
      userRepository.createQueryBuilder.mockImplementation(() => {
        throw new Error("Database error");
      });

      const result = await service.searchUsersByEmail(searchTerm);

      expect(result).toEqual([]);
    });
  });

  describe("hasAnyUsers", () => {
    it("should return true when count is greater than zero", async () => {
      userRepository.count.mockResolvedValue(1);

      const result = await service.hasAnyUsers();

      expect(result).toBe(true);
      expect(userRepository.count).toHaveBeenCalled();
    });

    it("should return false when count is zero", async () => {
      userRepository.count.mockResolvedValue(0);

      const result = await service.hasAnyUsers();

      expect(result).toBe(false);
      expect(userRepository.count).toHaveBeenCalled();
    });

    it("should return false when repository throws", async () => {
      userRepository.count.mockRejectedValue(new Error("db error"));

      const result = await service.hasAnyUsers();

      expect(result).toBe(false);
      expect(userRepository.count).toHaveBeenCalled();
    });
  });
});
