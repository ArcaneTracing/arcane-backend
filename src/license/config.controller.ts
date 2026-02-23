import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import { LicenseService } from "./license.service";

@Controller("v1/config")
@ApiTags("config")
export class ConfigController {
  constructor(
    private readonly licenseService: LicenseService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getConfig(): {
    features: { enterprise: boolean };
    oktaEnabled: boolean;
  } {
    const enterprise = this.licenseService.isEnterpriseLicensed();
    const oktaSsoEnabled =
      this.configService.get<string>("OKTA_SSO_ENABLED") === "true";
    return {
      features: { enterprise },
      oktaEnabled: oktaSsoEnabled && enterprise,
    };
  }
}
