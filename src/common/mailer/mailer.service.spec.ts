const sendMailMock = jest.fn().mockResolvedValue(undefined);
const createTransportMock = jest.fn(() => ({ sendMail: sendMailMock }));
const renderMock = jest.fn((_: unknown, options?: { plainText?: boolean }) =>
  Promise.resolve(options?.plainText ? "text" : "html"),
);
const inviteEmailMock = jest.fn(() => "email-element");

jest.mock("nodemailer", () => ({
  createTransport: createTransportMock,
}));
jest.mock("@react-email/render", () => ({
  render: renderMock,
}));
jest.mock("./templates/invite-email", () => ({
  InviteEmail: inviteEmailMock,
}));

import { ConfigService } from "@nestjs/config";
import { MailerService } from "./mailer.service";

describe("MailerService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createConfig = (values: Record<string, string | undefined>) =>
    ({
      get: (key: string) => values[key],
    }) as ConfigService;

  it("throws when SMTP host is not configured", async () => {
    const config = createConfig({ SMTP_HOST: undefined });
    const service = new MailerService(config);

    await expect(
      service.sendOrganisationInvite({
        to: "user@example.com",
        organisationName: "Org",
        inviteUrl: "https://example.com",
      }),
    ).rejects.toThrow("SMTP_HOST is not configured");
  });

  it("sends an email with rendered template", async () => {
    const config = createConfig({
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "user",
      SMTP_PASS: "pass",
      MAIL_FROM: "no-reply@example.com",
    });
    const service = new MailerService(config);

    await service.sendOrganisationInvite({
      to: "user@example.com",
      organisationName: "Org",
      inviteUrl: "https://example.com",
      invitedByEmail: "admin@example.com",
    });

    expect(createTransportMock).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      secure: false,
      auth: { user: "user", pass: "pass" },
    });

    expect(inviteEmailMock).toHaveBeenCalledWith({
      organisationName: "Org",
      inviteUrl: "https://example.com",
      invitedByEmail: "admin@example.com",
    });

    expect(renderMock).toHaveBeenCalledTimes(2);
    expect(sendMailMock).toHaveBeenCalledWith({
      from: "no-reply@example.com",
      to: "user@example.com",
      subject: "Welcome to Arcane - You've been invited to join Org",
      html: "html",
      text: "text",
    });
  });
});
