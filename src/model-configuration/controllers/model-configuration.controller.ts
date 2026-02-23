import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { ModelConfigurationService } from "../services/model-configuration.service";
import {
  CreateModelConfigurationRequestDto,
  UpdateModelConfigurationRequestDto,
} from "../dto/request/create-model-configuration.dto";
import { ModelConfigurationResponseDto } from "../dto/response/model-configuration-response.dto";
import { OrgPermissionGuard } from "../../rbac/guards/org-permission.guard";
import { Permission } from "../../rbac/decorators/permission.decorator";
import { MODEL_CONFIGURATION_PERMISSIONS } from "../../rbac/permissions/permissions";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

@Controller("v1/organisations/:organisationId/model-configurations")
@ApiTags("model-configurations")
@ApiBearerAuth("bearer")
@UseGuards(OrgPermissionGuard)
export class ModelConfigurationController {
  constructor(
    private readonly modelConfigurationService: ModelConfigurationService,
  ) {}

  @Get()
  @Permission(MODEL_CONFIGURATION_PERMISSIONS.READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  async findAll(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
  ): Promise<ModelConfigurationResponseDto[]> {
    return this.modelConfigurationService.findAll(organisationId);
  }

  @Get(":id")
  @Permission(MODEL_CONFIGURATION_PERMISSIONS.READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  async findOne(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<ModelConfigurationResponseDto> {
    return this.modelConfigurationService.findOne(organisationId, id);
  }

  @Post()
  @Permission(MODEL_CONFIGURATION_PERMISSIONS.CREATE)
  @UsePipes(new ValidationPipe({ transform: true }))
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Body() createModelConfigurationDto: CreateModelConfigurationRequestDto,
    @Session() userSession: UserSession,
  ): Promise<ModelConfigurationResponseDto> {
    return this.modelConfigurationService.create(
      organisationId,
      createModelConfigurationDto,
      userSession.user.id,
    );
  }

  @Put(":id")
  @Permission(MODEL_CONFIGURATION_PERMISSIONS.UPDATE)
  @UsePipes(new ValidationPipe({ transform: true }))
  async update(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateModelConfigurationDto: UpdateModelConfigurationRequestDto,
    @Session() userSession: UserSession,
  ): Promise<ModelConfigurationResponseDto> {
    return this.modelConfigurationService.update(
      organisationId,
      id,
      updateModelConfigurationDto,
      userSession?.user?.id,
    );
  }

  @Delete(":id")
  @Permission(MODEL_CONFIGURATION_PERMISSIONS.DELETE)
  @UsePipes(new ValidationPipe({ transform: true }))
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Session() userSession: UserSession,
  ): Promise<void> {
    await this.modelConfigurationService.remove(
      organisationId,
      id,
      userSession?.user?.id,
    );
  }
}
