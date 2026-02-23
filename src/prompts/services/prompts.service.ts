import {
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Prompt } from "../entities/prompt.entity";
import { PromptVersion } from "../entities/prompt-version.entity";
import { ModelConfiguration } from "../../model-configuration/entities/model-configuration.entity";
import {
  CreatePromptRequestBodyDto,
  UpdatePromptRequestDto,
} from "../dto/request/create-prompt-request.dto";
import {
  PromptResponseDto,
  PromptVersionResponseDto,
  ListResponseDto,
  ResponseDto,
} from "../dto/response/prompt-response.dto";
import { IdentifierUtils } from "../utils/identifier.utils";
import { TemplateType, TemplateFormat } from "../dto/prompt-types";
import { PromptMapper } from "../mappers/prompt.mapper";
import { PromptVersionMapper } from "../mappers/prompt-version.mapper";
import { PromptVersionsService } from "./prompt-versions.service";
import { PromptConfigValidator } from "../validators/prompt-config.validator";
import { ModelProviderMapper } from "../mappers/model-provider.mapper";
import { AuditService } from "../../audit/audit.service";

@Injectable()
export class PromptsService {
  private readonly logger = new Logger(PromptsService.name);

  constructor(
    @InjectRepository(Prompt)
    private readonly promptRepository: Repository<Prompt>,
    @InjectRepository(PromptVersion)
    private readonly promptVersionRepository: Repository<PromptVersion>,
    @InjectRepository(ModelConfiguration)
    private readonly modelConfigurationRepository: Repository<ModelConfiguration>,
    private readonly promptVersionsService: PromptVersionsService,
    private readonly promptConfigValidator: PromptConfigValidator,
    private readonly auditService: AuditService,
  ) {}

  private toAuditState(p: Prompt): Record<string, unknown> {
    return {
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      projectId: p.projectId,
      metadata: p.metadata ?? {},
    };
  }

  async findOne(
    projectId: string,
    promptIdentifier: string,
  ): Promise<PromptResponseDto | null> {
    const prompt = await this.promptVersionsService.findPromptByIdentifier(
      projectId,
      promptIdentifier,
    );
    if (!prompt) {
      return null;
    }
    return PromptMapper.toDto(prompt);
  }

  async findAll(
    projectId: string,
  ): Promise<ListResponseDto<PromptResponseDto>> {
    this.logger.debug(`Finding all prompts for project ${projectId}`);

    const prompts = await this.promptRepository.find({
      where: { projectId },
      order: { createdAt: "DESC" },
    });

    return {
      data: prompts.map((prompt) => PromptMapper.toDto(prompt)),
    };
  }

  async create(
    projectId: string,
    body: CreatePromptRequestBodyDto,
    userId: string,
    organisationId: string,
  ): Promise<ResponseDto<PromptVersionResponseDto>> {
    this.logger.debug(`Creating prompt with version in project ${projectId}`);

    if (body.version.templateType !== TemplateType.CHAT) {
      throw new UnprocessableEntityException(
        "Only CHAT template type is currently supported",
      );
    }

    this.promptConfigValidator.validateTemplateType(
      body.version.templateType,
      body.version.template,
    );

    const modelConfiguration = await this.modelConfigurationRepository.findOne({
      where: { id: body.version.modelConfigurationId },
    });

    if (!modelConfiguration) {
      throw new NotFoundException(
        `Model configuration with ID ${body.version.modelConfigurationId} not found`,
      );
    }

    const config = modelConfiguration.configuration as { adapter: string };
    const provider = ModelProviderMapper.fromAdapter(config.adapter);
    this.promptConfigValidator.validateInvocationParameters(
      provider,
      body.version.invocationParameters,
    );

    const validatedName = IdentifierUtils.validate(body.prompt.name);

    let prompt = await this.promptRepository.findOne({
      where: { projectId, name: validatedName },
    });
    const isNewPrompt = !prompt;
    if (!prompt) {
      prompt = await this.promptRepository.save(
        PromptMapper.toEntity({
          name: validatedName,
          description: body.prompt.description || null,
          metadata: body.prompt.metadata || {},
          projectId,
        }),
      );
    } else if (body.prompt.description !== undefined) {
      prompt.description = body.prompt.description || null;
      await this.promptRepository.save(prompt);
    }

    const existingCount = await this.promptVersionRepository.count({
      where: { promptId: prompt.id },
    });
    const versionName = `v${existingCount}`;

    const versionPayload = {
      ...body.version,
      versionName,
      templateFormat: body.version.templateFormat ?? TemplateFormat.NONE,
    };

    const savedVersion = await this.promptVersionRepository.save(
      PromptVersionMapper.toEntity({
        promptId: prompt.id,
        prompt,
        userId,
        modelConfiguration,
        version: versionPayload,
      }),
    );

    if (isNewPrompt) {
      prompt.promotedVersionId = savedVersion.id;
      await this.promptRepository.save(prompt);
    }

    const auditAction = isNewPrompt
      ? "prompt.created"
      : "prompt.version_created";

    await this.auditService.record({
      action: auditAction,
      actorId: userId,
      actorType: "user",
      resourceType: "prompt",
      resourceId: prompt.id,
      organisationId,
      projectId,
      afterState: this.toAuditState(prompt),
      metadata: {
        creatorId: userId,
        organisationId,
        projectId,
        initialVersionId: savedVersion.id,
      },
    });

    return {
      data: PromptVersionMapper.toDto(savedVersion, true),
    };
  }

