import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BetterAuthUserService } from "./services/better-auth-user.service";
import { BetterAuthUser } from "./entities/user.entity";
import { SetupController } from "./controllers/setup.controller";

@Module({
  imports: [TypeOrmModule.forFeature([BetterAuthUser])],
  controllers: [SetupController],
  providers: [BetterAuthUserService],
  exports: [BetterAuthUserService],
})
export class AuthModule {}
