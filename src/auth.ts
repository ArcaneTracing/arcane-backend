import { betterAuth } from "better-auth";
import { sso } from "@better-auth/sso";
import { Pool } from "pg";
import { config } from "dotenv";
import { validateLicense } from "./license/validate-license.util";

config();

const oktaLicenseValid = validateLicense(
  process.env.ARCANE_ENTERPRISE_LICENSE,
).valid;
const oktaEnabled = process.env.OKTA_SSO_ENABLED === "true" && oktaLicenseValid;

const oktaEntryPoint = process.env.OKTA_SSO_ENTRY_POINT;
const oktaSamlCert = process.env.OKTA_SAML_CERT;
const oktaEntityId = process.env.OKTA_ENTITY_ID;
if (oktaEnabled && (!oktaEntryPoint || !oktaSamlCert || !oktaEntityId)) {
  throw new Error(
    "OKTA_SSO_ENABLED=true requires OKTA_SSO_ENTRY_POINT, OKTA_SAML_CERT, and OKTA_ENTITY_ID",
  );
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const betterAuthSecret = process.env.BETTER_AUTH_SECRET;
if (!betterAuthSecret) {
  throw new Error("BETTER_AUTH_SECRET environment variable is not set");
}

const betterAuthUrl = process.env.BETTER_AUTH_URL;
if (!betterAuthUrl) {
  throw new Error("BETTER_AUTH_URL environment variable is not set");
}

const pool = new Pool({
  connectionString: databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const auth = betterAuth({
  database: pool,
  secret: betterAuthSecret,
  baseURL: betterAuthUrl,
  emailAndPassword: {
    enabled: !oktaEnabled,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 15,
    },
  },
  trustedOrigins: [
    ...(process.env.FRONTEND_URL?.split(",") || ["http://localhost:3000"]),
    ...(oktaEnabled && process.env.OKTA_ISSUER_URL
      ? [process.env.OKTA_ISSUER_URL]
      : []),
  ],

  plugins: [
    ...(oktaEnabled
      ? [
          sso({
            defaultSSO: [
              {
                domain: process.env.BETTER_AUTH_SSO_DOMAIN || "localhost:3000",
                providerId: "okta",
                samlConfig: {
                  issuer: `${betterAuthUrl}/api/auth/sso/saml2/sp/metadata`,
                  entryPoint: oktaEntryPoint,
                  callbackUrl:
                    process.env.OKTA_SSO_CALLBACK_URL || "/organisations",
                  cert: oktaSamlCert,
                  idpMetadata: {
                    entityID: oktaEntityId,
                    singleSignOnService: [
                      {
                        Binding:
                          "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
                        Location: oktaEntryPoint,
                      },
                    ],
                  },
                  ...(process.env.OKTA_SP_METADATA && {
                    spMetadata: { metadata: process.env.OKTA_SP_METADATA },
                  }),
                },
              },
            ],
          }),
        ]
      : []),
  ],

  user: {
    additionalFields: {
      auth0Id: {
        type: "string",
        required: false,
      },
    },
  },
  hooks: {},
});
