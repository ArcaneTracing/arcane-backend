import { IsEmail, IsNotEmpty, IsOptional, IsUUID } from "class-validator";

export class AddUserToOrganisationRequestDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsUUID()
  @IsOptional()
  roleId?: string;
}
