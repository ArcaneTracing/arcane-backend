import { ConversationConfiguration } from "../entities/conversation-configuration.entity";
import { ConversationConfigurationResponseDto } from "../dto/response/conversation-configuration-response.dto";

export class ConversationConfigurationMapper {
  static toResponseDto(
    conversationConfiguration: ConversationConfiguration,
  ): ConversationConfigurationResponseDto {
    return {
      id: conversationConfiguration.id,
      name: conversationConfiguration.name,
      description: conversationConfiguration.description,
      stitchingAttributesName:
        conversationConfiguration.stitchingAttributesName,
      createdAt: conversationConfiguration.createdAt,
      updatedAt: conversationConfiguration.updatedAt,
    };
  }
}
