import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as yaml from "js-yaml";
import { ConversationConfiguration } from "../entities/conversation-configuration.entity";
import { ConversationConfigurationResponseDto } from "../dto/response/conversation-configuration-response.dto";
import { ConversationConfigurationMapper } from "../mappers";
import { ConversationConfigImportParser } from "../validators/conversation-config-import.parser";
import { ConversationConfigImportValidator } from "../validators/conversation-config-import.validator";
import { AuditService } from "../../audit/audit.service";

@Injectable()
export class ConversationConfigYamlService {
  private readonly logger = new Logger(ConversationConfigYamlService.name);

  constructor(
    @InjectRepository(ConversationConfiguration)
    private readonly conversationConfigRepository: Repository<ConversationConfiguration>,
    private readonly importParser: ConversationConfigImportParser,
    private readonly importValidator: ConversationConfigImportValidator,
    private readonly auditService: AuditService,
  ) {}

  async exportToYaml(organisationId: string): Promise<string> {
    this.logger.debug(
      `Exporting conversation configurations to YAML for organisation ${organisationId}`,
    );

    const configs = await this.conversationConfigRepository.find({
      where: { organisationId },
      order: { createdAt: "DESC" },
    });

    const configsForExport = configs.map((config) => {
      const exportConfig: Record<string, unknown> = {
        name: config.name,
        description: config.description,
        stitchingAttributesName: config.stitchingAttributesName,
      };

      Object.keys(exportConfig).forEach((key) => {
        if (exportConfig[key] === null || exportConfig[key] === undefined) {
          delete exportConfig[key];
        }
      });

      return exportConfig;
    });

    const yamlData = {
      version: "1.0",
      conversationConfigurations: configsForExport,
    };

    return yaml.dump(yamlData, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    });
  }

  async importFromYaml(
    organisationId: string,
    yamlContent: string,
    userId?: string,
  ): Promise<ConversationConfigurationResponseDto[]> {
    this.logger.debug(
      `Importing conversation configurations from YAML for organisation ${organisationId}`,
    );

    const parsedYaml = this.importParser.parse(yamlContent);
    const configsArray = this.importParser.extractConfigArray(parsedYaml);
    const validatedConfigs = this.importValidator.validateItems(configsArray);
    const entityConfigs = validatedConfigs.map((config) => ({
      ...config,
      organisationId,
    }));
    const savedConfigs =
      await this.conversationConfigRepository.save(entityConfigs);

    await this.auditService.record({
      action: "conversation_configurations.imported",
      actorId: userId,
      actorType: "user",
      resourceType: "conversation_configuration",
      resourceId: organisationId,
      organisationId,
      afterState: {
        count: savedConfigs.length,
        configIds: savedConfigs.map((c) => c.id).slice(0, 50),
      },
      metadata: {
        organisationId,
        importedById: userId ?? null,
        count: savedConfigs.length,
      },
    });

    return savedConfigs.map((savedConfig) =>
      ConversationConfigurationMapper.toResponseDto(savedConfig),
    );
  }
}
