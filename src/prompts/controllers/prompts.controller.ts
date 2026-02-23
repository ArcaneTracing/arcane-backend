import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  NotFoundException,
} from "@nestjs/common";
import { PromptsService } from "../services/prompts.service";
import { PromptVersionsService } from "../services/prompt-versions.service";
import { PromptRunnerService } from "../services/prompt-runner.service";
import {
  CreatePromptRequestBodyDto,
  UpdatePromptRequestDto,
} from "../dto/request/create-prompt-request.dto";
import { RunPromptRequestDto } from "../dto/request/run-prompt-request.dto";
import { LLMServiceResponseDto } from "../dto/llm-service-request.dto";
import {
  PromptResponseDto,
  PromptVersionResponseDto,
  ListResponseDto,
  ResponseDto,
} from "../dto/response/prompt-response.dto";
import { OrgProjectPermissionGuard } from "../../rbac/guards/org-project-permission.guard";
import { Permission } from "../../rbac/decorators/permission.decorator";
import { PROMPT_PERMISSIONS } from "../../rbac/permissions/permissions";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";

@Controller("v1/organisations/:organisationId/projects/:projectId/prompts")
@UseGuards(OrgProjectPermissionGuard)
export class PromptsController {
  constructor(
    private readonly promptsService: PromptsService,
    private readonly promptVersionsService: PromptVersionsService,
    private readonly promptRunnerService: PromptRunnerService,
  ) {}

  @Get()
  async findAll(
    @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string,
  ): Promise<ListResponseDto<PromptResponseDto>> {
    return this.promptsService.findAll(projectId);
  }

  @Get(":prompt_identifier")
  @Permission(PROMPT_PERMISSIONS.READ)
  async findOne(
    @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string,
    @Param("prompt_identifier") promptIdentifier: string,
  ): Promise<ResponseDto<PromptResponseDto>> {
    const prompt = await this.promptsService.findOne(
      projectId,
      promptIdentifier,
    );
    if (!prompt) {
      throw new NotFoundException(`Prompt not found: ${promptIdentifier}`);
    }
    return { data: prompt };
  }

  @Get(":prompt_identifier/versions")
  @Permission(PROMPT_PERMISSIONS.READ)
  async findVersions(
    @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string,
    @Param("prompt_identifier") promptIdentifier: string,
  ): Promise<ListResponseDto<PromptVersionResponseDto>> {
    return this.promptVersionsService.findVersions(projectId, promptIdentifier);
  }

  @Get(":prompt_identifier/latest")
  @Permission(PROMPT_PERMISSIONS.READ)
  async findLatestVersion(
    @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string,
    @Param("prompt_identifier") promptIdentifier: string,
  ): Promise<ResponseDto<PromptVersionResponseDto>> {
    return this.promptVersionsService.findLatestVersion(
      projectId,
      promptIdentifier,
    );
  }

  @Post()
  @Permission(PROMPT_PERMISSIONS.CREATE)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" }))
    organisationId: string,
    @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string,
    @Body() body: CreatePromptRequestBodyDto,
    @Session() userSession: UserSession,
  ): Promise<ResponseDto<PromptVersionResponseDto>> {
    return this.promptsService.create(
      projectId,
      body,
      userSession?.user?.id,
      organisationId,
    );
  }

  @Patch(":prompt_identifier")
  @Permission(PROMPT_PERMISSIONS.UPDATE)
  async update(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" }))
    organisationId: string,
    @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string,
    @Param("prompt_identifier") promptIdentifier: string,
    @Body() updateDto: UpdatePromptRequestDto,
    @Session() userSession: UserSession,
  ): Promise<ResponseDto<PromptResponseDto>> {
    return this.promptsService.update(
      projectId,
      promptIdentifier,
      updateDto,
      userSession?.user?.id,
      organisationId,
    );
  }

  @Post("run")
  @Permission(PROMPT_PERMISSIONS.READ)
  async run(
    @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string,
    @Body() runDto: RunPromptRequestDto,
  ): Promise<ResponseDto<LLMServiceResponseDto>> {
    return this.promptRunnerService.run(projectId, runDto);
  }

  @Post(":prompt_identifier/versions/:version_id/promote")
  @Permission(PROMPT_PERMISSIONS.UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async promoteVersion(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" }))
    organisationId: string,
    @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string,
    @Param("prompt_identifier") promptIdentifier: string,
    @Param("version_id", new ParseUUIDPipe({ version: "4" })) versionId: string,
    @Session() userSession: UserSession,
  ): Promise<void> {
    await this.promptVersionsService.promoteVersion(
      projectId,
      promptIdentifier,
      versionId,
      userSession?.user?.id,
      organisationId,
    );
  }

  @Delete(":prompt_identifier")
  @Permission(PROMPT_PERMISSIONS.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" }))
    organisationId: string,
    @Param("projectId", new ParseUUIDPipe({ version: "4" })) projectId: string,
    @Param("prompt_identifier") promptIdentifier: string,
    @Session() userSession: UserSession,
  ): Promise<void> {
    await this.promptsService.remove(
      projectId,
      promptIdentifier,
      userSession?.user?.id,
      organisationId,
    );
  }
}
