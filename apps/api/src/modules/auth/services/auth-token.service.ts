import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { randomBytes } from "node:crypto";
import { EnvConfig } from "#api/config/env.validation";
import {
  hashPasswordResetToken,
  hashRefreshToken,
  parseDurationMs,
  passwordResetTtlMs,
} from "#api/modules/auth/utils/crypto";
import type { AuthUser, RefreshTokenMaterial } from "#api/modules/auth/types/auth.types";

@Injectable()
export class AuthTokenService {
  private readonly accessTokenSecret: string;
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlMs: number;

  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ConfigService) configService: ConfigService<EnvConfig, true>,
  ) {
    this.accessTokenSecret = configService.get("JWT_ACCESS_SECRET", {
      infer: true,
    });
    this.accessTokenTtlSeconds = Math.floor(
      parseDurationMs(configService.get("JWT_ACCESS_EXPIRES_IN", { infer: true })) / 1000,
    );
    this.refreshTokenTtlMs = parseDurationMs(
      configService.get("JWT_REFRESH_EXPIRES_IN", { infer: true }),
    );
  }

  createRefreshTokenMaterial(now: Date): RefreshTokenMaterial {
    const rawToken = randomBytes(32).toString("base64url");

    return {
      rawToken,
      tokenHash: hashRefreshToken(rawToken),
      expiresAt: new Date(now.getTime() + this.refreshTokenTtlMs),
    };
  }

  createPasswordResetTokenMaterial(now: Date): RefreshTokenMaterial {
    const rawToken = randomBytes(32).toString("base64url");

    return {
      rawToken,
      tokenHash: hashPasswordResetToken(rawToken),
      expiresAt: new Date(now.getTime() + passwordResetTtlMs),
    };
  }

  signAccessToken(user: Pick<AuthUser, "id" | "role">) {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        role: user.role,
        tokenType: "access",
      },
      {
        secret: this.accessTokenSecret,
        expiresIn: this.accessTokenTtlSeconds,
      },
    );
  }
}
