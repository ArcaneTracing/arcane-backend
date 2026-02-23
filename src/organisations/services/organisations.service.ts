import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import { Cache } from "cache-manager";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Organisation } from "../entities/organisation.entity";
import { CreateOrganisationRequestDto } from "../dto/request/create-organisation.dto";
import { UpdateOrganisationRequestDto } from "../dto/request/update-organisation.dto";
import { OrganisationResponseDto } from "../dto/response/organisation.dto";
import { OrganisationMessageResponseDto } from "../dto/response/organisation-message-response.dto";
import { OrganisationMapper } from "../mappers";
import { OrganisationRbacService } from "./organisation-rbac.service";
import { BetterAuthUser } from "../../auth/entities/user.entity";
import { OrganisationInvitationService } from "./organisation-invitation.service";
import { MailerService } from "../../common/mailer/mailer.service";
import { BetterAuthUserService } from "../../auth/services/better-auth-user.service";
import { RolesService } from "../../rbac/services/roles.service";
import { AuditService } from "../../audit/audit.service";
import { OrganisationUserWithRoleResponseDto } from "../dto/response/organisation-user-with-role.dto";

@Injectable()
export class OrganisationsService {
  private readonly logger = new Logger(OrganisationsService.name);
  private readonly ORGANISATION_CACHE_TTL = 1800;

  constructor(
    @InjectRepository(Organisation)
    private readonly organisationRepository: Repository<Organisation>,
    @InjectRepository(BetterAuthUser)
    private readonly userRepository: Repository<BetterAuthUser>,
    private readonly organisationRbacService: OrganisationRbacService,
    private readonly invitationService: OrganisationInvitationService,
    private readonly mailerService: MailerService,
    private readonly betterAuthUserService: BetterAuthUserService,
    private readonly rolesService: RolesService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    createOrganisationDto: CreateOrganisationRequestDto,
    userId: string,
  ): Promise<OrganisationResponseDto> {
    return this.organisationRepository.manager.transaction(async (manager) => {
      const orgRepo = manager.getRepository(Organisation);

      const organisation = orgRepo.create({
        name: createOrganisationDto.name,
      });

      const savedOrganisation = await orgRepo.save(organisation);

      await orgRepo
        .createQueryBuilder()
        .relation(Organisation, "users")
        .of(savedOrganisation.id)
        .add(userId);

      const orgAdminRole =
        await this.organisationRbacService.seedOrganisationRoles(
          savedOrganisation.id,
          manager,
        );

      if (orgAdminRole) {
        await this.organisationRbacService.assignRole(
          savedOrganisation.id,
          userId,
          orgAdminRole.id,
          manager,
        );
      }

      const organisationDto = OrganisationMapper.toDto(savedOrganisation);

      await this.auditService.record({
        action: "organisation.created",
        actorId: userId,
        actorType: "user",
        resourceType: "organisation",
        resourceId: savedOrganisation.id,
        organisationId: savedOrganisation.id,
        afterState: {
          id: savedOrganisation.id,
          name: savedOrganisation.name,
          createdAt: savedOrganisation.createdAt,
        },
        metadata: {
          creatorId: userId,
        },
      });

      return organisationDto;
    });
  }

  private async findUserIdByEmail(email: string): Promise<string | null> {
    try {
      const user = await this.userRepository.findOne({
        where: { email },
        select: ["id"],
      });
      return user?.id || null;
    } catch (error) {
      this.logger.warn(`Failed to find user by email ${email}: ${error}`);
      return null;
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async addExistingUserToOrganisation(
    organisationId: string,
    userId: string,
    roleId?: string,
  ): Promise<void> {
    const isAlreadyMember = await this.organisationRepository
      .createQueryBuilder("o")
      .innerJoin("o.users", "u")
      .where("o.id = :organisationId", { organisationId })
      .andWhere("u.id = :userId", { userId })
      .getExists();
    if (isAlreadyMember) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.USER_ALREADY_MEMBER, "organisation"),
      );
    }

    await this.organisationRepository
      .createQueryBuilder()
      .relation(Organisation, "users")
      .of(organisationId)
      .add(userId);

    const roleToAssign = roleId
      ? await this.getOrganisationRoleOrThrow(organisationId, roleId)
      : await this.organisationRbacService.getDefaultOrganisationRole(
          organisationId,
        );

