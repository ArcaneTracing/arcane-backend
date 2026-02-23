import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { ScoresService } from "../services/scores.service";
import { CreateScoreRequestDto } from "../dto/request/create-score-request.dto";
import { UpdateScoreRequestDto } from "../dto/request/update-score-request.dto";
import { ScoreResponseDto } from "../dto/response/score-response.dto";
import { OrgProjectPermissionGuard } from "../../rbac/guards/org-project-permission.guard";
import { Permission } from "../../rbac/decorators/permission.decorator";
import { SCORE_PERMISSIONS } from "../../rbac/permissions/permissions";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";

@Controller("v1/organisations/:organisationId/projects/:projectId/scores")
@UseGuards(OrgProjectPermissionGuard)
export class ScoresController {
  constructor(private readonly scoresService: ScoresService) {}

  @Post()
  @Permission(SCORE_PERMISSIONS.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  create(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() dto: CreateScoreRequestDto,
    @Session() userSession: UserSession,
  ): Promise<ScoreResponseDto> {
    return this.scoresService.create(
      projectId,
      dto,
      userSession?.user?.id,
      organisationId,
    );
  }

  @Get()
  @Permission(SCORE_PERMISSIONS.READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  findAll(
    @Param("projectId", ParseUUIDPipe) projectId: string,
  ): Promise<ScoreResponseDto[]> {
    return this.scoresService.findAll(projectId);
  }

  @Get(":scoreId")
  @Permission(SCORE_PERMISSIONS.READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  findOne(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("scoreId", ParseUUIDPipe) scoreId: string,
  ): Promise<ScoreResponseDto> {
    return this.scoresService.findOne(projectId, scoreId);
  }

  @Put(":scoreId")
  @Permission(SCORE_PERMISSIONS.UPDATE)
  @UsePipes(new ValidationPipe({ transform: true }))
  update(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("scoreId", ParseUUIDPipe) scoreId: string,
    @Body() dto: UpdateScoreRequestDto,
    @Session() userSession: UserSession,
  ): Promise<ScoreResponseDto> {
    return this.scoresService.update(
      projectId,
      scoreId,
      dto,
      userSession?.user?.id,
      organisationId,
    );
  }

  @Delete(":scoreId")
  @Permission(SCORE_PERMISSIONS.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ValidationPipe({ transform: true }))
  async remove(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("scoreId", ParseUUIDPipe) scoreId: string,
    @Session() userSession: UserSession,
  ): Promise<void> {
    await this.scoresService.remove(
      projectId,
      scoreId,
      userSession?.user?.id,
      organisationId,
    );
  }
}
