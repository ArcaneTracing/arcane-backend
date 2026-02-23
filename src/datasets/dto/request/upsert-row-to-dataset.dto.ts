import { IsArray, IsNotEmpty, IsString } from "class-validator";

export class UpsertRowToDatasetRequestDto {
  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  values: string[];
}
