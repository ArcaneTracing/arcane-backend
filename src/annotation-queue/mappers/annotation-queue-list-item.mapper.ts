import { AnnotationQueue } from "../entities/annotation-queue.entity";
import { AnnotationQueueListItemResponseDto } from "../dto/response/annotation-queue-list-item-response.dto";

export class AnnotationQueueListItemDtoMapper {
  static toResponseDto(
    queue: AnnotationQueue,
  ): AnnotationQueueListItemResponseDto {
    return {
      id: queue.id,
      name: queue.name,
      description: queue.description,
      type: queue.type,
    };
  }
}
