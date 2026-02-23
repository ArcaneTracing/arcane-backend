import { LICENSE_PREFIX, LICENSE_REGEX } from "./license.constants";

export interface ValidateLicenseResult {
  valid: boolean;
  error?: string;
}

export function validateLicense(
  license: string | undefined,
): ValidateLicenseResult {
  if (
    license === undefined ||
    license === null ||
    typeof license !== "string"
  ) {
    return { valid: false, error: "License is missing or invalid" };
  }

  const trimmed = license.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "License is empty" };
  }

  if (!trimmed.startsWith(LICENSE_PREFIX)) {
    return { valid: false, error: "Invalid license format" };
  }

  if (!LICENSE_REGEX.test(trimmed)) {
    return { valid: false, error: "Invalid license format" };
  }

  const base64Payload = trimmed.slice(LICENSE_PREFIX.length);
  let decoded: string;
  try {
    decoded = Buffer.from(base64Payload, "base64").toString("utf-8");
  } catch {
    return { valid: false, error: "Invalid license encoding" };
  }

  if (!decoded || decoded.length === 0) {
    return { valid: false, error: "Invalid license payload" };
  }

  const parts = decoded.split("-");
  if (parts.length < 3) {
    return { valid: false, error: "Invalid license payload format" };
  }

  const startStr = parts[parts.length - 2];
  const endStr = parts[parts.length - 1];
  const start = Number.parseInt(startStr, 10);
  const end = Number.parseInt(endStr, 10);

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return { valid: false, error: "Invalid license timestamps" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (now < start) {
    return { valid: false, error: "License not yet valid" };
  }
  if (now > end) {
    return { valid: false, error: "License is expired" };
  }

  return { valid: true };
}
