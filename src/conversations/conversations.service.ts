import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from "@nestjs/common";
import { DatasourcesService } from "../datasources/services/datasources.service";
import { ConversationConfigService } from "../conversation-configuration/services/conversation-config.service";
import { ProjectManagementService } from "../projects/services/project-management.service";
import { ConversationRepositoryFactory } from "./backends/conversation-repository.factory";
import { TraceAttributeObfuscationService } from "../traces/services/trace-attribute-obfuscation.service";
import { GetConversationsRequestDto } from "./dto/request/get-conversations-request.dto";
import { GetFullConversationRequestDto } from "./dto/request/get-full-conversation-request.dto";
import { GetConversationsByTracesRequestDto } from "./dto/request/get-conversations-by-traces-request.dto";
import {
  ConversationResponseDto,
  FullConversationResponseDto,
} from "./dto/response/conversation-response.dto";
import { Datasource } from "../datasources/entities/datasource.entity";
import { ConversationConfiguration } from "../conversation-configuration/entities/conversation-configuration.entity";
import {
  ERROR_MESSAGES,
  formatError,
} from "../common/constants/error-messages.constants";

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly datasourcesService: DatasourcesService,
    private readonly conversationConfigService: ConversationConfigService,
    private readonly projectManagementService: ProjectManagementService,
    private readonly conversationRepositoryFactory: ConversationRepositoryFactory,
    private readonly obfuscationService: TraceAttributeObfuscationService,
  ) {}

  private async getDatasourceOrThrow(
    organisationId: string,
    datasourceId: string,
  ): Promise<Datasource> {
    const datasource = await this.datasourcesService.findById(datasourceId);
    if (!datasource) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.DATASOURCE_NOT_FOUND, datasourceId),
      );
    }

    if (datasource.organisationId !== organisationId) {
      throw new ForbiddenException(
        formatError(ERROR_MESSAGES.DATASOURCE_DOES_NOT_BELONG_TO_ORGANISATION),
      );
    }

    return datasource;
  }

  private async getConversationConfigOrThrow(
    organisationId: string,
    conversationConfigId: string,
  ): Promise<ConversationConfiguration> {
    const conversationConfig = await this.conversationConfigService.findById(
      organisationId,
      conversationConfigId,
    );

    if (!conversationConfig) {
      throw new NotFoundException(
        formatError(
          ERROR_MESSAGES.CONVERSATION_CONFIG_NOT_FOUND,
          conversationConfigId,
        ),
      );
    }

    if (conversationConfig.stitchingAttributesName.length === 0) {
      throw new BadRequestException(
        "Conversation configuration must have at least one stitching attribute",
      );
    }

    return conversationConfig;
  }

  async getConversations(
    organisationId: string,
    projectId: string,
    datasourceId: string,
    conversationConfigId: string,
    userId: string,
    query: GetConversationsRequestDto,
  ): Promise<ConversationResponseDto> {
    this.logger.debug(
      `Getting conversations for project ${projectId}, datasource ${datasourceId}, config ${conversationConfigId}`,
      { userId },
    );

    const datasource = await this.getDatasourceOrThrow(
      organisationId,
      datasourceId,
    );
    const conversationConfig = await this.getConversationConfigOrThrow(
      organisationId,
      conversationConfigId,
    );

    const attributes = conversationConfig.stitchingAttributesName;

    const project =
      await this.projectManagementService.getByIdAndOrganisationOrThrow(
        organisationId,
        projectId,
      );

    const projectTraceFilter =
      project.traceFilterAttributeName && project.traceFilterAttributeValue
        ? {
            attributeName: project.traceFilterAttributeName,
            attributeValue: project.traceFilterAttributeValue,
          }
        : undefined;

    try {
      const repository = this.conversationRepositoryFactory.getRepository(
        datasource.source,
      );

      const conversations = await repository.getConversations(
        datasource,
        attributes,
        {
          start: query.start,
          end: query.end,
          projectTraceFilter,
        },
      );

      this.logger.log(
        `Found ${conversations.length} conversations for config ${conversationConfigId}`,
      );

      return {
        conversations,
      };
    } catch (error) {
      this.logger.error("Error getting conversations:", error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        "An error has occurred while getting conversations",
      );
    }
  }

  async getFullConversation(
    organisationId: string,
    projectId: string,
    datasourceId: string,
    conversationConfigId: string,
    userId: string,
    query: GetFullConversationRequestDto,
  ): Promise<FullConversationResponseDto> {
    this.logger.debug(
      `Getting full conversation for project ${projectId}, datasource ${datasourceId}, config ${conversationConfigId}`,
      { userId, value: query.value },
    );

    const datasource = await this.getDatasourceOrThrow(
      organisationId,
      datasourceId,
    );
    const conversationConfig = await this.getConversationConfigOrThrow(
      organisationId,
      conversationConfigId,
    );

    const attributes = conversationConfig.stitchingAttributesName;

    const project =
      await this.projectManagementService.getByIdAndOrganisationOrThrow(
        organisationId,
        projectId,
      );

    const projectTraceFilter =
      project.traceFilterAttributeName && project.traceFilterAttributeValue
        ? {
            attributeName: project.traceFilterAttributeName,
            attributeValue: project.traceFilterAttributeValue,
          }
        : undefined;

    try {
      const repository = this.conversationRepositoryFactory.getRepository(
        datasource.source,
      );
      const result = await repository.getFullConversation(
        datasource,
        attributes,
        {
          start: query.start,
          end: query.end,
          value: query.value,
          projectTraceFilter,
        },
      );
      if (result.traces?.length > 0) {
        result.traces = await Promise.all(
          result.traces.map(
            async (trace) =>
              (await this.obfuscationService.obfuscateTraceResponse(
                trace as unknown as Record<string, unknown>,
                projectId,
                organisationId,
                userId,
              )) as unknown as (typeof result.traces)[0],
          ),
        );
      }
      return result;
    } catch (error) {
      this.logger.error("Error getting full conversation:", error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        "An error has occurred while getting full conversation",
      );
    }
  }

  async getConversationsByTraceIds(
    organisationId: string,
    projectId: string,
    datasourceId: string,
    userId: string,
    findDto: GetConversationsByTracesRequestDto,
  ): Promise<FullConversationResponseDto> {
    this.logger.debug(
      `Getting conversations by trace IDs for project ${projectId}, datasource ${datasourceId}`,
      { userId, traceIds: findDto.traceIds },
    );

    const datasource = await this.getDatasourceOrThrow(
      organisationId,
      datasourceId,
    );

    const project =
      await this.projectManagementService.getByIdAndOrganisationOrThrow(
        organisationId,
        projectId,
      );

    const projectTraceFilter =
      project.traceFilterAttributeName && project.traceFilterAttributeValue
        ? {
            attributeName: project.traceFilterAttributeName,
            attributeValue: project.traceFilterAttributeValue,
          }
        : undefined;

    try {
      const repository = this.conversationRepositoryFactory.getRepository(
        datasource.source,
      );
      const result = await repository.getConversationsByTraceIds(datasource, {
        traceIds: findDto.traceIds,
        startDate: findDto.startDate,
        endDate: findDto.endDate,
        projectTraceFilter,
      });
      if (result.traces?.length > 0) {
        result.traces = await Promise.all(
          result.traces.map(
            async (trace) =>
              (await this.obfuscationService.obfuscateTraceResponse(
                trace as unknown as Record<string, unknown>,
                projectId,
                organisationId,
                userId,
              )) as unknown as (typeof result.traces)[0],
          ),
        );
      }
      return result;
    } catch (error) {
      this.logger.error("Error getting conversations by trace IDs:", error);
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        "An error has occurred while getting conversations by trace IDs",
      );
    }
  }
}
