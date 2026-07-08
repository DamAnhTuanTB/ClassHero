import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { RolesGuard } from "../../common/auth/roles.guard";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { ProfileController } from "./profile.controller";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, ProfileController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
