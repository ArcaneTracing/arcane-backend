import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  ValidationPipe,
  UsePipes,
} from "@nestjs/common";
import { TracesService } from "./services/traces.service";
import { SearchTracesRequestDto } from "./dto/request/search-traces-request.dto";
import { OrgProjectPermissionGuard } from "../rbac/guards/org-project-permission.guard";
import { Permission } from "../rbac/decorators/permission.decorator";
import { TRACE_PERMISSIONS } from "../rbac/permissions/permissions";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from "@nestjs/swagger";
import {
  TempoTraceResponse,
  TempoTraceSearchResponse,
} from "./backends/tempo/tempo.types";

@Controller(
  "v1/organisations/:organisationId/projects/:projectId/datasources/:datasourceId/traces",
)
@ApiTags("traces")
@ApiBearerAuth("bearer")
@UseGuards(OrgProjectPermissionGuard)
@Permission(TRACE_PERMISSIONS.READ)
export class TracesController {
  constructor(private readonly tracesService: TracesService) {}

  @Post("search")
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: "Search traces",
    description: "Search for traces in a datasource using various filters",
  })
  @ApiParam({
    name: "organisationId",
    type: "string",
    format: "uuid",
    description: "Organisation ID",
  })
  @ApiParam({
    name: "projectId",
    type: "string",
    format: "uuid",
    description: "Project ID",
  })
  @ApiParam({
    name: "datasourceId",
    type: "string",
    format: "uuid",
    description: "Datasource ID",
  })
  @ApiBody({ type: SearchTracesRequestDto })
  @ApiResponse({
    status: 200,
    description: "Search results",
    schema: { type: "object" },
  })
  @ApiResponse({ status: 400, description: "Bad request - validation error" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async search(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" }))
    organisationId: string,
    @Param("projectId", new ParseUUIDPipe({ version: "4" }))
    projectId: string,
    @Param("datasourceId", new ParseUUIDPipe({ version: "4" }))
    datasourceId: string,
    @Session() userSession: UserSession,
    @Body() body: SearchTracesRequestDto,
  ): Promise<TempoTraceSearchResponse> {
    return this.tracesService.search(
      organisationId,
      projectId,
      datasourceId,
      userSession.user.id,
      body,
    );
  }

  @Get("attributes/:attributeName/values")
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: "Get attribute values",
    description: "Get all values for a specific attribute from the datasource",
  })
  @ApiParam({
    name: "organisationId",
    type: "string",
    format: "uuid",
    description: "Organisation ID",
  })
  @ApiParam({
    name: "projectId",
    type: "string",
    format: "uuid",
    description: "Project ID",
  })
  @ApiParam({
    name: "datasourceId",
    type: "string",
    format: "uuid",
    description: "Datasource ID",
  })
  @ApiParam({
    name: "attributeName",
    type: "string",
    description: "Attribute name",
  })
  @ApiResponse({
    status: 200,
    description: "List of attribute values",
    type: [String],
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getAttributeValues(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" }))
    organisationId: string,
    @Param("projectId", new ParseUUIDPipe({ version: "4" }))
    projectId: string,
    @Param("datasourceId", new ParseUUIDPipe({ version: "4" }))
    datasourceId: string,
    @Session() userSession: UserSession,
    @Param("attributeName") attributeName: string,
  ): Promise<string[]> {
    return this.tracesService.getAttributeValues(
      organisationId,
      projectId,
      datasourceId,
      userSession.user.id,
      attributeName,
    );
  }

  @Get("attributes")
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: "Get all attributes",
    description: "Get all available attribute names from the datasource",
  })
  @ApiParam({
    name: "organisationId",
    type: "string",
    format: "uuid",
    description: "Organisation ID",
  })
  @ApiParam({
    name: "projectId",
    type: "string",
    format: "uuid",
    description: "Project ID",
  })
  @ApiParam({
    name: "datasourceId",
    type: "string",
    format: "uuid",
    description: "Datasource ID",
  })
  @ApiResponse({
    status: 200,
    description: "List of attribute names",
    type: [String],
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getAttributeNames(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" }))
    organisationId: string,
    @Param("projectId", new ParseUUIDPipe({ version: "4" }))
    projectId: string,
    @Param("datasourceId", new ParseUUIDPipe({ version: "4" }))
    datasourceId: string,
    @Session() userSession: UserSession,
  ): Promise<string[]> {
    return this.tracesService.getAttributeNames(
      organisationId,
      projectId,
      datasourceId,
      userSession.user.id,
    );
  }

  @Get("/:traceId")
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: "Get trace by ID",
    description: "Retrieve a specific trace by its ID",
  })
  @ApiParam({
    name: "organisationId",
    type: "string",
    format: "uuid",
    description: "Organisation ID",
  })
  @ApiParam({
    name: "projectId",
    type: "string",
    format: "uuid",
    description: "Project ID",
  })
  @ApiParam({
    name: "datasourceId",
    type: "string",
    format: "uuid",
    description: "Datasource ID",
  })
  @ApiParam({ name: "traceId", type: "string", description: "Trace ID" })
  @ApiResponse({
    status: 200,
    description: "Trace details",
    schema: { type: "object" },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Trace not found" })
  async searchByTraceId(
    @Param("organisationId", new ParseUUIDPipe({ version: "4" }))
    organisationId: string,
    @Param("projectId", new ParseUUIDPipe({ version: "4" }))
    projectId: string,
    @Param("datasourceId", new ParseUUIDPipe({ version: "4" }))
    datasourceId: string,
    @Session() userSession: UserSession,
    @Param("traceId") traceId: string,
  ): Promise<TempoTraceResponse> {
    return this.tracesService.searchByTraceId(
      organisationId,
      projectId,
      datasourceId,
      userSession.user.id,
      traceId,
    );
  }
}
