import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  Query,
} from "@nestjs/common";
import { Session, UserSession } from "@thallesp/nestjs-better-auth";
import { InstancePermissionGuard } from "../../rbac/guards/instance-permission.guard";
import { Permission } from "../../rbac/decorators/permission.decorator";
import { INSTANCE_PERMISSIONS } from "../../rbac/permissions/permissions";
import { OrganisationsService } from "../services/organisations.service";
import { CreateOrganisationRequestDto } from "../dto/request/create-organisation.dto";
import { OrganisationResponseDto } from "../dto/response/organisation.dto";
import { OrganisationMessageResponseDto } from "../dto/response/organisation-message-response.dto";
import { ApiTags, ApiBearerAuth, ApiQuery, ApiResponse } from "@nestjs/swagger";
import { AuditService } from "../../audit/audit.service";
import { PaginatedAuditLogsResponseDto } from "../../audit/dto/response/paginated-audit-logs-response.dto";
import { AuditLog } from "../../audit/entities/audit-log.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

@Controller("v1/admin/organisations")
@ApiTags("admin")
@ApiBearerAuth("bearer")
@UseGuards(InstancePermissionGuard)
export class AdminController {
  constructor(
    private readonly organisationsService: OrganisationsService,
    private readonly auditService: AuditService,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  @Get()
  @Permission(INSTANCE_PERMISSIONS.ALL)
  @UsePipes(new ValidationPipe({ transform: true }))
  async findAll(): Promise<OrganisationResponseDto[]> {
    return this.organisationsService.findAllForAdmin();
  }

  @Post()
  @Permission(INSTANCE_PERMISSIONS.ALL)
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe({ transform: true }))
  async create(
    @Body() createOrganisationDto: CreateOrganisationRequestDto,
    @Session() userSession: UserSession,
  ): Promise<OrganisationResponseDto> {
    return this.organisationsService.create(
      createOrganisationDto,
      userSession.user.id,
    );
  }

  @Delete(":organisationId")
  @Permission(INSTANCE_PERMISSIONS.ALL)
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ValidationPipe({ transform: true }))
  async remove(
    @Param("organisationId", ParseUUIDPipe) organisationId: string,
    @Session() userSession: UserSession,
  ): Promise<OrganisationMessageResponseDto> {
    return this.organisationsService.remove(
      organisationId,
      userSession.user.id,
    );
  }

  @Get("audit-logs")
  @Permission(INSTANCE_PERMISSIONS.ALL)
  @ApiQuery({ name: "organisationId", required: false })
  @ApiQuery({
    name: "action",
    required: false,
    description:
      "Filter by action pattern (e.g., organisation.*, user.*). If not provided, shows all admin actions",
  })
  @ApiQuery({
    name: "cursor",
    required: false,
    description: "timestamp ISO string for pagination",
  })
  @ApiQuery({ name: "limit", required: false })
  @ApiResponse({ status: 200, type: PaginatedAuditLogsResponseDto })
  async getAuditLogs(
    @Query(
      "organisationId",
      new ParseUUIDPipe({ version: "4", optional: true }),
    )
    organisationId?: string,
    @Query("action") action?: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
  ): Promise<PaginatedAuditLogsResponseDto> {
    const limitValue = limit ? Number(limit) : 50;

    if (!action) {
      const query = this.auditLogRepository.createQueryBuilder("audit");

      if (organisationId) {
        query.andWhere("audit.organisation_id = :orgId", {
          orgId: organisationId,
        });
      }

      query.andWhere(
        "(audit.action LIKE :orgPattern OR audit.action = :userAction OR audit.action LIKE :instancePattern)",
        {
          orgPattern: "organisation.%",
          userAction: "user.removed_from_system",
          instancePattern: "instance_owner.%",
        },
      );

      if (cursor) {
        query.andWhere("audit.created_at < :cursor", {
          cursor: new Date(cursor),
        });
      }

      query.orderBy("audit.created_at", "DESC").limit(limitValue + 1);
      const results = await query.getMany();

      const hasMore = results.length > limitValue;
      const data = hasMore ? results.slice(0, limitValue) : results;

      const nextCursor =
        data.length > 0 ? data[data.length - 1].createdAt.toISOString() : null;

      return {
        data,
        nextCursor,
        hasMore,
        limit: limitValue,
      };
    }

    return this.auditService.findLogsPaginated({
      organisationId,
      action,
      cursor,
      limit: limitValue,
    });
  }
}
