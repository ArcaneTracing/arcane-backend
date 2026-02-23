export class CheckInvitationResponseDto {
  valid: boolean;
  reason?: "expired" | "revoked" | "not_found" | "accepted";
  invite?: {
    organisationId: string;
    organisationName: string;
    email: string;
    expiresAt: string;
  };
}
