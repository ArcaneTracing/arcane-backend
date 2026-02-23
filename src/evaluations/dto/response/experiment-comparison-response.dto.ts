import { NumericComparisonResponseDto } from "./numeric-comparison-response.dto";
import { NominalComparisonResponseDto } from "./nominal-comparison-response.dto";
import { OrdinalComparisonResponseDto } from "./ordinal-comparison-response.dto";

export class ExperimentComparisonResponseDto {
  numeric: NumericComparisonResponseDto | null;
  nominal: NominalComparisonResponseDto | null;
  ordinal: OrdinalComparisonResponseDto | null;
}
