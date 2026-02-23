import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Put,
  Delete,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { DatasourcesService } from "../services/datasources.service";
import {
  CreateDatasourceDto,
  UpdateDatasourceDto,
} from "../dto/request/create-datasource.dto";
import { TestConnectionDto } from "../dto/request/test-connection.dto";
import { DatasourceResponseDto } from "../dto/response/datasource-response.dto";
import { DatasourceListItemResponseDto } from "../dto/response/datasource-list-item-response.dto";
import { DatasourceMessageResponseDto } from "../dto/response/datasource-message-response.dto";
import { DatasourceConnectivityService } from "../services/datasource-connectivity.service";
import { Datasource, DatasourceType } from "../entities/datasource.entity";
import { OrgPermissionGuard } from "../../rbac/guards/org-permission.guard";
import { Permission } from "../../rbac/decorators/permission.decorator";
import { DATASOURCE_PERMISSIONS } from "../../rbac/permissions/permissions";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from "@nestjs/swagger";

@Controller("v1/organisations/:organisationId/datasources")
@ApiTags("datasources")
@ApiBearerAuth("bearer")
@UseGuards(OrgPermissionGuard)
export class DatasourcesController {
  constructor(
    private readonly datasourcesService: DatasourcesService,
    private readonly connectivityService: DatasourceConnectivityService,
  ) {}

  @Post()
  @Permission(DATASOURCE_PERMISSIONS.CREATE)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: "Create datasource",
    description: "Create a new datasource for an organisation",
  })
  @ApiParam({
    name: "organisationId",
    type: "string",
    format: "uuid",
    description: "Organisation ID",
  })
  @ApiBody({ type: CreateDatasourceDto })
  @ApiResponse({
    status: 201,
    description: "Datasource created successfully",
    type: DatasourceResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request - validation error" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async create(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Body() createDatasourceDto: CreateDatasourceDto,
    @Session() userSession: UserSession,
  ): Promise<DatasourceResponseDto> {
    return this.datasourcesService.create(
      organisationId,
      userSession?.user?.id,
      createDatasourceDto,
    );
  }

  @Get()
  @Permission(DATASOURCE_PERMISSIONS.READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: "List datasources",
    description: "Get all datasources for an organisation",
  })
  @ApiParam({
    name: "organisationId",
    type: "string",
    format: "uuid",
    description: "Organisation ID",
  })
  @ApiResponse({
    status: 200,
    description: "List of datasources",
    type: [DatasourceResponseDto],
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async findAll(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
  ): Promise<DatasourceResponseDto[]> {
    return this.datasourcesService.findAll(organisationId);
  }

  @Get("list")
  @Permission(DATASOURCE_PERMISSIONS.READ)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: "List datasources (lightweight)",
    description:
      "Get a lightweight list of datasources for an organisation without URL and config",
  })
  @ApiParam({
    name: "organisationId",
    type: "string",
    format: "uuid",
    description: "Organisation ID",
  })
  @ApiResponse({
    status: 200,
    description: "List of datasource list items",
    type: [DatasourceListItemResponseDto],
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async findAllListItems(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
  ): Promise<DatasourceListItemResponseDto[]> {
    return this.datasourcesService.findAllListItems(organisationId);
  }

  @Put(":id")
  @Permission(DATASOURCE_PERMISSIONS.UPDATE)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: "Update datasource",
    description: "Update an existing datasource",
  })
  @ApiParam({
    name: "organisationId",
    type: "string",
    format: "uuid",
    description: "Organisation ID",
  })
  @ApiParam({
    name: "id",
    type: "string",
    format: "uuid",
    description: "Datasource ID",
  })
  @ApiBody({ type: UpdateDatasourceDto })
  @ApiResponse({
    status: 200,
    description: "Datasource updated successfully",
    type: DatasourceResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request - validation error" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Datasource not found" })
  async update(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateDatasourceDto: UpdateDatasourceDto,
    @Session() userSession: UserSession,
  ): Promise<DatasourceResponseDto> {
    return this.datasourcesService.update(
      organisationId,
      id,
      updateDatasourceDto,
      userSession?.user?.id,
    );
  }

  @Delete(":id")
  @Permission(DATASOURCE_PERMISSIONS.DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: "Delete datasource",
    description: "Delete a datasource",
  })
  @ApiParam({
    name: "organisationId",
    type: "string",
    format: "uuid",
    description: "Organisation ID",
  })
  @ApiParam({
    name: "id",
    type: "string",
    format: "uuid",
    description: "Datasource ID",
  })
  @ApiResponse({ status: 204, description: "Datasource deleted successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Datasource not found" })
  async remove(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Session() userSession: UserSession,
  ): Promise<DatasourceMessageResponseDto> {
    return this.datasourcesService.remove(
      organisationId,
      id,
      userSession?.user?.id,
    );
  }

  @Post("test-connection")
  @Permission(DATASOURCE_PERMISSIONS.CREATE)
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: "Test datasource connection",
    description:
      "Test connectivity to a datasource with provided configuration",
  })
  @ApiParam({
    name: "organisationId",
    type: "string",
    format: "uuid",
    description: "Organisation ID",
  })
  @ApiBody({ type: TestConnectionDto })
  @ApiResponse({
    status: 200,
    description: "Connection test result",
    schema: {
      type: "object",
      properties: { success: { type: "boolean" }, message: { type: "string" } },
    },
  })
  @ApiResponse({ status: 400, description: "Bad request - validation error" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async testConnection(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Body() testConnectionDto: TestConnectionDto,
  ): Promise<{ success: boolean; message: string }> {
    const testDatasource = {
      id: "test",
      url: testConnectionDto.url || "",
      source: testConnectionDto.source,
      config: testConnectionDto.config || {},
      type: DatasourceType.TRACES,
      organisationId,
      name: "",
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdById: "",
    } as Datasource;

    return this.connectivityService.testConnection(testDatasource);
  }

  @Post(":id/test-connection")
  @Permission(DATASOURCE_PERMISSIONS.READ)
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: "Test existing datasource connection",
    description: "Test connectivity to an existing datasource",
  })
  @ApiParam({
    name: "organisationId",
    type: "string",
    format: "uuid",
    description: "Organisation ID",
  })
  @ApiParam({
    name: "id",
    type: "string",
    format: "uuid",
    description: "Datasource ID",
  })
  @ApiBody({ type: TestConnectionDto, required: false })
  @ApiResponse({
    status: 200,
    description: "Connection test result",
    schema: {
      type: "object",
      properties: { success: { type: "boolean" }, message: { type: "string" } },
    },
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Datasource not found" })
  async testExistingConnection(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() testConnectionDto?: TestConnectionDto,
  ): Promise<{ success: boolean; message: string }> {
    const datasource = await this.datasourcesService.findById(id);

    const testDatasource =
      testConnectionDto?.url || testConnectionDto?.config
        ? {
            ...datasource,
            url: testConnectionDto.url || datasource.url,
            config: testConnectionDto.config || datasource.config,
          }
        : datasource;

    return this.connectivityService.testConnection(testDatasource);
  }
}
