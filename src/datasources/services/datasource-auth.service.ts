import { Injectable } from "@nestjs/common";
import { Datasource } from "../entities/datasource.entity";
import { DatasourceConfigEncryptionService } from "./datasource-config-encryption.service";

@Injectable()
export class DatasourceAuthService {
  constructor(
    private readonly configEncryptionService: DatasourceConfigEncryptionService,
  ) {}

  buildAuthHeaders(datasource: Datasource): Record<string, string> {
    const decryptedConfig = this.configEncryptionService.decryptConfig(
      datasource.source,
      datasource.config || {},
    );
    const auth = decryptedConfig.authentication;
    if (!auth) return {};

    const headers: Record<string, string> = {};

    if (auth.type === "basic" && auth.username && auth.password) {
      const credentials = Buffer.from(
        `${auth.username}:${auth.password}`,
      ).toString("base64");
      headers["Authorization"] = `Basic ${credentials}`;
    } else if (auth.type === "bearer" && auth.token) {
      headers["Authorization"] = `Bearer ${auth.token}`;
    }

    return headers;
  }
}
