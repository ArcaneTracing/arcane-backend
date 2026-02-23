import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, In } from "typeorm";
import { Datasource } from "../entities/datasource.entity";
import {
  CreateDatasourceDto,
  UpdateDatasourceDto,
} from "../dto/request/create-datasource.dto";
import { DatasourceResponseDto } from "../dto/response/datasource-response.dto";
import { DatasourceListItemResponseDto } from "../dto/response/datasource-list-item-response.dto";
import { DatasourceMapper } from "../mappers";
import { DatasourceMessageResponseDto } from "../dto/response/datasource-message-response.dto";
import { DatasourceConfigValidator } from "../validators/datasource-config.validator";
import { AuditService } from "../../audit/audit.service";
import { DatasourceConfigEncryptionService } from "./datasource-config-encryption.service";

@Injectable()
export class DatasourcesService {
  private readonly logger = new Logger(DatasourcesService.name);

  constructor(
    @InjectRepository(Datasource)
    private readonly datasourceRepository: Repository<Datasource>,
    private readonly datasourceConfigValidator: DatasourceConfigValidator,
    private readonly auditService: AuditService,
    private readonly configEncryptionService: DatasourceConfigEncryptionService,
  ) {}

  private toAuditState(d: Datasource): Record<string, unknown> {
    return {
      id: d.id,
      name: d.name,
      description: d.description ?? null,
      url: d.url ?? null,
      type: d.type,
      source: d.source,
      organisationId: d.organisationId,
    };
  }

  async create(
    organisationId: string,
    userId: string,
    createDatasourceDto: CreateDatasourceDto,
  ): Promise<DatasourceResponseDto> {
    this.datasourceConfigValidator.validate(
      createDatasourceDto.url,
      createDatasourceDto.source,
      createDatasourceDto.config,
    );

    const encryptedConfig = createDatasourceDto.config
      ? this.configEncryptionService.encryptConfig(
          createDatasourceDto.source,
          createDatasourceDto.config,
        )
      : null;

    const datasource = this.datasourceRepository.create({
      ...createDatasourceDto,
      config: encryptedConfig,
      createdById: userId,
      organisationId: organisationId,
    });

    const savedDatasource = await this.datasourceRepository.save(datasource);

    await this.auditService.record({
      action: "datasource.created",
      actorId: userId,
      actorType: "user",
      resourceType: "datasource",
      resourceId: savedDatasource.id,
      organisationId,
      afterState: this.toAuditState(savedDatasource),
      metadata: { creatorId: userId, organisationId },
    });

    DatasourceMapper.setConfigEncryptionService(this.configEncryptionService);
    return DatasourceMapper.toResponseDto(savedDatasource);
  }

  async findAll(organisationId: string): Promise<DatasourceResponseDto[]> {
    const datasources = await this.datasourceRepository.find({
      where: { organisationId: organisationId },
      order: { name: "ASC" },
    });

    DatasourceMapper.setConfigEncryptionService(this.configEncryptionService);
    return datasources.map((datasource) =>
      DatasourceMapper.toResponseDto(datasource),
    );
  }

  async findAllListItems(
    organisationId: string,
  ): Promise<DatasourceListItemResponseDto[]> {
    const datasources = await this.datasourceRepository.find({
      where: { organisationId: organisationId },
      order: { name: "ASC" },
    });

    return datasources.map((datasource) =>
      DatasourceMapper.toListItemDto(datasource),
    );
  }

  async update(
    organisationId: string,
    id: string,
    updateDatasourceDto: UpdateDatasourceDto,
    userId?: string,
  ): Promise<DatasourceResponseDto> {
    const datasource = await this.datasourceRepository.findOne({
      where: { id, organisationId },
    });

    if (!datasource) {
      throw new NotFoundException(
        `Datasource with ID ${id} not found in organisation ${organisationId}`,
      );
    }

    const beforeState = this.toAuditState(datasource);

    const normalizedDto = { ...updateDatasourceDto };
    if (normalizedDto.url === "") {
      normalizedDto.url = null;
    }

    const source = normalizedDto.source || datasource.source;
    if (normalizedDto.url !== undefined || normalizedDto.config !== undefined) {
      const urlToValidate =
        "url" in updateDatasourceDto ? normalizedDto.url : datasource.url;
      this.datasourceConfigValidator.validate(
        urlToValidate,
        source,
        normalizedDto.config ?? datasource.config,
      );
    }

    if (normalizedDto.config !== undefined) {
      const mergedConfig = datasource.config
        ? { ...datasource.config, ...normalizedDto.config }
        : normalizedDto.config;
      normalizedDto.config = this.configEncryptionService.encryptConfig(
        source,
        mergedConfig,
      );
    }

    Object.assign(datasource, normalizedDto);
    const updatedDatasource = await this.datasourceRepository.save(datasource);

    await this.auditService.record({
      action: "datasource.updated",
      actorId: userId,
      actorType: "user",
      resourceType: "datasource",
      resourceId: id,
      organisationId,
      beforeState,
      afterState: this.toAuditState(updatedDatasource),
      metadata: {
        changedFields: Object.keys(updateDatasourceDto),
        organisationId,
      },
    });

    DatasourceMapper.setConfigEncryptionService(this.configEncryptionService);
    return DatasourceMapper.toResponseDto(updatedDatasource);
  }

  async remove(
    organisationId: string,
    id: string,
    userId?: string,
  ): Promise<DatasourceMessageResponseDto> {
    const datasource = await this.datasourceRepository.findOne({
      where: { id, organisationId },
    });

    if (!datasource) {
      throw new NotFoundException(
        `Datasource with ID ${id} not found in organisation ${organisationId}`,
      );
    }

    const beforeState = this.toAuditState(datasource);

    await this.datasourceRepository.remove(datasource);
    this.logger.log(
      `Removed datasource ${id} from organisation ${organisationId}`,
    );

    await this.auditService.record({
      action: "datasource.deleted",
      actorId: userId,
      actorType: "user",
      resourceType: "datasource",
      resourceId: id,
      organisationId,
      beforeState,
      afterState: null,
      metadata: { organisationId },
    });

    return { message: "Datasource deleted successfully" };
  }

  async findById(id: string): Promise<Datasource> {
    const datasource = await this.datasourceRepository.findOne({
      where: { id },
    });
    if (!datasource) {
      throw new NotFoundException(`Datasource with ID ${id} not found`);
    }
    return datasource;
  }

  async findByIds(ids: string[]): Promise<Datasource[]> {
    if (!ids || ids.length === 0) {
      return [];
    }
    return this.datasourceRepository.find({
      where: { id: In(ids) },
    });
  }
}
