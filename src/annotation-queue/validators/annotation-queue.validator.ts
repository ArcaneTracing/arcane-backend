import { Injectable, NotFoundException } from "@nestjs/common";
import { AnnotationQueue } from "../entities/annotation-queue.entity";

@Injectable()
export class AnnotationQueueValidator {
  validateQueueExists(
    queue: AnnotationQueue | null,
    queueId: string,
    projectId: string,
  ): AnnotationQueue {
    if (!queue) {
      throw new NotFoundException(
        `Annotation queue with ID ${queueId} not found in project ${projectId}`,
      );
    }
    return queue;
  }
}
