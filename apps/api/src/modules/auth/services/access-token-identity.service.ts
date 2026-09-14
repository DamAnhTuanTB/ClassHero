import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { UserRole, UserStatus } from "@prisma/client";

import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";

type AccessTokenPayload = {
  sub?: unknown;
  role?: unknown;
  tokenType?: unknown;
};

@Injectable()
export class AccessTokenIdentityService {
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

  async resolve(token: string): Promise<AuthenticatedUser | null> {
    const payload = await this.verify(token);
    if (!payload) return null;

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
      return null;
    }

    return { id: user.id, role: user.role };
  }

  private async verify(
    token: string,
  ): Promise<{ sub: string; role: UserRole; tokenType: "access" } | null> {
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.accessTokenSecret,
      });
      return isValidAccessPayload(payload) ? payload : null;
    } catch {
      return null;
    }
  }
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
