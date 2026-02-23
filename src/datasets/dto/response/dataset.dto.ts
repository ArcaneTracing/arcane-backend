import { DatasetRowResponseDto } from "./dataset-row.dto";

export class DatasetResponseDto {
  id: string;
  name: string;
  description?: string;
  header: string[];
  rows: DatasetRowResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}
