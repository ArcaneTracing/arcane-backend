import { NumericDatasetStatisticsResponseDto } from "./numeric-statistics-response.dto";
import { NominalStatisticsResponseDto } from "./nominal-statistics-response.dto";
import { OrdinalStatisticsResponseDto } from "./ordinal-statistics-response.dto";

export class DatasetStatisticsResponseDto {
  datasetId: string;
  scoreId: string;
  numeric: NumericDatasetStatisticsResponseDto | null;
  nominal: NominalStatisticsResponseDto | null;
  ordinal: OrdinalStatisticsResponseDto | null;
}
