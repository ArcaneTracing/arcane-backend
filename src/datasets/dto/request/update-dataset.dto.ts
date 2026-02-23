import { IsOptional, IsString } from "class-validator";

export class UpdateDatasetRequestDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
