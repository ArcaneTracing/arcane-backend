import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class InviteUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @IsString()
  roleId?: string;
}

export class DeleteUserDto extends InviteUserDto {}
