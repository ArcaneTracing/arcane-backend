import { ModelConfiguration } from "../entities/model-configuration.entity";
import { ModelConfigurationResponseDto } from "../dto/response/model-configuration-response.dto";
import { ModelConfigurationData } from "../dto/model-configuration-types";

export class ModelConfigurationMapper {
  static toResponseDto(
    modelConfiguration: ModelConfiguration,
  ): ModelConfigurationResponseDto {
    return {
      id: modelConfiguration.id,
      name: modelConfiguration.name,
      configuration: modelConfiguration.configuration as ModelConfigurationData,
      createdAt: modelConfiguration.createdAt,
      updatedAt: modelConfiguration.updatedAt,
    };
  }
}
