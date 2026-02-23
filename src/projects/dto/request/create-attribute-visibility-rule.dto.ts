import { IsNotEmpty, IsString, IsArray, IsUUID } from "class-validator";

export class CreateAttributeVisibilityRuleDto {
  @IsNotEmpty()
  @IsString()
  attributeName: string;

  @IsArray()
  @IsUUID("4", { each: true })
  hiddenRoleIds: string[];
}
