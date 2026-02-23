import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Annotation } from "../entities/annotation.entity";

@Injectable()
export class AnnotationBelongsToQueueGuard implements CanActivate {
  constructor(
    @InjectRepository(Annotation)
    private readonly annotationRepository: Repository<Annotation>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { queueId, annotationId } = request.params;

    if (!queueId || !annotationId) {
      throw new ForbiddenException("Queue ID and Annotation ID are required");
    }

    const exists = await this.annotationRepository
      .createQueryBuilder("a")
      .where("a.id = :annotationId", { annotationId })
      .andWhere(
        `(
          EXISTS (
            SELECT 1
            FROM queued_traces qt
            WHERE qt.id = a.trace_id
              AND qt.queue_id = :queueId
          )
          OR
          EXISTS (
            SELECT 1
            FROM queued_conversations c
            WHERE c.id = a.conversation_id
              AND c.queue_id = :queueId
          )
        )`,
        { queueId },
      )
      .getExists();

    if (!exists) {
      throw new NotFoundException("Annotation not found");
    }

    return true;
  }
}
