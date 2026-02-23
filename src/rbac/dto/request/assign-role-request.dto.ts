import { IsString, IsEmail, IsOptional } from "class-validator";

export class AssignRoleRequestDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  roleId: string;
}
