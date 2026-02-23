import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ExperimentsService } from "../services/experiments.service";
import { CreateExperimentRequestDto } from "../dto/request/create-experiment-request.dto";
import { CreateExperimentResultRequestDto } from "../dto/request/create-experiment-result-request.dto";
import {
  ExperimentResponseDto,
  ExperimentResultResponseDto,
} from "../dto/response/experiment-response.dto";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { PaginatedExperimentResultsResponseDto } from "../dto/response/paginated-experiment-result.dto";
import { ProjectApiKeyGuard } from "../../projects/guards/project-api-key.guard";
import {
  ProjectApiKeyContext,
  ProjectApiKeyContextData,
} from "../../common/decorators/project-api-key-context.decorator";

const API_KEY_ACTOR_ID = "api-key";

@Controller("api/public/experiments")
@ApiTags("public-experiments")
@ApiSecurity("apiKey")
@AllowAnonymous()
@UseGuards(ProjectApiKeyGuard)
export class ExperimentsPublicController {
  constructor(private readonly experimentsService: ExperimentsService) {}

  @Get()
  async findAll(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
  ): Promise<ExperimentResponseDto[]> {
    return this.experimentsService.findAll(ctx.projectId);
  }

  @Get(":experimentId")
  async findOne(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
    @Param("experimentId", new ParseUUIDPipe()) experimentId: string,
  ): Promise<ExperimentResponseDto> {
    return this.experimentsService.findOne(ctx.projectId, experimentId);
  }

  @Get(":experimentId/results")
  @UsePipes(new ValidationPipe({ transform: true }))
  async listResults(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
    @Param("experimentId", new ParseUUIDPipe()) experimentId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedExperimentResultsResponseDto> {
    return this.experimentsService.listResultsPaginated(
      ctx.projectId,
      experimentId,
      query,
    );
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  async create(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
    @Body() dto: CreateExperimentRequestDto,
  ): Promise<ExperimentResponseDto> {
    return this.experimentsService.create(
      ctx.projectId,
      dto,
      API_KEY_ACTOR_ID,
      ctx.organisationId,
    );
  }

  @Post(":experimentId/results")
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  async createResult(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
    @Param("experimentId", new ParseUUIDPipe()) experimentId: string,
    @Body() dto: CreateExperimentResultRequestDto,
  ): Promise<ExperimentResultResponseDto> {
    return this.experimentsService.createResult(
      ctx.projectId,
      experimentId,
      dto,
    );
  }
}
