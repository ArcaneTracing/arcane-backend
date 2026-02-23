import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { validateLicense } from "./validate-license.util";

const CACHE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);

  private cachedResult: boolean | null = null;
  private cacheExpiry = 0;

  constructor(private readonly configService: ConfigService) {}

  isEnterpriseLicensed(): boolean {
    const now = Date.now();
    if (this.cachedResult !== null && now < this.cacheExpiry) {
      return this.cachedResult;
    }

    const license = this.configService.get<string>("ARCANE_ENTERPRISE_LICENSE");
    const result = validateLicense(license);

    if (!result.valid) {
      this.logger.debug(
        `Enterprise license validation failed: ${result.error ?? "unknown"}`,
      );
    }

    this.cachedResult = result.valid;
    this.cacheExpiry = now + CACHE_TTL_MS;
    return result.valid;
  }
}
