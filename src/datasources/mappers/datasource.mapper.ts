import { Datasource, DatasourceSource } from "../entities/datasource.entity";
import { DatasourceResponseDto } from "../dto/response/datasource-response.dto";
import { DatasourceListItemResponseDto } from "../dto/response/datasource-list-item-response.dto";
import { CustomApiConfigDto } from "../dto/custom-api-config.dto";
import { DatasourceConfigEncryptionService } from "../services/datasource-config-encryption.service";

export class DatasourceMapper {
  private static configEncryptionService: DatasourceConfigEncryptionService;

  static setConfigEncryptionService(
    service: DatasourceConfigEncryptionService,
  ): void {
    DatasourceMapper.configEncryptionService = service;
  }

  static toResponseDto(datasource: Datasource): DatasourceResponseDto {
    const capabilities = this.getCapabilities(datasource);
    const decryptedConfig =
      datasource.config && this.configEncryptionService
        ? this.configEncryptionService.decryptConfig(
            datasource.source,
            datasource.config,
          )
        : datasource.config;
    return {
      id: datasource.id,
      name: datasource.name,
      description: datasource.description,
      url: datasource.url,
      type: datasource.type,
      source: datasource.source,
      config: decryptedConfig,
      ...capabilities,
    };
  }

  static toListItemDto(datasource: Datasource): DatasourceListItemResponseDto {
    const capabilities = this.getCapabilities(datasource);
    return {
      id: datasource.id,
      name: datasource.name,
      description: datasource.description,
      type: datasource.type,
      source: datasource.source,
      ...capabilities,
    };
  }

  private static getCapabilities(datasource: Datasource): {
    isSearchByQueryEnabled: boolean;
    isSearchByAttributesEnabled: boolean;
    isGetAttributeNamesEnabled: boolean;
    isGetAttributeValuesEnabled: boolean;
  } {
    if (datasource.source === DatasourceSource.CUSTOM_API) {
      const config = datasource.config?.customApi as
        | Partial<CustomApiConfigDto>
        | undefined;
      return {
        isSearchByQueryEnabled: config?.capabilities?.searchByQuery !== false,
        isSearchByAttributesEnabled:
          config?.capabilities?.searchByAttributes === true,
        isGetAttributeNamesEnabled:
          config?.capabilities?.getAttributeNames === true,
        isGetAttributeValuesEnabled:
          config?.capabilities?.getAttributeValues === true,
      };
    }

    const isClickHouseOrTempo =
      datasource.source === DatasourceSource.CLICKHOUSE ||
      datasource.source === DatasourceSource.TEMPO;

    return {
      isSearchByQueryEnabled: isClickHouseOrTempo,
      isSearchByAttributesEnabled: isClickHouseOrTempo,
      isGetAttributeNamesEnabled: isClickHouseOrTempo,
      isGetAttributeValuesEnabled: isClickHouseOrTempo,
    };
  }
}
