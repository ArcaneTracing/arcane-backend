import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AnnotationQueue } from "../entities/annotation-queue.entity";

@Injectable()
export class QueueBelongsToProjectGuard implements CanActivate {
  private readonly logger = new Logger(QueueBelongsToProjectGuard.name);

  constructor(
    @InjectRepository(AnnotationQueue)
    private readonly annotationQueueRepository: Repository<AnnotationQueue>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const { projectId, queueId } = request.params;

    this.logger.debug(
      `[canActivate] Checking queue ${queueId} belongs to project ${projectId}`,
    );

    if (!projectId || !queueId) {
      this.logger.warn(
        `[canActivate] Missing required parameters: projectId=${projectId}, queueId=${queueId}`,
      );
      throw new ForbiddenException("Project ID and Queue ID are required");
    }

    const queueExistsInProject = await this.annotationQueueRepository.exists({
      where: { id: queueId, projectId: projectId },
    });

    this.logger.debug(
      `[canActivate] Queue ${queueId} exists in project ${projectId}: ${queueExistsInProject}`,
    );

    if (!queueExistsInProject) {
      const queueExists = await this.annotationQueueRepository.exists({
        where: { id: queueId },
      });
      if (queueExists) {
        const queue = await this.annotationQueueRepository.findOne({
          where: { id: queueId },
          select: ["id", "projectId"],
        });
        this.logger.warn(
          `[canActivate] Queue ${queueId} belongs to project ${queue?.projectId}, but request is for project ${projectId}`,
        );
        throw new ForbiddenException(
          `Annotation queue does not belong to this project. Queue belongs to project ${queue?.projectId}`,
        );
      } else {
        this.logger.warn(`[canActivate] Queue ${queueId} not found`);
        throw new NotFoundException("Annotation queue not found");
      }
    }

    this.logger.debug(
      `[canActivate] Queue ${queueId} validation passed for project ${projectId}`,
    );
    return true;
  }
}
