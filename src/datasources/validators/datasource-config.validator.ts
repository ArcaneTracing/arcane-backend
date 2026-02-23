import { Injectable, BadRequestException } from "@nestjs/common";
import { DatasourceSource } from "../entities/datasource.entity";
import { DatasourceUrlValidator } from "./datasource-url.validator";
import { ClickHouseConfigValidator } from "./clickhouse-config.validator";
import { CustomApiConfigValidator } from "./custom-api-config.validator";

@Injectable()
export class DatasourceConfigValidator {
  constructor(
    private readonly urlValidator: DatasourceUrlValidator,
    private readonly clickHouseConfigValidator: ClickHouseConfigValidator,
    private readonly customApiConfigValidator: CustomApiConfigValidator,
  ) {}

  validate(
    url: string | undefined | null,
    source: DatasourceSource,
    config?: Record<string, unknown> | null,
  ): void {
    this.urlValidator.validate(url, source);

    if (source === DatasourceSource.CLICKHOUSE) {
      this.clickHouseConfigValidator.validate(url, config);
    }

    if (source === DatasourceSource.CUSTOM_API) {
      this.customApiConfigValidator.validate(url, config);
    }

    if (
      source === DatasourceSource.TEMPO ||
      source === DatasourceSource.JAEGER
    ) {
      this.validateOtelAuthentication(config);
    }
  }

  private validateOtelAuthentication(
    config?: Record<string, unknown> | null,
  ): void {
    const auth = config?.authentication as
      | { type?: string; username?: string; password?: string; token?: string }
      | undefined;
    if (!auth) return;

    if (auth.type === "basic") {
      if (!auth.username || !auth.password) {
        throw new BadRequestException(
          "Basic authentication requires both username and password",
        );
      }
    } else if (auth.type === "bearer") {
      if (!auth.token) {
        throw new BadRequestException("Bearer authentication requires a token");
      }
    } else if (auth.type) {
      throw new BadRequestException(
        'Authentication type must be "basic" or "bearer"',
      );
    }
  }
}
