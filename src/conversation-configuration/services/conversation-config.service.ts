import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConversationConfiguration } from "../entities/conversation-configuration.entity";
import {
  CreateConversationConfigurationDto,
  UpdateConversationConfigurationDto,
} from "../dto/request/create-conversation-configuration.dto";
import { ConversationConfigurationResponseDto } from "../dto/response/conversation-configuration-response.dto";
import { ConversationConfigurationMapper } from "../mappers";
import { ConversationConfigYamlService } from "./conversation-config-yaml.service";
import { AuditService } from "../../audit/audit.service";

@Injectable()
export class ConversationConfigService {
  private readonly logger = new Logger(ConversationConfigService.name);

  constructor(
    @InjectRepository(ConversationConfiguration)
    private readonly conversationConfigRepository: Repository<ConversationConfiguration>,
    private readonly conversationConfigYamlService: ConversationConfigYamlService,
    private readonly auditService: AuditService,
  ) {}

  private async getByIdAndOrganisationOrThrow(
    organisationId: string,
    id: string,
  ): Promise<ConversationConfiguration> {
    const conversationConfig = await this.conversationConfigRepository.findOne({
      where: { id, organisationId },
    });

    if (!conversationConfig) {
      throw new NotFoundException(
        `Conversation configuration with ID ${id} not found`,
      );
    }

    return conversationConfig;
  }

  private toAuditState(c: ConversationConfiguration): Record<string, unknown> {
    return {
      id: c.id,
      name: c.name,
      description: c.description ?? null,
      stitchingAttributesName: c.stitchingAttributesName ?? [],
      organisationId: c.organisationId,
    };
  }

  async findAll(
    organisationId: string,
  ): Promise<ConversationConfigurationResponseDto[]> {
    const configs = await this.conversationConfigRepository.find({
      where: { organisationId },
      order: { createdAt: "DESC" },
    });

    return configs.map((config) =>
      ConversationConfigurationMapper.toResponseDto(config),
    );
  }

  async findById(
    organisationId: string,
    id: string,
  ): Promise<ConversationConfiguration | null> {
    return this.conversationConfigRepository.findOne({
      where: { id, organisationId },
    });
  }

  async create(
    organisationId: string,
    createConversationConfigurationDto: CreateConversationConfigurationDto,
    userId?: string,
  ): Promise<ConversationConfigurationResponseDto> {
    this.logger.debug(
      `Creating conversation configuration for organisation ${organisationId}`,
    );

    const savedConversationConfig =
      await this.conversationConfigRepository.save({
        ...createConversationConfigurationDto,
        organisationId,
      });

    this.logger.log(
      `Created conversation configuration ${savedConversationConfig.id}`,
    );

    await this.auditService.record({
      action: "conversation_configuration.created",
      actorId: userId,
      actorType: "user",
      resourceType: "conversation_configuration",
      resourceId: savedConversationConfig.id,
      organisationId,
      afterState: this.toAuditState(savedConversationConfig),
      metadata: { creatorId: userId ?? null, organisationId },
    });

    return ConversationConfigurationMapper.toResponseDto(
      savedConversationConfig,
    );
  }

  async update(
    organisationId: string,
    id: string,
    updateConversationConfigurationDto: UpdateConversationConfigurationDto,
    userId?: string,
  ): Promise<ConversationConfigurationResponseDto> {
    this.logger.debug(`Updating conversation configuration ${id}`);

    const conversationConfig = await this.getByIdAndOrganisationOrThrow(
      organisationId,
      id,
    );

    const beforeState = this.toAuditState(conversationConfig);

    Object.assign(conversationConfig, updateConversationConfigurationDto);

    const updatedConversationConfig =
      await this.conversationConfigRepository.save(conversationConfig);

    this.logger.log(`Updated conversation configuration ${id}`);

    await this.auditService.record({
      action: "conversation_configuration.updated",
      actorId: userId,
      actorType: "user",
      resourceType: "conversation_configuration",
      resourceId: id,
      organisationId,
      beforeState,
      afterState: this.toAuditState(updatedConversationConfig),
      metadata: {
        changedFields: Object.keys(updateConversationConfigurationDto),
        organisationId,
      },
    });

    return ConversationConfigurationMapper.toResponseDto(
      updatedConversationConfig,
    );
  }

  async remove(
    organisationId: string,
    id: string,
    userId?: string,
  ): Promise<void> {
    this.logger.debug(`Removing conversation configuration ${id}`);

    const conversationConfig = await this.getByIdAndOrganisationOrThrow(
      organisationId,
      id,
    );

    const beforeState = this.toAuditState(conversationConfig);

    await this.conversationConfigRepository.remove(conversationConfig);

    this.logger.log(`Removed conversation configuration ${id}`);

    await this.auditService.record({
      action: "conversation_configuration.deleted",
      actorId: userId,
      actorType: "user",
      resourceType: "conversation_configuration",
      resourceId: id,
      organisationId,
      beforeState,
      afterState: null,
      metadata: { organisationId },
    });
  }

  async exportToYaml(organisationId: string): Promise<string> {
    return this.conversationConfigYamlService.exportToYaml(organisationId);
  }

  async importFromYaml(
    organisationId: string,
    yamlContent: string,
    userId?: string,
  ): Promise<ConversationConfigurationResponseDto[]> {
    return this.conversationConfigYamlService.importFromYaml(
      organisationId,
      yamlContent,
      userId,
    );
  }
}
