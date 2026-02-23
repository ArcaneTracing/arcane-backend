import {
  Injectable,
  Logger,
  NotFoundException,
  BadGatewayException,
  BadRequestException,
} from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { ModelConfigurationService } from "../../model-configuration/services/model-configuration.service";
import { RunPromptRequestDto } from "../dto/request/run-prompt-request.dto";
import {
  LLMServiceRequestDto,
  LLMServiceResponseDto,
} from "../dto/llm-service-request.dto";
import { ModelConfigurationResponseDto } from "../../model-configuration/dto/response/model-configuration-response.dto";
import {
  PromptVersionResponseDto,
  ResponseDto,
} from "../dto/response/prompt-response.dto";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";

@Injectable()
export class PromptRunnerService {
  private readonly logger = new Logger(PromptRunnerService.name);

  constructor(
    private readonly modelConfigurationService: ModelConfigurationService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async run(
    projectId: string,
    runDto: RunPromptRequestDto,
  ): Promise<ResponseDto<LLMServiceResponseDto>> {
    this.logger.debug(`Running prompt in project ${projectId}`);

    if (!runDto.promptVersion) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.PROMPT_VERSION_REQUIRED),
      );
    }

    const modelConfiguration = await this.modelConfigurationService.findOneById(
      runDto.modelConfigurationId,
    );

    const llmRequest = this.buildLLMServiceRequest(
      runDto.promptVersion,
      modelConfiguration,
      runDto.inputs,
    );

    this.logger.debug(`LLM request: ${JSON.stringify(llmRequest, null, 2)}`);

    try {
      const workerApiUrl =
        this.configService.get<string>("WORKER_API") ||
        "http://localhost:8000/api/v1/run";
      this.logger.debug(`Calling LLM service at ${workerApiUrl}`);
      const response = await firstValueFrom(
        this.httpService.post<LLMServiceResponseDto>(workerApiUrl, llmRequest),
      );

      return {
        data: response.data,
      };
    } catch (error: any) {
      this.logger.error(
        `LLM service call failed: ${error.message}`,
        error.stack,
      );
      const status = error.response?.status;
      const data = error.response?.data;
      const rawDetail = data?.detail ?? data?.message ?? error.message;
      let message: string;
      if (typeof rawDetail === "string") {
        message = rawDetail;
      } else if (Array.isArray(rawDetail)) {
        message = rawDetail
          .map((e: { msg?: string }) => e?.msg ?? JSON.stringify(e))
          .join("; ");
      } else {
        message = String(rawDetail ?? "Failed to execute prompt");
      }

      if (status === 400) {
        throw new BadRequestException(`Failed to execute prompt: ${message}`);
      }
      throw new BadGatewayException(`Failed to execute prompt: ${message}`);
    }
  }

  private buildLLMServiceRequest(
    version: PromptVersionResponseDto,
    modelConfiguration: ModelConfigurationResponseDto,
    inputs: Record<string, unknown>,
  ): LLMServiceRequestDto {
    return {
      model_configuration: {
        id: modelConfiguration.id,
        name: modelConfiguration.name,
        configuration: modelConfiguration.configuration,
        createdAt: modelConfiguration.createdAt,
        updatedAt: modelConfiguration.updatedAt,
      },
      prompt_version: version,
      inputs,
    };
  }
}
