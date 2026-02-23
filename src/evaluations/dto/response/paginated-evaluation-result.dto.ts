import { PaginationMetaDto } from "../../../common/dto/pagination.dto";
import {
  EvaluationResultResponseDto,
  ScoreResultResponseDto,
} from "./evaluation-response.dto";

export class PaginatedEvaluationResultsResponseDto {
  data: EvaluationResultResponseDto[];
  pagination: PaginationMetaDto;
}

export class PaginatedPendingScoreResultsResponseDto {
  data: ScoreResultResponseDto[];
  pagination: PaginationMetaDto;
}
