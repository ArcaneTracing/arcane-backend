import { ModelConfigurationData } from "../model-configuration-types";

export class ModelConfigurationResponseDto {
  id: string;
  name: string;
  configuration: ModelConfigurationData;
  createdAt: Date;
  updatedAt: Date;
}
