import { IsString, IsEmail, IsNotEmpty } from "class-validator";

export class RemoveUserFromOrganisationRequestDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
