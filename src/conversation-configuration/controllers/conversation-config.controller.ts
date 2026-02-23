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
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import { ConversationConfigService } from "../services/conversation-config.service";
import {
  CreateConversationConfigurationDto,
  UpdateConversationConfigurationDto,
} from "../dto/request/create-conversation-configuration.dto";
import { ConversationConfigurationResponseDto } from "../dto/response/conversation-configuration-response.dto";
import { OrgPermissionGuard } from "../../rbac/guards/org-permission.guard";
import { Permission } from "../../rbac/decorators/permission.decorator";
import { CONVERSATION_CONFIG_PERMISSIONS } from "../../rbac/permissions/permissions";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiBearerAuth,
  ApiConsumes,
} from "@nestjs/swagger";

@Controller("v1/organisations/:organisationId/conversation-configurations")
@ApiTags("conversation-configuration")
@ApiBearerAuth("bearer")
@UseGuards(OrgPermissionGuard)
export class ConversationConfigController {
  constructor(
    private readonly conversationConfigService: ConversationConfigService,
  ) {}

  @Get()
  @Permission(CONVERSATION_CONFIG_PERMISSIONS.READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: "List conversation configurations",
    description: "Get all conversation configurations for an organisation",
  })
  @ApiParam({
    name: "organisationId",
    type: "string",
    format: "uuid",
    description: "Organisation ID",
  })
  @ApiResponse({
    status: 200,
    description: "List of conversation configurations",
    type: [ConversationConfigurationResponseDto],
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async findAll(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
  ): Promise<ConversationConfigurationResponseDto[]> {
    return this.conversationConfigService.findAll(organisationId);
  }
  @Get("export")
  @Permission(CONVERSATION_CONFIG_PERMISSIONS.READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: "Export conversation configurations",
    description:
      "Export all conversation configurations for an organisation as a YAML file",
  })
  @ApiParam({
    name: "organisationId",
    type: "string",
    format: "uuid",
    description: "Organisation ID",
  })
  @ApiResponse({
    status: 200,
    description: "YAML file containing conversation configurations",
    content: { "application/x-yaml": {} },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async export(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Res() res: Response,
  ): Promise<void> {
    const yamlContent =
      await this.conversationConfigService.exportToYaml(organisationId);

    res.setHeader("Content-Type", "application/x-yaml");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="conversation-configurations-export.yaml"',
    );
    res.send(yamlContent);
  }

  @Post("import")
  @Permission(CONVERSATION_CONFIG_PERMISSIONS.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor("file"))
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: "Import conversation configurations",
    description: "Import conversation configurations from a YAML file",
  })
  @ApiParam({
    name: "organisationId",
    type: "string",
    format: "uuid",
    description: "Organisation ID",
  })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({
    status: 201,
    description: "Conversation configurations imported successfully",
    type: [ConversationConfigurationResponseDto],
  })
  @ApiResponse({
    status: 400,
    description: "Bad request - invalid file or file format",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async import(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @UploadedFile() file: Express.Multer.File,
    @Session() userSession: UserSession,
  ): Promise<ConversationConfigurationResponseDto[]> {
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

    return this.conversationConfigService.importFromYaml(
      organisationId,
      yamlContent,
      userSession?.user?.id,
    );
  }

  @Post()
  @Permission(CONVERSATION_CONFIG_PERMISSIONS.CREATE)
  @UsePipes(new ValidationPipe({ transform: true }))
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create conversation configuration",
    description: "Create a new conversation configuration for an organisation",
  })
  @ApiParam({
    name: "organisationId",
    type: "string",
    format: "uuid",
    description: "Organisation ID",
  })
  @ApiBody({ type: CreateConversationConfigurationDto })
  @ApiResponse({
    status: 201,
    description: "Conversation configuration created successfully",
    type: ConversationConfigurationResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request - validation error" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async create(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Body()
    createConversationConfigurationDto: CreateConversationConfigurationDto,
    @Session() userSession: UserSession,
  ): Promise<ConversationConfigurationResponseDto> {
    return this.conversationConfigService.create(
      organisationId,
      createConversationConfigurationDto,
      userSession?.user?.id,
    );
  }

  @Put(":id")
  @Permission(CONVERSATION_CONFIG_PERMISSIONS.UPDATE)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: "Update conversation configuration",
    description: "Update an existing conversation configuration",
  })
  @ApiParam({
    name: "organisationId",
    type: "string",
    format: "uuid",
    description: "Organisation ID",
  })
  @ApiParam({
    name: "id",
    type: "string",
    format: "uuid",
    description: "Conversation configuration ID",
  })
  @ApiBody({ type: UpdateConversationConfigurationDto })
  @ApiResponse({
    status: 200,
    description: "Conversation configuration updated successfully",
    type: ConversationConfigurationResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request - validation error" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({
    status: 404,
    description: "Conversation configuration not found",
  })
  async update(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body()
    updateConversationConfigurationDto: UpdateConversationConfigurationDto,
    @Session() userSession: UserSession,
  ): Promise<ConversationConfigurationResponseDto> {
    return this.conversationConfigService.update(
      organisationId,
      id,
      updateConversationConfigurationDto,
      userSession?.user?.id,
    );
  }

  @Delete(":id")
  @Permission(CONVERSATION_CONFIG_PERMISSIONS.DELETE)
  @UsePipes(new ValidationPipe({ transform: true }))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete conversation configuration",
    description: "Delete a conversation configuration",
  })
  @ApiParam({
    name: "organisationId",
    type: "string",
    format: "uuid",
    description: "Organisation ID",
  })
  @ApiParam({
    name: "id",
    type: "string",
    format: "uuid",
    description: "Conversation configuration ID",
  })
  @ApiResponse({
    status: 204,
    description: "Conversation configuration deleted successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({
    status: 404,
    description: "Conversation configuration not found",
  })
  async remove(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Session() userSession: UserSession,
  ): Promise<void> {
    await this.conversationConfigService.remove(
      organisationId,
      id,
      userSession?.user?.id,
    );
  }
}
