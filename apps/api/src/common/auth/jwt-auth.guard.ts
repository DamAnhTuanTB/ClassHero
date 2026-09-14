import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { AuthenticatedRequest } from "#api/common/auth/authenticated-request";
import { throwUnauthorized as throwApiUnauthorized } from "#api/common/errors/api-exception";
import { AccessTokenIdentityService } from "#api/modules/auth/services/access-token-identity.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(AccessTokenIdentityService)
    private readonly accessTokenIdentity: AccessTokenIdentityService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throwUnauthorized();
    }

    const user = await this.accessTokenIdentity.resolve(token);
    if (!user) {
      throwUnauthorized();
    }

    request.user = user;

    return true;
  }
}

function extractBearerToken(authorization: string | string[] | undefined) {
  const header = Array.isArray(authorization) ? authorization[0] : authorization;

  if (!header) {
    return undefined;
  }

  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return undefined;
  }

  return token;
}

function throwUnauthorized(): never {
  throwApiUnauthorized("UNAUTHORIZED", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn");
}
