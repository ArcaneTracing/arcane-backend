import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AnnotationTemplate } from "../entities/annotation-template.entity";
import { AnnotationQueue } from "../entities/annotation-queue.entity";
import { AnnotationQuestionMapper } from "../mappers/annotation-question.mapper";
import { AnnotationTemplateMapper } from "../mappers/annotation-template.mapper";
import { AnnotationTemplateResponseDto } from "../dto/response/annotation-template-response.dto";

@Injectable()
export class QueueTemplateService {
  private readonly logger = new Logger(QueueTemplateService.name);

  constructor(
    @InjectRepository(AnnotationTemplate)
    private readonly annotationTemplateRepository: Repository<AnnotationTemplate>,
    @InjectRepository(AnnotationQueue)
    private readonly annotationQueueRepository: Repository<AnnotationQueue>,
  ) {}

  async createTemplate(questions: any[]): Promise<AnnotationTemplate> {
    if (!questions || questions.length === 0) {
      throw new BadRequestException(
        "At least one question is required when creating a template",
      );
    }

    const template = await this.annotationTemplateRepository.save({
      questions: questions.map((questionDto) =>
        AnnotationQuestionMapper.toEntity(questionDto),
      ),
    });
    this.logger.log(
      `Created new annotation template ${template.id} with ${questions.length} questions`,
    );

    return template;
  }

  async updateTemplate(templateDto: { questions?: any[] }): Promise<string> {
    if (!templateDto.questions || templateDto.questions.length === 0) {
      throw new BadRequestException(
        "At least one question is required when updating template",
      );
    }

    const template = await this.createTemplate(templateDto.questions);
    return template.id;
  }

  async getTemplate(
    projectId: string,
    queueId: string,
  ): Promise<AnnotationTemplateResponseDto> {
    const queue = await this.annotationQueueRepository.findOne({
      where: { id: queueId, projectId },
    });

    if (!queue) {
      throw new NotFoundException(
        `Annotation queue with ID ${queueId} not found in project ${projectId}`,
      );
    }

    const template = await this.annotationTemplateRepository.findOne({
      where: { id: queue.templateId },
      relations: ["questions"],
    });

    if (!template) {
      throw new NotFoundException(
        `Template with ID ${queue.templateId} not found`,
      );
    }

    return AnnotationTemplateMapper.toResponseDto(template);
  }
}
