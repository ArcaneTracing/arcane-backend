import { PartialType } from "@nestjs/mapped-types";
import { IsArray, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateConversationConfigurationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  stitchingAttributesName: string[];
}

export class UpdateConversationConfigurationDto extends PartialType(
  CreateConversationConfigurationDto,
) {}
