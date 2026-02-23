import { Injectable } from "@nestjs/common";
import { EncryptionService } from "../../common/encryption/services/encryption.service";
import { DatasourceSource } from "../entities/datasource.entity";

type AuthWithPassword = { type: string; password?: string };
type AuthWithToken = { type: string; token?: string };
type AuthWithValue = { type: string; value?: string };

@Injectable()
export class DatasourceConfigEncryptionService {
  constructor(private readonly encryptionService: EncryptionService) {}

  encryptConfig(
    source: DatasourceSource,
    config: Record<string, any>,
  ): Record<string, any> {
    if (!config) return config;

    const encrypted = structuredClone(config);

    if (
      source === DatasourceSource.CLICKHOUSE &&
      encrypted.clickhouse?.password
    ) {
      this.maybeEncryptField(encrypted.clickhouse, "password");
    }

    if (
      (source === DatasourceSource.TEMPO ||
        source === DatasourceSource.JAEGER) &&
      encrypted.authentication
    ) {
      this.encryptOtelAuth(encrypted.authentication);
    }

    if (
      source === DatasourceSource.CUSTOM_API &&
      encrypted.customApi?.authentication
    ) {
      this.encryptCustomApiAuth(encrypted.customApi.authentication);
    }

    return encrypted;
  }

  decryptConfig(
    source: DatasourceSource,
    config: Record<string, any>,
  ): Record<string, any> {
    if (!config) return config;

    const decrypted = structuredClone(config);

    if (
      source === DatasourceSource.CLICKHOUSE &&
      decrypted.clickhouse?.password
    ) {
      this.maybeDecryptField(decrypted.clickhouse, "password");
    }

    if (
      (source === DatasourceSource.TEMPO ||
        source === DatasourceSource.JAEGER) &&
      decrypted.authentication
    ) {
      this.decryptOtelAuth(decrypted.authentication);
    }

    if (
      source === DatasourceSource.CUSTOM_API &&
      decrypted.customApi?.authentication
    ) {
      this.decryptCustomApiAuth(decrypted.customApi.authentication);
    }

    return decrypted;
  }

  maskConfigForResponse(
    source: DatasourceSource,
    config: Record<string, any>,
  ): Record<string, any> {
    if (!config) return config;

    const masked = structuredClone(config);

    if (source === DatasourceSource.CLICKHOUSE && masked.clickhouse?.password) {
      masked.clickhouse.password = "***";
    }

    if (
      (source === DatasourceSource.TEMPO ||
        source === DatasourceSource.JAEGER) &&
      masked.authentication
    ) {
      this.maskOtelAuth(masked.authentication);
    }

    if (
      source === DatasourceSource.CUSTOM_API &&
      masked.customApi?.authentication
    ) {
      this.maskCustomApiAuth(masked.customApi.authentication);
    }

    return masked;
  }

  private maskOtelAuth(auth: AuthWithPassword & AuthWithToken): void {
    if (auth.type === "basic" && auth.password) {
      auth.password = "***";
    } else if (auth.type === "bearer" && auth.token) {
      auth.token = "***";
    }
  }

  private maskCustomApiAuth(auth: AuthWithPassword & AuthWithValue): void {
    if (auth.type === "basic" && auth.password) {
      auth.password = "***";
    } else if (
      (auth.type === "bearer" || auth.type === "header") &&
      auth.value
    ) {
      auth.value = "***";
    }
  }

  private maybeEncryptField(obj: Record<string, any>, key: string): void {
    const value = obj[key];
    if (value && !this.encryptionService.isEncrypted(value)) {
      obj[key] = this.encryptionService.encrypt(value);
    }
  }

  private maybeDecryptField(obj: Record<string, any>, key: string): void {
    const value = obj[key];
    if (this.encryptionService.isEncrypted(value)) {
      obj[key] = this.encryptionService.decrypt(value);
    }
  }

  private encryptOtelAuth(auth: AuthWithPassword & AuthWithToken): void {
    if (auth.type === "basic" && auth.password) {
      this.maybeEncryptField(auth, "password");
    } else if (auth.type === "bearer" && auth.token) {
      this.maybeEncryptField(auth, "token");
    }
  }

  private decryptOtelAuth(auth: AuthWithPassword & AuthWithToken): void {
    if (auth.type === "basic" && auth.password) {
      this.maybeDecryptField(auth, "password");
    } else if (auth.type === "bearer" && auth.token) {
      this.maybeDecryptField(auth, "token");
    }
  }

  private encryptCustomApiAuth(auth: AuthWithPassword & AuthWithValue): void {
    if (auth.type === "basic" && auth.password) {
      this.maybeEncryptField(auth, "password");
    } else if (
      (auth.type === "bearer" || auth.type === "header") &&
      auth.value
    ) {
      this.maybeEncryptField(auth, "value");
    }
  }

  private decryptCustomApiAuth(auth: AuthWithPassword & AuthWithValue): void {
    if (auth.type === "basic" && auth.password) {
      this.maybeDecryptField(auth, "password");
    } else if (
      (auth.type === "bearer" || auth.type === "header") &&
      auth.value
    ) {
      this.maybeDecryptField(auth, "value");
    }
  }
}
