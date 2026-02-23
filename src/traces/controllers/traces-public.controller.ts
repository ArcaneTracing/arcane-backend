import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { ApiSecurity, ApiTags } from "@nestjs/swagger";
import { TracesService } from "../services/traces.service";
import { SearchTracesRequestDto } from "../dto/request/search-traces-request.dto";
import {
  TempoTraceResponse,
  TempoTraceSearchResponse,
} from "../backends/tempo/tempo.types";
import { ProjectApiKeyGuard } from "../../projects/guards/project-api-key.guard";
import {
  ProjectApiKeyContext,
  ProjectApiKeyContextData,
} from "../../common/decorators/project-api-key-context.decorator";

const API_KEY_ACTOR_ID = "api-key";

@Controller("api/public/datasources/:datasourceId/traces")
@ApiTags("public-traces")
@ApiSecurity("apiKey")
@AllowAnonymous()
@UseGuards(ProjectApiKeyGuard)
export class TracesPublicController {
  constructor(private readonly tracesService: TracesService) {}

  @Post("search")
  @UsePipes(new ValidationPipe({ transform: true }))
  async search(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
    @Param("datasourceId", new ParseUUIDPipe()) datasourceId: string,
    @Body() body: SearchTracesRequestDto,
  ): Promise<TempoTraceSearchResponse> {
    return this.tracesService.search(
      ctx.organisationId,
      ctx.projectId,
      datasourceId,
      API_KEY_ACTOR_ID,
      body,
    );
  }

  @Get("attributes/:attributeName/values")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getAttributeValues(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
    @Param("datasourceId", new ParseUUIDPipe()) datasourceId: string,
    @Param("attributeName") attributeName: string,
  ): Promise<string[]> {
    return this.tracesService.getAttributeValues(
      ctx.organisationId,
      ctx.projectId,
      datasourceId,
      API_KEY_ACTOR_ID,
      attributeName,
    );
  }

  @Get("attributes")
  @UsePipes(new ValidationPipe({ transform: true }))
  async getAttributeNames(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
    @Param("datasourceId", new ParseUUIDPipe()) datasourceId: string,
  ): Promise<string[]> {
    return this.tracesService.getAttributeNames(
      ctx.organisationId,
      ctx.projectId,
      datasourceId,
      API_KEY_ACTOR_ID,
    );
  }

  @Get(":traceId")
  @UsePipes(new ValidationPipe({ transform: true }))
  async searchByTraceId(
    @ProjectApiKeyContext() ctx: ProjectApiKeyContextData,
    @Param("datasourceId", new ParseUUIDPipe()) datasourceId: string,
    @Param("traceId") traceId: string,
  ): Promise<TempoTraceResponse> {
    return this.tracesService.searchByTraceId(
      ctx.organisationId,
      ctx.projectId,
      datasourceId,
      API_KEY_ACTOR_ID,
      traceId,
    );
  }
}