    await this.organisationRbacService.assignRole(
      organisationId,
      userId,
      roleToAssign.id,
    );
  }

  async addUserById(
    organisationId: string,
    userId: string,
    roleId?: string,
  ): Promise<void> {
    await this.addExistingUserToOrganisation(organisationId, userId, roleId);
  }

  private async getOrganisationRoleOrThrow(
    organisationId: string,
    roleId: string,
  ) {
    const role = await this.rolesService.findOne(roleId);
    if (role.organisationId !== organisationId || role.projectId) {
      throw new BadRequestException(
        formatError(ERROR_MESSAGES.ROLE_DOES_NOT_BELONG_TO_ORGANISATION),
      );
    }
    return role;
  }

  async findAll(userId: string): Promise<OrganisationResponseDto[]> {
    const organisations = await this.organisationRepository
      .createQueryBuilder("o")
      .innerJoin("o.users", "u", "u.id = :userId", { userId })
      .getMany();
    return organisations.map((org) => OrganisationMapper.toDto(org));
  }

  async getUsersWithRoles(
    organisationId: string,
  ): Promise<OrganisationUserWithRoleResponseDto[]> {
    await this.findById(organisationId);

    const organisationUsers = await this.organisationRepository.manager.query(
      `SELECT user_id FROM organisation_users WHERE organisation_id = $1`,
      [organisationId],
    );
    const userIds = organisationUsers.map((row: any) => row.user_id);

    if (userIds.length === 0) {
      return [];
    }

    const users = await this.betterAuthUserService.getUsersByIds(userIds);

    const usersWithRoles: OrganisationUserWithRoleResponseDto[] =
      await Promise.all(
        users.map(async (user) => {
          const role = await this.organisationRbacService.getUserRole(
            organisationId,
            user.id,
          );
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role,
          };
        }),
      );

    return usersWithRoles;
  }

  async findAllForAdmin(): Promise<OrganisationResponseDto[]> {
    const organisations = await this.organisationRepository.find({
      order: { createdAt: "DESC" },
    });
    return organisations.map((org) => OrganisationMapper.toDto(org));
  }

  async findById(id: string): Promise<Organisation> {
    const cacheKey = `organisation:${id}`;

    const cached = await this.cacheManager.get<Organisation>(cacheKey);
    if (cached) {
      return cached;
    }

    const organisation = await this.organisationRepository.findOne({
      where: { id },
    });

    if (!organisation) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.ORGANISATION_NOT_FOUND, id),
      );
    }

    await this.cacheManager.set(
      cacheKey,
      organisation,
      this.ORGANISATION_CACHE_TTL,
    );
    return organisation;
  }

  async isUserInOrganisation(
    userId: string,
    organisationId: string,
  ): Promise<boolean> {
    return this.organisationRepository
      .createQueryBuilder("o")
      .innerJoin("o.users", "u")
      .where("o.id = :organisationId", { organisationId })
      .andWhere("u.id = :userId", { userId })
      .getExists();
  }

  async update(
    id: string,
    updateOrganisationDto: UpdateOrganisationRequestDto,
  ): Promise<OrganisationResponseDto> {
    const organisation = await this.findById(id);

    const beforeState = {
      id: organisation.id,
      name: organisation.name,
      updatedAt: organisation.updatedAt,
    };

    if (updateOrganisationDto.name !== undefined) {
      organisation.name = updateOrganisationDto.name;
    }

    const updatedOrganisation =
      await this.organisationRepository.save(organisation);
    this.logger.log(`Updated organisation ${id}`);

    await this.cacheManager.del(`organisation:${id}`);

    const organisationDto = OrganisationMapper.toDto(updatedOrganisation);

    const changedFields: string[] = [];
    if (
      updateOrganisationDto.name !== undefined &&
      updateOrganisationDto.name !== beforeState.name
    ) {
      changedFields.push("name");
    }

    await this.auditService.record({
      action: "organisation.updated",
      actorType: "user",
      resourceType: "organisation",
      resourceId: id,
      organisationId: id,
      beforeState,
      afterState: {
        id: updatedOrganisation.id,
        name: updatedOrganisation.name,
        updatedAt: updatedOrganisation.updatedAt,
      },
      metadata: {
        changedFields,
      },
    });

    return organisationDto;
  }

  async remove(
    id: string,
    actorId?: string,
  ): Promise<OrganisationMessageResponseDto> {
    const organisation = await this.findById(id);

    const beforeState = {
      id: organisation.id,
      name: organisation.name,
    };

    await this.organisationRepository.remove(organisation);

    this.logger.log(`Removed organisation ${id}`);

    await this.cacheManager.del(`organisation:${id}`);

    await this.auditService.record({
      action: "organisation.deleted",
      actorId: actorId || null,
      actorType: "user",
      resourceType: "organisation",
      resourceId: id,
      organisationId: id,
      beforeState,
      afterState: null,
      metadata: {},
    });

    return { message: "Organisation removed successfully" };
  }

  async addUser(
    organisationId: string,
    email: string,
    invitedById: string,
    roleId?: string,
  ): Promise<OrganisationMessageResponseDto> {
    const organisation = await this.findById(organisationId);
    const normalizedEmail = this.normalizeEmail(email);

    const userIdToAdd = await this.findUserIdByEmail(normalizedEmail);

    const beforeState = {
      isMember: userIdToAdd
        ? await this.isUserInOrganisation(userIdToAdd, organisationId)
        : false,
      email: normalizedEmail,
      userId: userIdToAdd || null,
    };

    if (userIdToAdd) {
      await this.addExistingUserToOrganisation(
        organisationId,
        userIdToAdd,
        roleId,
      );

      const assignedRole = await this.organisationRbacService.getUserRole(
        organisationId,
        userIdToAdd,
      );

      this.logger.log(
        `Added user ${userIdToAdd} to organisation ${organisationId}`,
      );

      await this.auditService.record({
        action: "organisation.user.added",
        actorId: invitedById,
        actorType: "user",
        resourceType: "organisation_membership",
        resourceId: userIdToAdd,
        organisationId,
        beforeState,
        afterState: {
          isMember: true,
          email: normalizedEmail,
          userId: userIdToAdd,
          roleId: assignedRole?.id || null,
          roleName: assignedRole?.name || null,
        },
        metadata: {
          organisationId,
          userId: userIdToAdd,
          email: normalizedEmail,
          roleId: assignedRole?.id || roleId || null,
          actionType: "member_added",
        },
      });

      return { message: "User added to organisation successfully" };
    }

    const { token, isResend } = await this.invitationService.createInvite(
      organisationId,
      normalizedEmail,
      invitedById,
      roleId,
    );

    const inviter = await this.betterAuthUserService.getUserById(invitedById);
    const frontendUrl =
      this.configService.get<string>("FRONTEND_URL") || "http://localhost:3000";
    const oktaEnabled =
      this.configService.get<string>("OKTA_SSO_ENABLED") === "true";
    const inviteUrl = oktaEnabled
      ? `${frontendUrl.replace(/\/$/, "")}/login`
      : `${frontendUrl.replace(/\/$/, "")}/register?invite=${token}&email=${encodeURIComponent(normalizedEmail)}`;

    await this.mailerService.sendOrganisationInvite({
      to: normalizedEmail,
      organisationName: organisation.name,
      inviteUrl,
      invitedByEmail: inviter?.email || null,
      oktaMode: oktaEnabled,
    });

    this.logger.log(
      `Invited ${normalizedEmail} to organisation ${organisationId}`,
    );

    await this.auditService.record({
      action: "organisation.user.invited",
      actorId: invitedById,
      actorType: "user",
      resourceType: "organisation_invitation",
      organisationId,
      beforeState,
      afterState: {
        isMember: false,
        email: normalizedEmail,
        userId: null,
        invitationSent: true,
        isResend,
      },
      metadata: {
        organisationId,
        email: normalizedEmail,
        roleId: roleId || null,
        actionType: "invitation_sent",
        isResend,
      },
    });

    return {
      message: isResend
        ? "Invitation resent successfully"
        : "Invitation sent successfully",
      invited: true,
    };
  }

  async removeUser(
    organisationId: string,
    email: string,
  ): Promise<OrganisationMessageResponseDto> {
    await this.findById(organisationId);

    const userIdToRemove = await this.findUserIdByEmail(
      this.normalizeEmail(email),
    );
    if (!userIdToRemove) {
      throw new NotFoundException(
        formatError(ERROR_MESSAGES.USER_NOT_FOUND_BY_EMAIL, email),
      );
    }

    const beforeRole = await this.organisationRbacService.getUserRole(
      organisationId,
      userIdToRemove,
    );
    const beforeState = {
      isMember: true,
      email: this.normalizeEmail(email),
      userId: userIdToRemove,
      roleId: beforeRole?.id || null,
      roleName: beforeRole?.name || null,
    };

    await this.organisationRepository
      .createQueryBuilder()
      .relation(Organisation, "users")
      .of(organisationId)
      .remove(userIdToRemove);

    await this.auditService.record({
      action: "organisation.user.removed",
      actorType: "user",
      resourceType: "organisation_membership",
      resourceId: userIdToRemove,
      organisationId,
      beforeState,
      afterState: null,
      metadata: {
        organisationId,
        userId: userIdToRemove,
        email: this.normalizeEmail(email),
        removedRoleId: beforeRole?.id || null,
      },
    });

    return { message: "User removed from organisation successfully" };
  }
}
