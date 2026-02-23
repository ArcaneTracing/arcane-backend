import { IsArray, IsNotEmpty, IsUUID } from "class-validator";

export class AddRolesToVisibilityRuleDto {
  @IsArray()
  @IsNotEmpty()
  @IsUUID("4", { each: true })
  roleIds: string[];
}
