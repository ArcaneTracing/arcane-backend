import { PaginationMetaDto } from "../../../common/dto/pagination.dto";
import { DatasetRowResponseDto } from "../../../datasets/dto/response/dataset-row.dto";

export class CombinedExperimentResultResponseDto {
  datasetRow: DatasetRowResponseDto;
  experimentResult: string | null;
  experimentResultId: string;
  createdAt: Date;
}

export class PaginatedExperimentResultsResponseDto {
  data: CombinedExperimentResultResponseDto[];
  pagination: PaginationMetaDto;
}
