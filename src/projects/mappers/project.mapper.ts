import { Project } from "../entities/project.entity";
import { ProjectResponseDto } from "../dto/response/project.dto";

export class ProjectMapper {
  static toDto(project: Project): ProjectResponseDto {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      traceFilterAttributeName: project.traceFilterAttributeName,
      traceFilterAttributeValue: project.traceFilterAttributeValue,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
}
