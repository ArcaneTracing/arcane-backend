import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "node:crypto";

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly IV_LENGTH = 12;
  private readonly encryptionKey: string;

  constructor(private readonly configService: ConfigService) {
    const rawKey = this.configService.get<string>("ENCRYPTION_KEY");
    const key = this.normalizeKey(rawKey ?? "");
    if (!key) {
      this.logger.warn(
        "ENCRYPTION_KEY not set. Encryption/decryption will fail. Generate with: openssl rand -hex 32",
      );
    } else if (!/^[0-9a-fA-F]{64}$/.test(key)) {
      this.logger.error(
        "ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Generate with: openssl rand -hex 32",
      );
    }
    this.encryptionKey = key;
  }

  private normalizeKey(raw: string): string {
    return raw
      .trim()
      .replace(/\r\n/g, "")
      .replace(/\n/g, "")
      .replace(/\r/g, "")
      .replace(/^["']|["']$/g, "");
  }

  encrypt(plainText: string): string {
    if (!this.encryptionKey) {
      throw new Error("Missing ENCRYPTION_KEY. Cannot encrypt data.");
    }

    if (!/^[0-9a-fA-F]{64}$/.test(this.encryptionKey)) {
      throw new Error(
        "Invalid ENCRYPTION_KEY. Must be exactly 64 hex characters (32 bytes).",
      );
    }

    try {
      const iv = crypto.randomBytes(this.IV_LENGTH);

      const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        Buffer.from(this.encryptionKey, "hex"),
        iv,
      );

      let encrypted = cipher.update(plainText, "utf8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag();

      return `${iv.toString("hex")}:${encrypted}:${authTag.toString("hex")}`;
    } catch (error) {
      this.logger.error("Encryption failed", error);
      throw new Error("Encryption failed");
    }
  }

  decrypt(encryptedText: string): string {
    if (!this.encryptionKey) {
      throw new Error("Missing ENCRYPTION_KEY. Cannot decrypt data.");
    }

    if (!/^[0-9a-fA-F]{64}$/.test(this.encryptionKey)) {
      throw new Error(
        "Invalid ENCRYPTION_KEY. Must be exactly 64 hex characters (32 bytes).",
      );
    }

    try {
      const parts = encryptedText.split(":");
      if (parts.length !== 3) {
        throw new Error("Invalid or corrupted cipher format");
      }

      const [ivHex, encryptedHex, authTagHex] = parts;

      const iv = Buffer.from(ivHex, "hex");
      const encryptedData = Buffer.from(encryptedHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");

      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        Buffer.from(this.encryptionKey, "hex"),
        iv,
      );

      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedData, undefined, "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      this.logger.error("Decryption failed", error);
      if (error instanceof Error && error.message.includes("corrupted")) {
        throw new Error("Invalid or corrupted cipher format");
      }
      throw new Error("Decryption failed");
    }
  }

  isEncrypted(value: string): boolean {
    if (!value || typeof value !== "string") {
      return false;
    }
    const parts = value.split(":");
    if (parts.length !== 3) {
      return false;
    }
    return parts.every((part) => /^[0-9a-fA-F]+$/.test(part));
  }

  getDisplaySecretKey(secretKey: string): string {
    if (!secretKey || secretKey.length <= 10) {
      return "****";
    }
    return secretKey.slice(0, 6) + "..." + secretKey.slice(-4);
  }
}
