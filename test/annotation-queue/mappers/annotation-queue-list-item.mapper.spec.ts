import { AnnotationQueueListItemDtoMapper } from "../../../src/annotation-queue/mappers/annotation-queue-list-item.mapper";
import { AnnotationQueue } from "../../../src/annotation-queue/entities/annotation-queue.entity";
import { AnnotationQueueType } from "../../../src/annotation-queue/entities/annotation-queue-type.enum";

describe("AnnotationQueueListItemDtoMapper", () => {
  it("should map queue entity to list item dto", () => {
    const queue = new AnnotationQueue();
    queue.id = "queue-1";
    queue.name = "Queue";
    queue.description = "Description";
    queue.type = AnnotationQueueType.TRACES;

    const result = AnnotationQueueListItemDtoMapper.toResponseDto(queue);

    expect(result).toEqual({
      id: "queue-1",
      name: "Queue",
      description: "Description",
      type: AnnotationQueueType.TRACES,
    });
  });
});
