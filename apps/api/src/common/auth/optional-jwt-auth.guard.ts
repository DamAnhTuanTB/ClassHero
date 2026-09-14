import { ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { AuthenticatedRequest } from "#api/common/auth/authenticated-request";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { AccessTokenIdentityService } from "#api/modules/auth/services/access-token-identity.service";

@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  constructor(
    @Inject(AccessTokenIdentityService)
    accessTokenIdentity: AccessTokenIdentityService,
  ) {
    super(accessTokenIdentity);
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
