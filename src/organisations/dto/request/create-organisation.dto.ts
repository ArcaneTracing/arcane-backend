import { IsString, IsNotEmpty, MaxLength } from "class-validator";

export class CreateOrganisationRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;
}
