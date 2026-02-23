import { Injectable } from "@nestjs/common";
import { AnnotationResponseDto } from "../dto/response/annotation-response.dto";
import { CreateAnnotationRequestDto } from "../dto/request/create-annotation-request.dto";
import { UpdateAnnotationRequestDto } from "../dto/request/update-annotation-request.dto";
import { MessageResponseDto } from "../dto/response/message-response.dto";
import { AnnotationCreationService } from "./annotation-creation.service";
import { AnnotationUpdateService } from "./annotation-update.service";
import { AnnotationManagementService } from "./annotation-management.service";

@Injectable()
export class AnnotationService {
  constructor(
    private readonly annotationCreationService: AnnotationCreationService,
    private readonly annotationUpdateService: AnnotationUpdateService,
    private readonly annotationManagementService: AnnotationManagementService,
  ) {}

  async createAnnotation(
    projectId: string,
    queueId: string,
    userId: string,
    createDto: CreateAnnotationRequestDto,
  ): Promise<AnnotationResponseDto> {
    return this.annotationCreationService.createAnnotation(
      projectId,
      queueId,
      userId,
      createDto,
    );
  }

  async updateAnnotationAnswer(
    annotationId: string,
    updateDto: UpdateAnnotationRequestDto,
  ): Promise<AnnotationResponseDto> {
    return this.annotationUpdateService.updateAnnotationAnswer(
      annotationId,
      updateDto,
    );
  }

  async removeAnnotation(annotationId: string): Promise<MessageResponseDto> {
    return this.annotationManagementService.removeAnnotation(annotationId);
  }
}
