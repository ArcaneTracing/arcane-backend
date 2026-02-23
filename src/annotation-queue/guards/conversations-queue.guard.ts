import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AnnotationQueue } from "../entities/annotation-queue.entity";
import { AnnotationQueueType } from "../entities/annotation-queue-type.enum";

@Injectable()
export class ConversationsQueueGuard implements CanActivate {
  constructor(
    @InjectRepository(AnnotationQueue)
    private readonly annotationQueueRepository: Repository<AnnotationQueue>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { queueId } = request.params;

    if (!queueId) {
      throw new BadRequestException("Queue ID is required");
    }

    const exists = await this.annotationQueueRepository
      .createQueryBuilder("q")
      .where("q.id = :queueId", { queueId })
      .andWhere("q.type = :expectedType", {
        expectedType: AnnotationQueueType.CONVERSATIONS,
      })
      .getExists();

    if (!exists) {
      throw new BadRequestException("This queue is not a conversations queue");
    }

    return true;
  }
}
