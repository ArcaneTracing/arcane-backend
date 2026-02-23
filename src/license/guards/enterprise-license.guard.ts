import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { LicenseService } from "../license.service";
import { ERROR_MESSAGES } from "../../common/constants/error-messages.constants";

@Injectable()
export class EnterpriseLicenseGuard implements CanActivate {
  constructor(private readonly licenseService: LicenseService) {}

  canActivate(_context: ExecutionContext): boolean {
    if (!this.licenseService.isEnterpriseLicensed()) {
      throw new ForbiddenException(ERROR_MESSAGES.ENTERPRISE_LICENSE_REQUIRED);
    }
    return true;
  }
}
