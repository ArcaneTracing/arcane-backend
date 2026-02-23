import { Injectable, BadRequestException } from "@nestjs/common";

@Injectable()
export class ClickHouseConfigValidator {
  validate(
    url: string | undefined | null,
    config: Record<string, unknown> | null | undefined,
  ): void {
    if (!url && !config?.clickhouse) {
      throw new BadRequestException(
        "URL or config.clickhouse is required for ClickHouse datasources",
      );
    }

    if (!config?.clickhouse) {
      return;
    }

    const chConfig = config.clickhouse as Record<string, unknown>;
    if (!chConfig.host || !chConfig.database || !chConfig.tableName) {
      throw new BadRequestException(
        "ClickHouse config must include host, database, and tableName",
      );
    }
  }
}
