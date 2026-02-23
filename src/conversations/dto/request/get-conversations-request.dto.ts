import { IsString, IsOptional } from "class-validator";

export class GetConversationsRequestDto {
  @IsString()
  @IsOptional()
  start?: string;

  @IsString()
  @IsOptional()
  end?: string;
}
