import { IsString, IsOptional, IsNotEmpty } from "class-validator";

export class GetFullConversationRequestDto {
  @IsString()
  @IsOptional()
  start?: string;

  @IsString()
  @IsOptional()
  end?: string;

  @IsString()
  @IsNotEmpty()
  value: string;
}
