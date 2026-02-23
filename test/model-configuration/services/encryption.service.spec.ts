import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { EncryptionService } from "../../../src/common/encryption/services/encryption.service";
import * as crypto from "crypto";

describe("EncryptionService", () => {
  let service: EncryptionService;
  let configService: ConfigService;

  const validEncryptionKey = crypto.randomBytes(32).toString("hex");

  const mockConfigService = {
    get: jest.fn().mockReturnValue(validEncryptionKey),
  };

  beforeEach(async () => {
    mockConfigService.get.mockReturnValue(validEncryptionKey);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("encrypt", () => {
    it("should encrypt plain text successfully", () => {
      mockConfigService.get.mockReturnValue(validEncryptionKey);

      const plainText = "test-secret-key";
      const encrypted = service.encrypt(plainText);

      expect(encrypted).toBeDefined();
      expect(encrypted).toContain(":");
      const parts = encrypted.split(":");
      expect(parts.length).toBe(3);
      expect(parts.every((part) => /^[0-9a-fA-F]+$/.test(part))).toBe(true);
    });

    it("should throw error when ENCRYPTION_KEY is missing", async () => {
      const moduleWithoutKey: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
        ],
      }).compile();
      const serviceWithoutKey =
        moduleWithoutKey.get<EncryptionService>(EncryptionService);

      expect(() => serviceWithoutKey.encrypt("test")).toThrow(
        "Missing ENCRYPTION_KEY",
      );
    });

    it("should throw error when ENCRYPTION_KEY is invalid format", async () => {
      const moduleWithInvalidKey: TestingModule =
        await Test.createTestingModule({
          providers: [
            EncryptionService,
            {
              provide: ConfigService,
              useValue: { get: jest.fn().mockReturnValue("invalid-key") },
            },
          ],
        }).compile();
      const serviceWithInvalidKey =
        moduleWithInvalidKey.get<EncryptionService>(EncryptionService);

      expect(() => serviceWithInvalidKey.encrypt("test")).toThrow(
        "Invalid ENCRYPTION_KEY",
      );
    });

    it("should encrypt different plain texts to different cipher texts", () => {
      mockConfigService.get.mockReturnValue(validEncryptionKey);

      const plainText1 = "secret1";
      const plainText2 = "secret2";

      const encrypted1 = service.encrypt(plainText1);
      const encrypted2 = service.encrypt(plainText2);

      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe("decrypt", () => {
    it("should decrypt encrypted text successfully", () => {
      const plainText = "test-secret-key";
      const encrypted = service.encrypt(plainText);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plainText);
    });

    it("should throw error when ENCRYPTION_KEY is missing", async () => {
      const moduleWithoutKey: TestingModule = await Test.createTestingModule({
        providers: [
          EncryptionService,
          {
            provide: ConfigService,
            useValue: { get: jest.fn().mockReturnValue(undefined) },
          },
        ],
      }).compile();
      const serviceWithoutKey =
        moduleWithoutKey.get<EncryptionService>(EncryptionService);

      expect(() => serviceWithoutKey.decrypt("iv:encrypted:tag")).toThrow(
        "Missing ENCRYPTION_KEY",
      );
    });

    it("should throw error when ENCRYPTION_KEY is invalid format", async () => {
      const moduleWithInvalidKey: TestingModule =
        await Test.createTestingModule({
          providers: [
            EncryptionService,
            {
              provide: ConfigService,
              useValue: { get: jest.fn().mockReturnValue("invalid-key") },
            },
          ],
        }).compile();
      const serviceWithInvalidKey =
        moduleWithInvalidKey.get<EncryptionService>(EncryptionService);

      expect(() => serviceWithInvalidKey.decrypt("iv:encrypted:tag")).toThrow(
        "Invalid ENCRYPTION_KEY",
      );
    });

    it("should throw error for invalid cipher format", () => {
      mockConfigService.get.mockReturnValue(validEncryptionKey);

      expect(() => service.decrypt("invalid-format")).toThrow(
        "Invalid or corrupted cipher format",
      );
    });

    it("should throw error for corrupted cipher data", () => {
      const invalidCipher =
        "a".repeat(24) + ":" + "b".repeat(32) + ":" + "c".repeat(32);

      expect(() => service.decrypt(invalidCipher)).toThrow();
    });
  });

  describe("isEncrypted", () => {
    it("should return true for encrypted format", () => {
      const plainText = "test-secret";
      const encrypted = service.encrypt(plainText);

      expect(service.isEncrypted(encrypted)).toBe(true);
    });

    it("should return false for plain text", () => {
      expect(service.isEncrypted("plain-text")).toBe(false);
    });

    it("should return false for invalid format", () => {
      expect(service.isEncrypted("invalid:format")).toBe(false);
    });

    it("should return false for non-string values", () => {
      expect(service.isEncrypted(null as any)).toBe(false);
      expect(service.isEncrypted(undefined as any)).toBe(false);
      expect(service.isEncrypted(123 as any)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(service.isEncrypted("")).toBe(false);
    });
  });

  describe("getDisplaySecretKey", () => {
    it("should mask secret key correctly", () => {
      const secretKey = "sk-1234567890abcdefghijklmnopqrstuvwxyz";
      const masked = service.getDisplaySecretKey(secretKey);

      expect(masked).toBe("sk-123...wxyz");
      expect(masked.length).toBeLessThan(secretKey.length);
    });

    it("should return masked version for short keys", () => {
      const shortKey = "sk-12345";
      const masked = service.getDisplaySecretKey(shortKey);

      expect(masked).toBe("****");
    });

    it('should return "****" for very short keys', () => {
      expect(service.getDisplaySecretKey("sk-123")).toBe("****");
      expect(service.getDisplaySecretKey("sk")).toBe("****");
    });

    it('should return "****" for empty or null keys', () => {
      expect(service.getDisplaySecretKey("")).toBe("****");
      expect(service.getDisplaySecretKey(null as any)).toBe("****");
      expect(service.getDisplaySecretKey(undefined as any)).toBe("****");
    });
  });
});
