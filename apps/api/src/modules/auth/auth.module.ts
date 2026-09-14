import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { AuthController } from "#api/modules/auth/controllers/auth.controller";
import { AuthService } from "#api/modules/auth/services/auth.service";
import { AuthTokenService } from "#api/modules/auth/services/auth-token.service";
import { ProfileController } from "#api/modules/auth/controllers/profile.controller";
import { AccessTokenIdentityService } from "#api/modules/auth/services/access-token-identity.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController, ProfileController],
  providers: [
    AccessTokenIdentityService,
    AuthService,
    AuthTokenService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    AccessTokenIdentityService,
    AuthService,
    JwtAuthGuard,
    RolesGuard,
    JwtModule,
  ],
})
export class AuthModule {}
