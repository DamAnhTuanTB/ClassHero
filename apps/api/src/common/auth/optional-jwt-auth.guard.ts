import { ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuthenticatedRequest } from "#api/common/auth/authenticated-request";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { EnvConfig } from "#api/config/env.validation";

@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  constructor(
    @Inject(JwtService) jwtService: JwtService,
    @Inject(ConfigService) configService: ConfigService<EnvConfig, true>,
    @Inject(PrismaService) prisma: PrismaService,
  ) {
    super(jwtService, configService, prisma);
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!hasBearerToken(request.headers.authorization)) {
      return true;
    }

    return super.canActivate(context);
  }
}

function hasBearerToken(authorization: string | string[] | undefined) {
  const header = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!header) {
    return false;
  }

  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" && Boolean(token);
}
