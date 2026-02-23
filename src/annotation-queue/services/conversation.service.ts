import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { QueuedConversation } from "../entities/queued-conversation.entity";
import { QueuedConversationResponseDto } from "../dto/response/queued-conversation-response.dto";
import { MessageResponseDto } from "../dto/response/message-response.dto";
import { ConversationMapper } from "../mappers/conversation.mapper";
import { EnqueueConversationRequestDto } from "../dto/request/enqueue-conversation-request.dto";

@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    @InjectRepository(QueuedConversation)
    private readonly conversationRepository: Repository<QueuedConversation>,
  ) {}

  async addConversationToQueue(
    queueId: string,
    userId: string,
    createDto: EnqueueConversationRequestDto,
  ): Promise<QueuedConversationResponseDto> {
    const conversationExists = await this.conversationRepository.existsBy({
      queueId,
      conversationConfigId: createDto.conversationConfigId,
      datasourceId: createDto.datasourceId,
      otelConversationId: createDto.otelConversationId,
    });

    if (conversationExists) {
      throw new BadRequestException(
        "Conversation already exists in this queue",
      );
    }

    const conversation: QueuedConversation = this.conversationRepository.create(
      ConversationMapper.toEntity(createDto, queueId, userId),
    );

    const savedConversation =
      await this.conversationRepository.save(conversation);
    this.logger.log(
      `Added conversation ${createDto.otelConversationId} to queue ${queueId}`,
    );

    return ConversationMapper.toDto(savedConversation);
  }

  async removeConversationFromQueue(
    conversationId: string,
    queueId: string,
  ): Promise<MessageResponseDto> {
    const conversation = await this.conversationRepository.findOne({
      where: { id: conversationId, queueId },
    });

    if (!conversation) {
      throw new NotFoundException(
        formatError(
          ERROR_MESSAGES.CONVERSATION_NOT_FOUND,
          conversationId,
          queueId,
        ),
      );
    }

    await this.conversationRepository.remove(conversation);
    this.logger.log(
      `Removed conversation ${conversationId} from queue ${queueId}`,
    );

    return ConversationMapper.toMessageResponse(
      "Conversation removed from queue successfully",
    );
  }
}
