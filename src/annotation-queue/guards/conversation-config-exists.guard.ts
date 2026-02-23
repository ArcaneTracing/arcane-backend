import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConversationConfiguration } from "../../conversation-configuration/entities/conversation-configuration.entity";

@Injectable()
export class ConversationConfigExistsGuard implements CanActivate {
  constructor(
    @InjectRepository(ConversationConfiguration)
    private readonly conversationConfigRepository: Repository<ConversationConfiguration>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { organisationId } = request.params;
    const conversationConfigId =
      this.getConversationConfigIdFromRequest(request);

    if (!organisationId || !conversationConfigId) {
      throw new NotFoundException(
        "Organisation ID and Conversation Config ID are required",
      );
    }

    const exists = await this.conversationConfigRepository
      .createQueryBuilder("cc")
      .where("cc.id = :conversationConfigId", { conversationConfigId })
      .andWhere("cc.organisationId = :organisationId", { organisationId })
      .getExists();

    if (!exists) {
      throw new NotFoundException(
        `Conversation configuration with ID ${conversationConfigId} not found`,
      );
    }

    return true;
  }

  private getConversationConfigIdFromRequest(request: any): string | undefined {
    return (
      request.body?.conversationConfigId ||
      request.query?.conversationConfigId ||
      request.params?.conversationConfigId
    );
  }
}
