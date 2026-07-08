import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UserRole, UserStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { EnvConfig } from "../../config/env.validation";
import { AuthenticatedRequest } from "./authenticated-request";

type AccessTokenPayload = {
  sub?: unknown;
  role?: unknown;
  tokenType?: unknown;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly accessTokenSecret: string;

  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) configService: ConfigService<EnvConfig, true>,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {
    this.accessTokenSecret = configService.get("JWT_ACCESS_SECRET", {
      infer: true,
    });
  }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throwUnauthorized();
    }

    const payload = await this.verifyAccessToken(token);

    if (!isValidAccessPayload(payload)) {
      throwUnauthorized();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        role: true,
        status: true,
        deletedAt: true,
      },
    });

    if (
      !user ||
      user.deletedAt ||
      user.status !== UserStatus.ACTIVE ||
      user.role !== payload.role
    ) {
      throwUnauthorized();
    }

    request.user = {
      id: user.id,
      role: user.role,
    };

    return true;
  }

  private async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.accessTokenSecret,
      });
    } catch {
      throwUnauthorized();
    }
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

function isValidAccessPayload(payload: AccessTokenPayload): payload is {
  sub: string;
  role: UserRole;
  tokenType: "access";
} {
  return (
    typeof payload.sub === "string" &&
    isUserRole(payload.role) &&
    payload.tokenType === "access"
  );
}

function isUserRole(value: unknown): value is UserRole {
  return (
    value === UserRole.ADMIN || value === UserRole.STUDENT || value === UserRole.PARENT
  );
}

function throwUnauthorized(): never {
  throw new UnauthorizedException({
    code: "UNAUTHORIZED",
    message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn",
  });
}
