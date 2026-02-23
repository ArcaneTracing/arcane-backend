import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { AllowAnonymous } from "@thallesp/nestjs-better-auth";
import { ApiTags, ApiQuery } from "@nestjs/swagger";
import { OrganisationInvitationService } from "../services/organisation-invitation.service";
import { CheckInvitationResponseDto } from "../dto/response/check-invitation-response.dto";

@Controller("v1/invitations")
@ApiTags("invitations")
export class InvitationsController {
  constructor(
    private readonly invitationService: OrganisationInvitationService,
  ) {}

  @Get("check")
  @AllowAnonymous()
  @ApiQuery({ name: "token", required: true })
  @ApiQuery({ name: "email", required: true })
  async checkInvite(
    @Query("token") token: string,
    @Query("email") email?: string,
  ): Promise<CheckInvitationResponseDto> {
    if (!token) {
      throw new BadRequestException("Token is required");
    }
    if (!email) {
      throw new BadRequestException("Email is required");
    }

    const result = await this.invitationService.checkInvite(token, email);
    if (!result.valid || !result.invite) {
      return {
        valid: false,
        reason: result.reason,
      };
    }

    return {
      valid: true,
      invite: {
        organisationId: result.invite.organisationId,
        organisationName: result.invite.organisation?.name || "Organisation",
        email: result.invite.email,
        expiresAt: result.invite.expiresAt.toISOString(),
      },
    };
  }
}
