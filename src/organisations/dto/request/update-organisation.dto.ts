import { IsString, IsOptional, MaxLength } from "class-validator";

export class UpdateOrganisationRequestDto {
  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;
}
