export class ProjectResponseDto {
  id: string;
  name: string;
  description?: string;
  traceFilterAttributeName?: string;
  traceFilterAttributeValue?: string;
  createdAt: Date;
  updatedAt: Date;
}
