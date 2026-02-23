import { Injectable } from "@nestjs/common";
import { AnnotationQueue } from "../entities/annotation-queue.entity";
import { QueueTemplateService } from "./queue-template.service";
import { UpdateAnnotationQueueRequestDto } from "../dto/request/create-annotation-queue-request.dto";

@Injectable()
export class AnnotationQueueUpdater {
  constructor(private readonly queueTemplateService: QueueTemplateService) {}

  async applyUpdates(
    queue: AnnotationQueue,
    updateDto: UpdateAnnotationQueueRequestDto,
  ): Promise<void> {
    if (updateDto.template) {
      queue.templateId = await this.queueTemplateService.updateTemplate(
        updateDto.template,
      );
    }

    if (updateDto.name !== undefined) {
      queue.name = updateDto.name;
    }
    if (updateDto.description !== undefined) {
      queue.description = updateDto.description;
    }
  }
}
