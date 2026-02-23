import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { ExperimentsService } from "../services/experiments.service";
import { CreateExperimentRequestDto } from "../dto/request/create-experiment-request.dto";
import { CreateExperimentResultRequestDto } from "../dto/request/create-experiment-result-request.dto";
import {
  ExperimentResponseDto,
  ExperimentResultResponseDto,
} from "../dto/response/experiment-response.dto";
import { OrgProjectPermissionGuard } from "../../rbac/guards/org-project-permission.guard";
import { Permission } from "../../rbac/decorators/permission.decorator";
import { EXPERIMENT_PERMISSIONS } from "../../rbac/permissions/permissions";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { PaginationQueryDto } from "../../common/dto/pagination.dto";
import { PaginatedExperimentResultsResponseDto } from "../dto/response/paginated-experiment-result.dto";

@Controller("v1/organisations/:organisationId/projects/:projectId/experiments")
@ApiTags("experiments")
@ApiBearerAuth("bearer")
@UseGuards(OrgProjectPermissionGuard)
export class ExperimentsController {
  constructor(private readonly experimentsService: ExperimentsService) {}

  @Post()
  @Permission(EXPERIMENT_PERMISSIONS.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  create(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateExperimentRequestDto,
    @Session() userSession: UserSession,
  ): Promise<ExperimentResponseDto> {
    return this.experimentsService.create(
      projectId,
      dto,
      userSession?.user?.id,
      organisationId,
    );
  }

  @Get()
  @Permission(EXPERIMENT_PERMISSIONS.READ)
  findAll(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
  ): Promise<ExperimentResponseDto[]> {
    return this.experimentsService.findAll(projectId);
  }

  @Get(":experimentId")
  @Permission(EXPERIMENT_PERMISSIONS.READ)
  findOne(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("experimentId", new ParseUUIDPipe()) experimentId: string,
  ): Promise<ExperimentResponseDto> {
    return this.experimentsService.findOne(projectId, experimentId);
  }

  @Post(":experimentId/rerun")
  @Permission(EXPERIMENT_PERMISSIONS.RERUN)
  @HttpCode(HttpStatus.CREATED)
  rerun(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("experimentId", new ParseUUIDPipe()) experimentId: string,
    @Session() userSession: UserSession,
  ): Promise<ExperimentResponseDto> {
    return this.experimentsService.rerun(
      projectId,
      experimentId,
      userSession?.user?.id,
      organisationId,
    );
  }

  @Delete(":experimentId")
  @Permission(EXPERIMENT_PERMISSIONS.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("experimentId", new ParseUUIDPipe()) experimentId: string,
    @Session() userSession: UserSession,
  ): Promise<void> {
    await this.experimentsService.remove(
      projectId,
      experimentId,
      userSession?.user?.id,
      organisationId,
    );
  }

  @Post(":experimentId/results")
  @Permission(EXPERIMENT_PERMISSIONS.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  createResult(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("experimentId", new ParseUUIDPipe()) experimentId: string,
    @Body() dto: CreateExperimentResultRequestDto,
  ): Promise<ExperimentResultResponseDto> {
    return this.experimentsService.createResult(projectId, experimentId, dto);
  }

  @Get(":experimentId/results")
  @Permission(EXPERIMENT_PERMISSIONS.READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  listResults(
    @Param("organisationId", new ParseUUIDPipe()) organisationId: string,
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("experimentId", new ParseUUIDPipe()) experimentId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedExperimentResultsResponseDto> {
    return this.experimentsService.listResultsPaginated(
      projectId,
      experimentId,
      query,
    );
  }
}
