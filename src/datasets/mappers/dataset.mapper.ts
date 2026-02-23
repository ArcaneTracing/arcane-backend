import { Dataset } from "../entities/dataset.entity";
import { DatasetRow } from "../entities/dataset-row.entity";
import { DatasetResponseDto } from "../dto/response/dataset.dto";
import { DatasetListItemResponseDto } from "../dto/response/dataset-list-item.dto";
import { DatasetRowResponseDto } from "../dto/response/dataset-row.dto";

export class DatasetMapper {
  static toRowDto(row: DatasetRow): DatasetRowResponseDto {
    return {
      id: row.id,
      values: row.values,
    };
  }

  static toDto(
    dataset: Dataset,
    rows: DatasetRowResponseDto[],
  ): DatasetResponseDto {
    return {
      id: dataset.id,
      name: dataset.name,
      description: dataset.description,
      header: dataset.header,
      rows,
      createdAt: dataset.createdAt,
      updatedAt: dataset.updatedAt,
    };
  }

  static toListItemDto(dataset: Dataset): DatasetListItemResponseDto {
    return {
      id: dataset.id,
      name: dataset.name,
      description: dataset.description,
      createdAt: dataset.createdAt,
      updatedAt: dataset.updatedAt,
    };
  }
}
