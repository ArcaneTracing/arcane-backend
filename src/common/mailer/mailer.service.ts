import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { render } from "@react-email/render";
import { InviteEmail } from "./templates/invite-email";

export type OrganisationInviteEmail = {
  to: string;
  organisationName: string;
  inviteUrl: string;
  invitedByEmail?: string | null;
  oktaMode?: boolean;
};

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>("SMTP_HOST");
    const port = Number(this.configService.get<string>("SMTP_PORT") || 587);
    const secure = this.configService.get<string>("SMTP_SECURE") === "true";
    const user = this.configService.get<string>("SMTP_USER");
    const pass = this.configService.get<string>("SMTP_PASS");

    if (!host) {
      this.logger.error(
        "SMTP_HOST is not configured. Email sending is disabled.",
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });

    this.fromAddress =
      this.configService.get<string>("MAIL_FROM") || "no-reply@example.com";
  }

  async sendOrganisationInvite({
    to,
    organisationName,
    inviteUrl,
    invitedByEmail,
    oktaMode,
  }: OrganisationInviteEmail): Promise<void> {
    if (!this.configService.get<string>("SMTP_HOST")) {
      throw new Error("SMTP_HOST is not configured");
    }

    const email = InviteEmail({
      organisationName,
      inviteUrl,
      invitedByEmail,
      oktaMode,
    });
    const html = await render(email);
    const text = await render(email, { plainText: true });

    await this.transporter.sendMail({
      from: this.fromAddress,
      to,
      subject: `Welcome to Arcane - You've been invited to join ${organisationName}`,
      html,
      text,
    });

    this.logger.log(`Sent organisation invite to ${to}`);
  }
}
