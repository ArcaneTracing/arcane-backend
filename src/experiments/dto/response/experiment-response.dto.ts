export class ExperimentResultResponseDto {
  id: string;
  datasetRowId: string;
  result: string | null;
  status: string;
  createdAt: Date;
}

export class ExperimentResponseDto {
  id: string;
  projectId: string;
  name: string;
  description?: string | null;
  promptVersionId: string;
  datasetId: string;
  promptInputMappings: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
  results?: ExperimentResultResponseDto[];
}
