import { NumericEvaluationStatisticsResponseDto } from "./numeric-statistics-response.dto";
import { NominalStatisticsResponseDto } from "./nominal-statistics-response.dto";
import { OrdinalStatisticsResponseDto } from "./ordinal-statistics-response.dto";

export class EvaluationStatisticsResponseDto {
  experimentId: string;
  scoreId: string;
  numeric: NumericEvaluationStatisticsResponseDto | null;
  nominal: NominalStatisticsResponseDto | null;
  ordinal: OrdinalStatisticsResponseDto | null;
}
