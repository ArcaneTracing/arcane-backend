import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { RbacService } from "../../rbac/services/rbac.service";
import { RbacAssignmentService } from "../../rbac/services/rbac-assignment.service";
import { BetterAuthUserService } from "./better-auth-user.service";
import { Hook, AfterHook, AuthHookContext } from "@thallesp/nestjs-better-auth";
import { OrganisationInvitationService } from "../../organisations/services/organisation-invitation.service";
import { OrganisationsService } from "../../organisations/services/organisations.service";
import {
  ERROR_MESSAGES,
  formatError,
} from "../../common/constants/error-messages.constants";

@Hook()
@Injectable()
export class UserCreatedHook {
  private readonly logger = new Logger(UserCreatedHook.name);

  constructor(
    private readonly rbacService: RbacService,
    private readonly assignmentService: RbacAssignmentService,
    private readonly betterAuthUserService: BetterAuthUserService,
    private readonly invitationService: OrganisationInvitationService,
    private readonly organisationsService: OrganisationsService,
  ) {}

  @AfterHook("/sign-up/email")
  async onUserCreated(ctx: AuthHookContext) {
    await this.processUserFromAuthContext(ctx, { requireInvitation: true });
  }

  @AfterHook("/sso/saml2/sp/acs/okta")
  async onSSOSignIn(ctx: AuthHookContext) {
    await this.processUserFromAuthContext(ctx, { requireInvitation: false });
  }

  private async processUserFromAuthContext(
    ctx: AuthHookContext,
    options: { requireInvitation: boolean },
  ) {
    const ctxAny = ctx as any;

    const user =
      ctxAny?.context?.newSession?.user ||
      ctxAny?.returned?.user ||
      ctxAny?.returned?.data?.user ||
      ctxAny?.returned?.data?.data?.user ||
      ctxAny?.input?.user ||
      ctxAny?.user ||
      ctxAny?.body?.user ||
      ctxAny?.result?.user ||
      ctxAny?.data?.user ||
      ctxAny?.returned ||
      ctxAny?.result;

    const email =
      user?.email ||
      ctxAny?.input?.email ||
      ctxAny?.body?.email ||
      ctxAny?.input?.body?.email ||
      ctxAny?.returned?.email ||
      ctxAny?.returned?.data?.email ||
      ctxAny?.data?.email;

    let userId = user?.id;
    if (!userId && email) {
      try {
        userId = await this.betterAuthUserService.getUserIdByEmail(email);
        if (userId) {
          this.logger.log(
            `Found user ID ${userId} for email ${email} via database query`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Error querying user by email ${email}: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }

    if (!userId) {
      this.logger.warn(
        "No user found in context and no email available, skipping role assignment",
      );
      return;
    }

    const isFirstUser = await this.rbacService.isFirstUser();
    if (isFirstUser) {
      await this.processUserRoleAssignment({ id: userId, email });
      return;
    }

    if (!email) {
      if (options.requireInvitation) {
        this.logger.warn(
          "No email available to validate invitation, rejecting sign-up",
        );
        throw new BadRequestException(
          formatError(ERROR_MESSAGES.INVITE_REQUIRED),
        );
      }
      return;
    }

    const invite = await this.invitationService.findPendingByEmail(email);
    if (!invite) {
      if (options.requireInvitation) {
        this.logger.warn(`No valid invitation found for ${email}`);
        throw new BadRequestException(
          formatError(ERROR_MESSAGES.INVITE_REQUIRED),
        );
      }
      this.logger.debug(`No pending invitation for ${email}, allowing sign-in`);
      return;
    }

    await this.organisationsService.addUserById(
      invite.organisationId,
      userId,
      invite.roleId || undefined,
    );
    await this.invitationService.consumeInvite(invite);
    this.logger.log(
      `Accepted invite for ${email} to organisation ${invite.organisationId}`,
    );
  }

  private async processUserRoleAssignment(user: {
    id: string;
    email?: string;
  }) {
    const ownerRoleId = await this.rbacService.getOwnerRoleId();

    if (ownerRoleId) {
      try {
        await this.assignmentService.assignRole(user.id, ownerRoleId);
        this.logger.log(`Assigned Owner role to first user ${user.id}`);
      } catch (error) {
        this.logger.error(
          `Failed to assign Owner role to user ${user.id}: ${error.message}`,
          error.stack,
        );
      }
    } else {
      this.logger.warn(
        `Owner role not found in database, cannot assign to user ${user.id}`,
      );
    }
  }
}
