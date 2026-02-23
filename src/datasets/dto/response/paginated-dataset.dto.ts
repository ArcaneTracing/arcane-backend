import { DatasetRowResponseDto } from "./dataset-row.dto";
import { PaginationMetaDto } from "../../../common/dto/pagination.dto";

export class PaginatedDatasetResponseDto {
  id: string;
  name: string;
  description?: string;
  header: string[];
  data: DatasetRowResponseDto[];
  pagination: PaginationMetaDto;
}
