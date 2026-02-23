import { Module } from "@nestjs/common";
import { LicenseService } from "./license.service";
import { EnterpriseLicenseGuard } from "./guards/enterprise-license.guard";
import { ConfigController } from "./config.controller";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [ConfigModule],
  controllers: [ConfigController],
  providers: [LicenseService, EnterpriseLicenseGuard],
  exports: [LicenseService, EnterpriseLicenseGuard],
})
export class LicenseModule {}
