import {
  IsString,
  IsNotEmpty,
  IsObject,
  ValidateNested,
} from "class-validator";
import { PromptVersionResponseDto } from "../response/prompt-response.dto";

export class RunPromptRequestDto {
  @IsObject()
  @ValidateNested()
  promptVersion: PromptVersionResponseDto;

  @IsString()
  @IsNotEmpty()
  modelConfigurationId: string;

  @IsObject()
  @IsNotEmpty()
  inputs: Record<string, unknown>;
}