  async update(
    projectId: string,
    promptIdentifier: string,
    updateDto: UpdatePromptRequestDto,
    userId?: string,
    organisationId?: string,
  ): Promise<ResponseDto<PromptResponseDto>> {
    this.logger.debug(
      `Updating prompt: ${promptIdentifier} in project ${projectId}`,
    );

    const prompt =
      await this.promptVersionsService.getPromptByIdentifierOrThrow(
        projectId,
        promptIdentifier,
      );

    if (prompt.projectId !== projectId) {
      throw new ForbiddenException("Prompt does not belong to this project");
    }

    const beforeState = this.toAuditState(prompt);

    if (updateDto.name !== undefined) {
      const validatedName = IdentifierUtils.validate(updateDto.name);

      const existingPrompt = await this.promptRepository.findOne({
        where: { name: validatedName, projectId },
      });

      if (existingPrompt && existingPrompt.id !== prompt.id) {
        throw new UnprocessableEntityException(
          `Prompt with name "${validatedName}" already exists in this project`,
        );
      }

      prompt.name = validatedName;
    }

    if (updateDto.description !== undefined) {
      prompt.description = updateDto.description || null;
    }

    const updatedPrompt = await this.promptRepository.save(prompt);
    this.logger.log(`Updated prompt: ${updatedPrompt.id}`);

    if (organisationId) {
      await this.auditService.record({
        action: "prompt.updated",
        actorId: userId,
        actorType: "user",
        resourceType: "prompt",
        resourceId: prompt.id,
        organisationId,
        projectId,
        beforeState,
        afterState: this.toAuditState(updatedPrompt),
        metadata: {
          changedFields: Object.keys(updateDto),
          organisationId,
          projectId,
        },
      });
    }

    return {
      data: PromptMapper.toDto(updatedPrompt),
    };
  }

  async remove(
    projectId: string,
    promptIdentifier: string,
    userId?: string,
    organisationId?: string,
  ): Promise<void> {
    this.logger.debug(
      `Deleting prompt: ${promptIdentifier} in project ${projectId}`,
    );

    const prompt =
      await this.promptVersionsService.getPromptByIdentifierOrThrow(
        projectId,
        promptIdentifier,
      );

    if (!prompt) {
      throw new NotFoundException("Prompt not found");
    }

    const beforeState = this.toAuditState(prompt);

    await this.promptRepository.remove(prompt);
    this.logger.log(`Deleted prompt: ${prompt.id} and all its versions`);

    if (organisationId) {
      await this.auditService.record({
        action: "prompt.deleted",
        actorId: userId,
        actorType: "user",
        resourceType: "prompt",
        resourceId: prompt.id,
        organisationId,
        projectId,
        beforeState,
        afterState: null,
        metadata: { organisationId, projectId },
      });
    }
  }
}
