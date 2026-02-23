import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ModelConfiguration } from "../entities/model-configuration.entity";
import {
  CreateModelConfigurationRequestDto,
  UpdateModelConfigurationRequestDto,
} from "../dto/request/create-model-configuration.dto";
import { ModelConfigurationResponseDto } from "../dto/response/model-configuration-response.dto";
import { ModelConfigurationMapper } from "../mappers";
import { ModelConfigurationProviderConfigValidator } from "../validators/model-configuration-provider-config.validator";
import { AuditService } from "../../audit/audit.service";
import { EncryptionService } from "../../common/encryption/services/encryption.service";
import { ModelConfigurationData } from "../dto/model-configuration-types";

@Injectable()
export class ModelConfigurationService {
  private readonly logger = new Logger(ModelConfigurationService.name);

  constructor(
    @InjectRepository(ModelConfiguration)
    private readonly modelConfigurationRepository: Repository<ModelConfiguration>,
    private readonly providerConfigValidator: ModelConfigurationProviderConfigValidator,
    private readonly auditService: AuditService,
    private readonly encryptionService: EncryptionService,
  ) {}

  private async getByIdAndOrganisationOrThrow(
    organisationId: string,
    id: string,
  ): Promise<ModelConfiguration> {
    const modelConfiguration = await this.modelConfigurationRepository.findOne({
      where: { id, organisationId },
    });

    if (!modelConfiguration) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.MODEL_CONFIGURATION_NOT_FOUND, id),
      );
    }

    return modelConfiguration;
  }

  private async getByIdOrThrow(id: string): Promise<ModelConfiguration> {
    const modelConfiguration = await this.modelConfigurationRepository.findOne({
      where: { id },
    });

    if (!modelConfiguration) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.MODEL_CONFIGURATION_NOT_FOUND, id),
      );
    }

    return modelConfiguration;
  }

  private toAuditState(m: ModelConfiguration): Record<string, unknown> {
    const config = m.configuration as { adapter?: string } | undefined;
    return {
      id: m.id,
      name: m.name,
      organisationId: m.organisationId,
      createdById: m.createdById,
      adapter: config?.adapter ?? null,
    };
  }

  private encryptIfNeeded(value: string | undefined): string | undefined {
    if (!value?.trim()) return undefined;
    if (this.encryptionService.isEncrypted(value)) return undefined;
    return this.encryptionService.encrypt(value);
  }

  private encryptProviderConfig(
    cfg: Record<string, unknown>,
  ): Record<string, unknown> {
    const configCopy = { ...cfg };
    const encAwsKey = this.encryptIfNeeded(configCopy.awsAccessKeyId as string);
    if (encAwsKey) configCopy.awsAccessKeyId = encAwsKey;
    const encAwsSecret = this.encryptIfNeeded(
      configCopy.awsSecretAccessKey as string,
    );
    if (encAwsSecret) configCopy.awsSecretAccessKey = encAwsSecret;
    if (configCopy.credentials != null) {
      const credsStr =
        typeof configCopy.credentials === "string"
          ? configCopy.credentials
          : JSON.stringify(configCopy.credentials);
      const encCreds = this.encryptIfNeeded(credsStr);
      if (encCreds) configCopy.credentials = encCreds;
    }
    return configCopy;
  }

  private encryptSensitiveFields(
    config: ModelConfigurationData,
  ): ModelConfigurationData {
    const result = { ...config };
    const encApiKey = this.encryptIfNeeded(result.apiKey);
    if (encApiKey) result.apiKey = encApiKey;
    if (result.config) {
      result.config = this.encryptProviderConfig(result.config);
    }
    return result;
  }

  private decryptSensitiveFields(
    config: ModelConfigurationData,
  ): ModelConfigurationData {
    const result = { ...config };
    if (
      result.apiKey?.trim() &&
      this.encryptionService.isEncrypted(result.apiKey)
    ) {
      result.apiKey = this.encryptionService.decrypt(result.apiKey);
    }
    const cfg = result.config;
    if (cfg) {
      const configCopy = { ...cfg };
      if (
        typeof configCopy.awsAccessKeyId === "string" &&
        this.encryptionService.isEncrypted(configCopy.awsAccessKeyId)
      ) {
        configCopy.awsAccessKeyId = this.encryptionService.decrypt(
          configCopy.awsAccessKeyId,
        );
      }
      if (
        typeof configCopy.awsSecretAccessKey === "string" &&
        this.encryptionService.isEncrypted(configCopy.awsSecretAccessKey)
      ) {
        configCopy.awsSecretAccessKey = this.encryptionService.decrypt(
          configCopy.awsSecretAccessKey,
        );
      }
      if (
        typeof configCopy.credentials === "string" &&
        this.encryptionService.isEncrypted(configCopy.credentials)
      ) {
        configCopy.credentials = JSON.parse(
          this.encryptionService.decrypt(configCopy.credentials),
        );
      }
      result.config = configCopy;
    }
    return result;
  }

  private maskSecret(value: string): string {
    return this.encryptionService.isEncrypted(value)
      ? "********"
      : this.encryptionService.getDisplaySecretKey(value);
  }

  private maskProviderConfig(
    cfg: Record<string, unknown>,
  ): Record<string, unknown> {
    const configCopy = { ...cfg };
    if (configCopy.awsAccessKeyId) {
      configCopy.awsAccessKeyId = this.maskSecret(
        configCopy.awsAccessKeyId as string,
      );
    }
    if (configCopy.awsSecretAccessKey) {
      configCopy.awsSecretAccessKey = this.maskSecret(
        configCopy.awsSecretAccessKey as string,
      );
    }
    if (configCopy.credentials) configCopy.credentials = "********";
    return configCopy;
  }

  private maskSensitiveFields(config: unknown): ModelConfigurationData {
    const c = config as ModelConfigurationData;
    const result = { ...c };
    if (result.apiKey) result.apiKey = this.maskSecret(result.apiKey);
    if (result.config) result.config = this.maskProviderConfig(result.config);
    return result;
  }

  private mergeConfigForUpdate(
    existing: ModelConfigurationData,
    update: Partial<ModelConfigurationData>,
  ): ModelConfigurationData {
    const merged = { ...existing, ...update };
    if (update.apiKey == null) {
      merged.apiKey = existing.apiKey;
    }
    if (update.config && typeof update.config === "object") {
      const existingConfig = existing.config ?? {};
      const updateConfig = update.config;
      const mergedConfig = { ...existingConfig, ...updateConfig };
      if (updateConfig.awsAccessKeyId == null) {
        mergedConfig.awsAccessKeyId = existingConfig.awsAccessKeyId;
      }
      if (updateConfig.awsSecretAccessKey == null) {
        mergedConfig.awsSecretAccessKey = existingConfig.awsSecretAccessKey;
      }
      if (updateConfig.credentials == null) {
        mergedConfig.credentials = existingConfig.credentials;
      }
      merged.config = mergedConfig;
    }
    return merged;
  }

  async findAll(
    organisationId: string,
  ): Promise<ModelConfigurationResponseDto[]> {
    const configurations = await this.modelConfigurationRepository.find({
      where: { organisationId },
      order: { createdAt: "DESC" },
    });

    return configurations.map((config) => {
      const maskedConfig = this.maskSensitiveFields(config.configuration);
      return ModelConfigurationMapper.toResponseDto({
        ...config,
        configuration: maskedConfig,
      });
    });
  }

  async findOne(
    organisationId: string,
    id: string,
  ): Promise<ModelConfigurationResponseDto> {
    const modelConfiguration = await this.getByIdAndOrganisationOrThrow(
      organisationId,
      id,
    );

    const maskedConfig = this.maskSensitiveFields(
      modelConfiguration.configuration,
    );
    return ModelConfigurationMapper.toResponseDto({
      ...modelConfiguration,
      configuration: maskedConfig,
    });
  }

  async findOneById(id: string): Promise<ModelConfigurationResponseDto> {
    this.logger.debug(`Finding model configuration ${id} by ID only`);

    const modelConfiguration = await this.getByIdOrThrow(id);

    const decryptedConfig = this.decryptSensitiveFields(
      modelConfiguration.configuration as ModelConfigurationData,
    );
    return ModelConfigurationMapper.toResponseDto({
      ...modelConfiguration,
      configuration: decryptedConfig,
    });
  }

  async create(
    organisationId: string,
    createModelConfigurationDto: CreateModelConfigurationRequestDto,
    userId: string,
  ): Promise<ModelConfigurationResponseDto> {
    const config = createModelConfigurationDto.configuration;

    this.providerConfigValidator.validate(config.adapter, config.config);

    const encryptedConfig = this.encryptSensitiveFields(config);

    const savedModelConfiguration =
      await this.modelConfigurationRepository.save({
        ...createModelConfigurationDto,
        configuration: encryptedConfig,
        organisationId,
        createdById: userId,
      });

    this.logger.log(
      `Created model configuration ${savedModelConfiguration.id}`,
    );

    await this.auditService.record({
      action: "model_configuration.created",
      actorId: userId,
      actorType: "user",
      resourceType: "model_configuration",
      resourceId: savedModelConfiguration.id,
      organisationId,
      afterState: this.toAuditState(savedModelConfiguration),
      metadata: { creatorId: userId, organisationId },
    });

    const maskedConfig = this.maskSensitiveFields(
      savedModelConfiguration.configuration,
    );
    return ModelConfigurationMapper.toResponseDto({
      ...savedModelConfiguration,
      configuration: maskedConfig,
    });
  }

  async update(
    organisationId: string,
    id: string,
    updateModelConfigurationDto: UpdateModelConfigurationRequestDto,
    userId?: string,
  ): Promise<ModelConfigurationResponseDto> {
    const existingConfiguration = await this.getByIdAndOrganisationOrThrow(
      organisationId,
      id,
    );

    const beforeState = this.toAuditState(existingConfiguration);

    if (updateModelConfigurationDto.configuration) {
      const config = updateModelConfigurationDto.configuration;
      this.providerConfigValidator.validate(config.adapter, config.config);
    }

    const existingConfig =
      existingConfiguration.configuration as ModelConfigurationData;
    const updateConfig = updateModelConfigurationDto.configuration;

    const mergedConfig = updateConfig
      ? this.mergeConfigForUpdate(existingConfig, updateConfig)
      : existingConfig;

    const encryptedConfig = this.encryptSensitiveFields(mergedConfig);

    Object.assign(existingConfiguration, {
      ...updateModelConfigurationDto,
      configuration: updateConfig
        ? encryptedConfig
        : existingConfiguration.configuration,
    });

    const updatedModelConfiguration =
      await this.modelConfigurationRepository.save(existingConfiguration);

    this.logger.log(`Updated model configuration ${id}`);

    await this.auditService.record({
      action: "model_configuration.updated",
      actorId: userId,
      actorType: "user",
      resourceType: "model_configuration",
      resourceId: id,
      organisationId,
      beforeState,
      afterState: this.toAuditState(updatedModelConfiguration),
      metadata: {
        changedFields: Object.keys(updateModelConfigurationDto),
        organisationId,
      },
    });

    const maskedConfig = this.maskSensitiveFields(
      updatedModelConfiguration.configuration,
    );
    return ModelConfigurationMapper.toResponseDto({
      ...updatedModelConfiguration,
      configuration: maskedConfig,
    });
  }

  async removeAll(): Promise<void> {
    this.logger.debug("Removing all model configurations");

    await this.modelConfigurationRepository.clear();

    this.logger.log("Removed all model configurations");
  }

  async remove(
    organisationId: string,
    id: string,
    userId?: string,
  ): Promise<void> {
    const existingConfiguration = await this.getByIdAndOrganisationOrThrow(
      organisationId,
      id,
    );

    const beforeState = this.toAuditState(existingConfiguration);

    await this.modelConfigurationRepository.remove(existingConfiguration);

    this.logger.log(`Removed model configuration ${id}`);

    await this.auditService.record({
      action: "model_configuration.deleted",
      actorId: userId,
      actorType: "user",
      resourceType: "model_configuration",
      resourceId: id,
      organisationId,
      beforeState,
      afterState: null,
      metadata: { organisationId },
    });
  }
}
