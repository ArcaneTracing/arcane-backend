import { validateLicense } from "./validate-license.util";

describe("validateLicense", () => {
  it("returns invalid when license is undefined", () => {
    expect(validateLicense(undefined)).toEqual({
      valid: false,
      error: "License is missing or invalid",
    });
  });

  it("returns invalid when license is empty string", () => {
    expect(validateLicense("")).toEqual({
      valid: false,
      error: "License is empty",
    });
  });

  it("returns invalid when license does not start with arcane_", () => {
    expect(validateLicense("invalid_abc")).toEqual({
      valid: false,
      error: "Invalid license format",
    });
  });

  it("returns invalid when base64 payload fails regex", () => {
    expect(validateLicense("arcane_!!!invalid!!!")).toEqual({
      valid: false,
      error: "Invalid license format",
    });
  });

  it("returns invalid when payload has wrong format (missing timestamps)", () => {
    const payload = Buffer.from("enterprise-only", "utf-8").toString("base64");
    expect(validateLicense(`arcane_${payload}`)).toEqual({
      valid: false,
      error: "Invalid license payload format",
    });
  });

  it("returns invalid when license is expired", () => {
    const payload = Buffer.from(
      "enterprise-1577836800-1609459199",
      "utf-8",
    ).toString("base64");
    expect(validateLicense(`arcane_${payload}`)).toEqual({
      valid: false,
      error: "License is expired",
    });
  });

  it("returns invalid when license is not yet valid", () => {
    const payload = Buffer.from(
      "enterprise-1893456000-1924991999",
      "utf-8",
    ).toString("base64");
    expect(validateLicense(`arcane_${payload}`)).toEqual({
      valid: false,
      error: "License not yet valid",
    });
  });

  it("returns valid for a license within the valid time range", () => {
    const now = Math.floor(Date.now() / 1000);
    const start = now - 86400;
    const end = now + 86400;
    const payload = Buffer.from(`enterprise-${start}-${end}`, "utf-8").toString(
      "base64",
    );
    expect(validateLicense(`arcane_${payload}`)).toEqual({ valid: true });
  });

  it("returns valid for a license with custom identifier", () => {
    const now = Math.floor(Date.now() / 1000);
    const start = now - 86400;
    const end = now + 86400;
    const payload = Buffer.from(
      `customer-123-${start}-${end}`,
      "utf-8",
    ).toString("base64");
    expect(validateLicense(`arcane_${payload}`)).toEqual({ valid: true });
  });
});
