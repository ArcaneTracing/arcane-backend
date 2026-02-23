import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { ModelConfigurationService } from "../services/model-configuration.service";
import { ModelConfigurationResponseDto } from "../dto/response/model-configuration-response.dto";
import { ApiKeyGuard } from "../../auth/guards/api-key.guard";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";

@Controller("/internal/model-configurations")
@ApiTags("internal-model-configurations")
@ApiSecurity("apiKey")
@AllowAnonymous()
@UseGuards(ApiKeyGuard)
export class ModelConfigurationInternalController {
  constructor(
    private readonly modelConfigurationService: ModelConfigurationService,
  ) {}

  @Get(":id")
  @UsePipes(new ValidationPipe({ transform: true }))
  async findOne(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ModelConfigurationResponseDto> {
    return this.modelConfigurationService.findOneById(id);
  }
}
