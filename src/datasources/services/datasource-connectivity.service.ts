import { Injectable, Logger } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { createClient } from "@clickhouse/client";
import { Datasource, DatasourceSource } from "../entities/datasource.entity";
import { DatasourceAuthService } from "./datasource-auth.service";
import { DatasourceConfigEncryptionService } from "./datasource-config-encryption.service";
import { CustomApiConfigMapper } from "../../traces/backends/custom-api/custom-api.config.mapper";
import { CustomApiRequestBuilder } from "../../traces/backends/custom-api/custom-api.request.builder";

interface TestConnectionResult {
  success: boolean;
  message: string;
}

interface HttpTestSetup {
  testUrl: string;
  requestParams?: Record<string, string | number>;
  authHeaders: Record<string, string>;
}

@Injectable()
export class DatasourceConnectivityService {
  private readonly logger = new Logger(DatasourceConnectivityService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly datasourceAuthService: DatasourceAuthService,
    private readonly configEncryptionService: DatasourceConfigEncryptionService,
  ) {}

  async testConnection(datasource: Datasource): Promise<TestConnectionResult> {
    try {
      const decryptedConfig = this.configEncryptionService.decryptConfig(
        datasource.source,
        datasource.config || {},
      );
      const datasourceWithDecryptedConfig = {
        ...datasource,
        config: decryptedConfig,
      };
      const authHeaders = this.datasourceAuthService.buildAuthHeaders(
        datasourceWithDecryptedConfig,
      );

      const setup = await this.buildTestSetup(
        datasource,
        datasourceWithDecryptedConfig,
        decryptedConfig,
        authHeaders,
      );
      if ("success" in setup) return setup;

      const requestConfig: Record<string, any> = {
        headers: { "Content-Type": "application/json", ...authHeaders },
        timeout: 5000,
      };
      if (setup.requestParams) {
        requestConfig.params = setup.requestParams;
      }

      await firstValueFrom(this.httpService.get(setup.testUrl, requestConfig));
      return { success: true, message: "Connection successful" };
    } catch (error: any) {
      return this.mapErrorToResult(error);
    }
  }

  private async buildTestSetup(
    datasource: Datasource,
    datasourceWithDecryptedConfig: Datasource,
    decryptedConfig: Record<string, any>,
    authHeaders: Record<string, string>,
  ): Promise<HttpTestSetup | TestConnectionResult> {
    switch (datasource.source) {
      case DatasourceSource.TEMPO:
        return {
          testUrl: `${datasource.url}/api/search`,
          authHeaders,
        };
      case DatasourceSource.JAEGER:
        return {
          testUrl: `${datasource.url}/api/v3/services`,
          authHeaders,
        };
      case DatasourceSource.CLICKHOUSE:
        return this.testClickHouseConnection(decryptedConfig);
      case DatasourceSource.CUSTOM_API:
        return this.buildCustomApiTestSetup(
          datasourceWithDecryptedConfig,
          authHeaders,
        );
      default:
        return { success: false, message: "Unsupported datasource type" };
    }
  }

  private async testClickHouseConnection(
    decryptedConfig: Record<string, any>,
  ): Promise<TestConnectionResult> {
    const clickhouseConfig = decryptedConfig.clickhouse as
      | {
          host?: string;
          port?: number;
          database?: string;
          username?: string;
          password?: string;
          protocol?: "http" | "https";
        }
      | undefined;

    if (!clickhouseConfig?.host || !clickhouseConfig?.database) {
      return {
        success: false,
        message:
          "ClickHouse configuration missing: host and database are required",
      };
    }

    try {
      const client = createClient({
        host: `${clickhouseConfig.protocol || "http"}://${clickhouseConfig.host}:${clickhouseConfig.port || 8123}`,
        database: clickhouseConfig.database,
        username: clickhouseConfig.username || "default",
        password: clickhouseConfig.password || "",
      });
      await client.query({ query: "SELECT 1" });
      await client.close();
      return { success: true, message: "Connection successful" };
    } catch (error: any) {
      return this.mapClickHouseError(error);
    }
  }

  private mapClickHouseError(error: any): TestConnectionResult {
    if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
      return {
        success: false,
        message: "Unable to connect to ClickHouse server",
      };
    }
    if (
      error.message?.includes("Authentication") ||
      error.message?.includes("password")
    ) {
      return {
        success: false,
        message: "Authentication failed - check username and password",
      };
    }
    return {
      success: false,
      message: error.message || "Connection test failed",
    };
  }

  private buildCustomApiTestSetup(
    datasource: Datasource,
    authHeaders: Record<string, string>,
  ): HttpTestSetup | TestConnectionResult {
    const config = CustomApiConfigMapper.map(datasource);
    if (!config.baseUrl) {
      return { success: false, message: "Custom API baseUrl not configured" };
    }

    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
    const searchParams = {
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      limit: 1,
    };

    const requestParams = CustomApiRequestBuilder.buildSearchParams(
      searchParams,
      config,
    );
    const testUrl = CustomApiRequestBuilder.buildUrl(
      config.baseUrl,
      config.endpoints.search.path,
    );
    const headers = CustomApiRequestBuilder.buildHeaders(config);
    Object.assign(authHeaders, headers);

    return { testUrl, requestParams, authHeaders };
  }

  private mapErrorToResult(error: any): TestConnectionResult {
    if (error.response?.status === 401 || error.response?.status === 403) {
      return { success: false, message: "Authentication failed" };
    }
    if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
      return { success: false, message: "Unable to connect to datasource URL" };
    }
    if (error.response?.status === 404) {
      return {
        success: false,
        message: "Endpoint not found - check URL and path configuration",
      };
    }
    return {
      success: false,
      message: error.message || "Connection test failed",
    };
  }
}
