import * as React from "react";

/** Arcane logo as inline SVG (red brand color #F93647) */
const LOGO_DATA_URI =
  "data:image/webp;base64,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";

export type InviteEmailProps = {
  organisationName: string;
  inviteUrl: string;
  invitedByEmail?: string | null;
  oktaMode?: boolean;
};

const styles = {
  body: {
    margin: "0",
    padding: "0",
    backgroundColor: "#0D0D0D",
    color: "hsl(214, 32%, 91%)",
    fontFamily: "Arial, sans-serif",
  },
  container: {
    maxWidth: "560px",
    margin: "40px auto",
    backgroundColor: "hsl(222.2, 84%, 4.9%)",
    border: "1px solid #2A2A2A",
    borderRadius: "16px",
    padding: "32px",
  },
  logoContainer: {
    textAlign: "center" as const,
    marginBottom: "24px",
  },
  logo: {
    maxWidth: "120px",
    height: "auto",
  },
  heading: {
    fontSize: "24px",
    margin: "0 0 16px",
    color: "hsl(210, 40%, 98%)",
    textAlign: "center" as const,
    fontWeight: "bold",
  },
  welcomeText: {
    fontSize: "16px",
    lineHeight: "1.8",
    margin: "0 0 20px",
    color: "hsl(214, 32%, 91%)",
    textAlign: "center" as const,
  },
  text: {
    fontSize: "14px",
    lineHeight: "1.6",
    margin: "0 0 16px",
    color: "hsl(214, 32%, 91%)",
  },
  muted: {
    fontSize: "12px",
    lineHeight: "1.6",
    margin: "16px 0 0",
    color: "hsl(0, 0%, 64%)",
  },
  button: {
    display: "inline-block",
    padding: "14px 28px",
    backgroundColor: "#F93647",
    color: "#FFFFFF",
    textDecoration: "none",
    borderRadius: "8px",
    fontWeight: "bold",
    fontSize: "16px",
    textAlign: "center" as const,
    margin: "24px auto",
  },
  buttonContainer: {
    textAlign: "center" as const,
    margin: "24px 0",
  },
  divider: {
    height: "1px",
    backgroundColor: "#2A2A2A",
    margin: "24px 0",
  },
  link: {
    color: "#F93647",
    wordBreak: "break-all",
  },
};

export function InviteEmail({
  organisationName,
  inviteUrl,
  invitedByEmail,
  oktaMode,
}: InviteEmailProps) {
  const invitedByLine = invitedByEmail
    ? `You've been invited by ${invitedByEmail} to join ${organisationName}.`
    : `You've been invited to join ${organisationName}.`;

  const ctaText = oktaMode
    ? "We're excited to have you on board! Sign in with your organisation account to join."
    : "We're excited to have you on board! Click the button below to accept your invitation and create your account.";
  const buttonLabel = oktaMode ? "Sign in" : "Accept Invitation";

  return React.createElement(
    "div",
    { style: styles.body },
    React.createElement(
      "div",
      { style: styles.container },

      React.createElement(
        "div",
        { style: styles.logoContainer },
        React.createElement("img", {
          src: LOGO_DATA_URI,
          alt: "Arcane Logo",
          style: styles.logo,
        }),
      ),

      React.createElement(
        "h1",
        { style: styles.heading },
        "Welcome to Arcane!",
      ),

      React.createElement("p", { style: styles.welcomeText }, invitedByLine),
      React.createElement("p", { style: styles.text }, ctaText),

      React.createElement(
        "div",
        { style: styles.buttonContainer },
        React.createElement(
          "a",
          { href: inviteUrl, style: styles.button },
          buttonLabel,
        ),
      ),
      React.createElement("div", { style: styles.divider }),
      React.createElement(
        "p",
        { style: styles.muted },
        "If the button does not work, copy and paste this link into your browser:",
      ),
      React.createElement(
        "p",
        { style: styles.muted },
        React.createElement(
          "a",
          { href: inviteUrl, style: styles.link },
          inviteUrl,
        ),
      ),
    ),
  );
}
