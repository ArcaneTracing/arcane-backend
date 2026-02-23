import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { EntitiesService } from "../services/entities.service";
import {
  CreateEntityRequestDto,
  UpdateEntityRequestDto,
} from "../dto/request/create-entity.dto";
import { EntityResponseDto } from "../dto/response/entity-response.dto";
import { EntityMessageResponseDto } from "../dto/response/entity-message-response.dto";
import { OrgPermissionGuard } from "../../rbac/guards/org-permission.guard";
import { Permission } from "../../rbac/decorators/permission.decorator";
import { ENTITY_PERMISSIONS } from "../../rbac/permissions/permissions";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import { EntitiesYamlService } from "../services/entities-yaml.service";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";

@Controller("v1/organisations/:organisationId/entities")
@ApiTags("entities")
@ApiBearerAuth("bearer")
@UseGuards(OrgPermissionGuard)
export class EntitiesController {
  constructor(
    private readonly entitiesService: EntitiesService,
    private readonly entitiesYamlService: EntitiesYamlService,
  ) {}

  @Post()
  @Permission(ENTITY_PERMISSIONS.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  async create(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Body() createEntityDto: CreateEntityRequestDto,
    @Session() userSession: UserSession,
  ): Promise<EntityResponseDto> {
    return this.entitiesService.create(
      organisationId,
      userSession.user.id,
      createEntityDto,
    );
  }

  @Get()
  @Permission(ENTITY_PERMISSIONS.READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  async findAll(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
  ): Promise<EntityResponseDto[]> {
    return this.entitiesService.findAll(organisationId);
  }

  @Get("export")
  @Permission(ENTITY_PERMISSIONS.READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  async export(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Res() res: Response,
  ): Promise<void> {
    const yamlContent =
      await this.entitiesYamlService.exportToYaml(organisationId);

    res.setHeader("Content-Type", "application/x-yaml");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="entities-export.yaml"',
    );
    res.send(yamlContent);
  }

  @Post("import")
  @Permission(ENTITY_PERMISSIONS.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor("file"))
  @UsePipes(new ValidationPipe({ transform: true }))
  async import(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Session() userSession: UserSession,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<EntityResponseDto[]> {
    if (!file) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.YAML_FILE_REQUIRED),
      );
    }

    const allowedMimeTypes = [
      "application/x-yaml",
      "text/yaml",
      "text/plain",
      "application/yaml",
    ];
    const allowedExtensions = [".yaml", ".yml"];
    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf("."));

    if (
      !allowedMimeTypes.includes(file.mimetype) &&
      !allowedExtensions.includes(fileExtension)
    ) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.FILE_MUST_BE_YAML),
      );
    }

    const yamlContent = file.buffer.toString("utf-8");

    return this.entitiesYamlService.importFromYaml(
      organisationId,
      userSession.user.id,
      yamlContent,
    );
  }

  @Get(":id")
  @Permission(ENTITY_PERMISSIONS.READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  async findOne(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<EntityResponseDto> {
    return this.entitiesService.findOne(organisationId, id);
  }

  @Put(":id")
  @Permission(ENTITY_PERMISSIONS.UPDATE)
  @UsePipes(new ValidationPipe({ transform: true }))
  async update(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateEntityDto: UpdateEntityRequestDto,
    @Session() userSession: UserSession,
  ): Promise<EntityResponseDto> {
    return this.entitiesService.update(
      organisationId,
      id,
      updateEntityDto,
      userSession?.user?.id,
    );
  }

  @Delete(":id")
  @Permission(ENTITY_PERMISSIONS.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ValidationPipe({ transform: true }))
  async remove(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Session() userSession: UserSession,
  ): Promise<EntityMessageResponseDto> {
    return this.entitiesService.remove(
      organisationId,
      id,
      userSession?.user?.id,
    );
  }
}
