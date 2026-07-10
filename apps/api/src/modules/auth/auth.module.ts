import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { AuthController } from "#api/modules/auth/controllers/auth.controller";
import { AuthService } from "#api/modules/auth/services/auth.service";
import { ProfileController } from "#api/modules/auth/controllers/profile.controller";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, ProfileController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
