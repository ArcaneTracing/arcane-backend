import { Injectable, BadRequestException } from "@nestjs/common";
import { DatasourceSource } from "../entities/datasource.entity";

@Injectable()
export class DatasourceUrlValidator {
  validate(url: string | undefined | null, source: DatasourceSource): void {
    if (
      source === DatasourceSource.TEMPO ||
      source === DatasourceSource.JAEGER
    ) {
      if (!url) {
        throw new BadRequestException("URL is required for datasources");
      }
    }
  }
}
