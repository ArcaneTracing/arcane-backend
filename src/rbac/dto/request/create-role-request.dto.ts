import { IsString, IsArray, IsOptional, ArrayMinSize } from "class-validator";

export class CreateRoleRequestDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  permissions: string[];
}
