import {
  ArrayMinSize,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  OrdinalConfigRequestDto,
  ScaleOptionRequestDto,
} from "./create-score-request.dto";

export class UpdateScoreRequestDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @ValidateIf(
    (dto: UpdateScoreRequestDto) =>
      Array.isArray(dto.scale) && dto.scale.length > 0,
  )
  @ArrayMinSize(1, { message: "scale must contain at least 1 elements" })
  @ValidateNested({ each: true })
  @Type(() => ScaleOptionRequestDto)
  scale?: ScaleOptionRequestDto[] | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => OrdinalConfigRequestDto)
  @IsObject()
  ordinalConfig?: OrdinalConfigRequestDto | null;

  @IsOptional()
  @IsUUID("4")
  evaluatorPromptId?: string | null;
}
