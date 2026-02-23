import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Prompt } from "../entities/prompt.entity";
import { PromptVersion } from "../entities/prompt-version.entity";
import { AuditService } from "../../audit/audit.service";
import {
  ListResponseDto,
  PromptVersionResponseDto,
  ResponseDto,
} from "../dto/response/prompt-response.dto";
import { PromptVersionMapper } from "../mappers/prompt-version.mapper";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";

@Injectable()
export class PromptVersionsService {
  private readonly logger = new Logger(PromptVersionsService.name);

  constructor(
    @InjectRepository(Prompt)
    private readonly promptRepository: Repository<Prompt>,
    @InjectRepository(PromptVersion)
    private readonly promptVersionRepository: Repository<PromptVersion>,
    private readonly auditService: AuditService,
  ) {}

  async findPromptByIdentifier(
    projectId: string,
    identifier: string,
  ): Promise<Prompt | null> {
    const byId = await this.promptRepository.findOne({
      where: { id: identifier, projectId },
    });
    if (byId) {
      return byId;
    }
    return this.promptRepository.findOne({
      where: { name: identifier, projectId },
    });
  }

  async getPromptByIdentifierOrThrow(
    projectId: string,
    identifier: string,
  ): Promise<Prompt> {
    const prompt = await this.findPromptByIdentifier(projectId, identifier);
    if (!prompt) {
      throw new NotFoundException(`Prompt not found: ${identifier}`);
    }
    return prompt;
  }

  async findVersions(
    projectId: string,
    promptIdentifier: string,
  ): Promise<ListResponseDto<PromptVersionResponseDto>> {
    this.logger.debug(
      `Finding versions for prompt: ${promptIdentifier} in project ${projectId}`,
    );

    const prompt = await this.getPromptByIdentifierOrThrow(
      projectId,
      promptIdentifier,
    );

    if (prompt.projectId !== projectId) {
      throw new ForbiddenException(
        formatError(ERROR_MESSAGES.PROMPT_DOES_NOT_BELONG_TO_PROJECT),
      );
    }

    const versions = await this.promptVersionRepository.find({
      where: { promptId: prompt.id },
      relations: ["modelConfiguration"],
      order: { createdAt: "DESC" },
    });

    return {
      data: versions.map((version) =>
        PromptVersionMapper.toDto(version, false),
      ),
    };
  }

  async findVersionById(
    projectId: string,
    promptVersionId: string,
  ): Promise<ResponseDto<PromptVersionResponseDto>> {
    this.logger.debug(
      `Finding prompt version: ${promptVersionId} in project ${projectId}`,
    );

    const version = await this.promptVersionRepository.findOne({
      where: { id: promptVersionId },
      relations: ["prompt", "modelConfiguration"],
    });

    if (!version) {
      throw new NotFoundException(
        `Prompt version not found: ${promptVersionId}`,
      );
    }

    if (version.prompt.projectId !== projectId) {
      throw new ForbiddenException(
        formatError(ERROR_MESSAGES.PROMPT_VERSION_DOES_NOT_BELONG_TO_PROJECT),
      );
    }

    return {
      data: PromptVersionMapper.toDto(version, true),
    };
  }

  async findLatestVersion(
    projectId: string,
    promptIdentifier: string,
  ): Promise<ResponseDto<PromptVersionResponseDto>> {
    const version = await this.getLatestVersionEntity(
      projectId,
      promptIdentifier,
    );
    return {
      data: PromptVersionMapper.toDto(version, true),
    };
  }

  async getLatestVersionByPromptId(promptId: string): Promise<PromptVersion> {
    this.logger.debug(`Finding latest version for prompt ID: ${promptId}`);

    const prompt = await this.promptRepository.findOne({
      where: { id: promptId },
    });
    if (!prompt) {
      throw new NotFoundException(`Prompt not found: ${promptId}`);
    }

    return this.getLatestVersionEntity(prompt.projectId, prompt.id);
  }

  async getLatestVersionEntity(
    projectId: string,
    promptIdentifier: string,
  ): Promise<PromptVersion> {
    this.logger.debug(
      `Finding latest version for prompt: ${promptIdentifier} in project ${projectId}`,
    );

    const prompt = await this.getPromptByIdentifierOrThrow(
      projectId,
      promptIdentifier,
    );

    if (prompt.projectId !== projectId) {
      throw new ForbiddenException(
        formatError(ERROR_MESSAGES.PROMPT_DOES_NOT_BELONG_TO_PROJECT),
      );
    }

    if (prompt.promotedVersionId) {
      const promoted = await this.promptVersionRepository.findOne({
        where: { id: prompt.promotedVersionId, promptId: prompt.id },
        relations: ["prompt", "modelConfiguration"],
      });
      if (promoted) {
        return promoted;
      }
    }

    const version = await this.promptVersionRepository.findOne({
      where: { promptId: prompt.id },
      relations: ["prompt", "modelConfiguration"],
      order: { createdAt: "DESC" },
    });

    if (!version) {
      throw new NotFoundException(
        `No versions found for prompt: ${promptIdentifier}`,
      );
    }

    return version;
  }

  async promoteVersion(
    projectId: string,
    promptIdentifier: string,
    versionId: string,
    userId?: string,
    organisationId?: string,
  ): Promise<void> {
    this.logger.debug(
      `Promoting version ${versionId} for prompt: ${promptIdentifier} in project ${projectId}`,
    );

    const prompt = await this.getPromptByIdentifierOrThrow(
      projectId,
      promptIdentifier,
    );

    if (prompt.projectId !== projectId) {
      throw new ForbiddenException(
        formatError(ERROR_MESSAGES.PROMPT_DOES_NOT_BELONG_TO_PROJECT),
      );
    }

    const version = await this.promptVersionRepository.findOne({
      where: { id: versionId, promptId: prompt.id },
    });

    if (!version) {
      throw new NotFoundException(
        `Prompt version ${versionId} not found for prompt: ${promptIdentifier}`,
      );
    }

    const previousPromotedVersionId = prompt.promotedVersionId ?? undefined;

    prompt.promotedVersionId = versionId;
    await this.promptRepository.save(prompt);
    this.logger.log(`Promoted version ${versionId} for prompt ${prompt.id}`);

    if (organisationId) {
      await this.auditService.record({
        action: "prompt.version_promoted",
        actorId: userId,
        actorType: "user",
        resourceType: "prompt",
        resourceId: prompt.id,
        organisationId,
        projectId,
        afterState: { promotedVersionId: versionId },
        metadata: {
          versionId,
          versionName: version.versionName ?? null,
          previousPromotedVersionId: previousPromotedVersionId ?? null,
          organisationId,
          projectId,
        },
      });
    }
  }
}
