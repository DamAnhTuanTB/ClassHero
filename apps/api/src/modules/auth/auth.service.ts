import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Gender, Prisma, UserRole, UserStatus } from "@prisma/client";
import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../../common/prisma/prisma.service";
import { EnvConfig } from "../../config/env.validation";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { RegisterParentDto } from "./dto/register-parent.dto";
import { RegisterStudentDto } from "./dto/register-student.dto";

const passwordKeyLength = 64;
const scryptParams = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
} as const;

const authUserSelect = {
  id: true,
  role: true,
  status: true,
  email: true,
  phone: true,
  username: true,
  passwordHash: true,
  fullName: true,
  deletedAt: true,
} satisfies Prisma.UserSelect;

type AuthUser = Prisma.UserGetPayload<{ select: typeof authUserSelect }>;

type UserResponse = {
  id: string;
  role: UserRole;
  email: string | null;
  phone: string | null;
  username: string | null;
  fullName: string | null;
};

type RefreshTokenMaterial = {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
};

@Injectable()
export class AuthService {
  private readonly accessTokenSecret: string;
  private readonly accessTokenTtlSeconds: number;
  private readonly refreshTokenTtlMs: number;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
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

  async registerStudent(dto: RegisterStudentDto) {
    const email = normalizeEmail(dto.email);
    const phone = normalizePhone(dto.phone);
    const username = normalizeUsername(dto.username);
    const passwordHash = await hashPassword(dto.password);
    const dateOfBirth = parseDateOnly(dto.dateOfBirth);

    const user = await this.createStudentWithProfile({
      email,
      phone,
      username,
      passwordHash,
      fullName: normalizeName(dto.fullName),
      gender: dto.gender,
      dateOfBirth,
      grade: dto.grade,
    });

    const studentProfile = user.studentProfile;

    if (!studentProfile) {
      throw new InternalServerErrorException({
        code: "INTERNAL_SERVER_ERROR",
        message: "Không thể tạo hồ sơ học sinh",
      });
    }

    return {
      user: serializeUser(user),
      studentProfile: {
        grade: studentProfile.grade,
        childCode: studentProfile.childCode,
      },
    };
  }

  async registerParent(dto: RegisterParentDto) {
    const email = normalizeEmail(dto.email);
    const phone = normalizePhone(dto.phone);
    const passwordHash = await hashPassword(dto.password);

    const user = await this.createParentWithProfile({
      email,
      phone,
      passwordHash,
      fullName: normalizeName(dto.fullName),
    });

    return {
      user: serializeUser(user),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.findUserByIdentifier(dto.identifier);

    if (!user || !(await verifyPassword(dto.password, user.passwordHash))) {
      throwInvalidCredentials();
    }

    assertActiveUser(user);

    const refreshToken = this.createRefreshTokenMaterial(new Date());
    const accessToken = await this.signAccessToken(user);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      this.prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: refreshToken.tokenHash,
          expiresAt: refreshToken.expiresAt,
        },
      }),
    ]);

    return {
      accessToken,
      refreshToken: refreshToken.rawToken,
      user: serializeUser(user),
    };
  }

  async refresh(dto: RefreshTokenDto) {
    const now = new Date();
    const tokenHash = hashRefreshToken(dto.refreshToken);
    const existingToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: authUserSelect,
        },
      },
    });

    if (
      !existingToken ||
      existingToken.revokedAt ||
      existingToken.expiresAt <= now ||
      existingToken.user.deletedAt
    ) {
      throwInvalidRefreshToken();
    }

    assertActiveUser(existingToken.user);

    const refreshToken = this.createRefreshTokenMaterial(now);
    const accessToken = await this.signAccessToken(existingToken.user);

    await this.prisma.$transaction(async (tx) => {
      const revokeResult = await tx.refreshToken.updateMany({
        where: {
          id: existingToken.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      if (revokeResult.count !== 1) {
        throwInvalidRefreshToken();
      }

      await tx.refreshToken.create({
        data: {
          userId: existingToken.userId,
          tokenHash: refreshToken.tokenHash,
          expiresAt: refreshToken.expiresAt,
        },
      });
    });

    return {
      accessToken,
      refreshToken: refreshToken.rawToken,
      user: serializeUser(existingToken.user),
    };
  }

  async logout(dto: RefreshTokenDto) {
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash: hashRefreshToken(dto.refreshToken),
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { success: true };
  }

  private async createStudentWithProfile(data: {
    email: string;
    phone: string;
    username: string;
    passwordHash: string;
    fullName: string;
    gender: Gender;
    dateOfBirth: Date;
    grade: number;
  }) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await assertUniqueIdentity(tx, {
          email: data.email,
          phone: data.phone,
          username: data.username,
        });

        const childCode = await createUniqueChildCode(tx);

        return tx.user.create({
          data: {
            role: UserRole.STUDENT,
            status: UserStatus.ACTIVE,
            email: data.email,
            phone: data.phone,
            username: data.username,
            passwordHash: data.passwordHash,
            fullName: data.fullName,
            gender: data.gender,
            dateOfBirth: data.dateOfBirth,
            studentProfile: {
              create: {
                grade: data.grade,
                childCode,
                displayName: data.fullName,
              },
            },
          },
          select: {
            ...authUserSelect,
            studentProfile: {
              select: {
                grade: true,
                childCode: true,
              },
            },
          },
        });
      });
    } catch (error) {
      handleUniqueConstraintError(error);
      throw error;
    }
  }

  private async createParentWithProfile(data: {
    email: string;
    phone: string;
    passwordHash: string;
    fullName: string;
  }) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await assertUniqueIdentity(tx, {
          email: data.email,
          phone: data.phone,
        });

        return tx.user.create({
          data: {
            role: UserRole.PARENT,
            status: UserStatus.ACTIVE,
            email: data.email,
            phone: data.phone,
            passwordHash: data.passwordHash,
            fullName: data.fullName,
            gender: Gender.UNKNOWN,
            parentProfile: {
              create: {},
            },
          },
          select: {
            ...authUserSelect,
            parentProfile: {
              select: {
                id: true,
              },
            },
          },
        });
      });
    } catch (error) {
      handleUniqueConstraintError(error);
      throw error;
    }
  }

  private async findUserByIdentifier(identifier: string) {
    const normalizedIdentifier = normalizeIdentifier(identifier);
    const lowerIdentifier = normalizedIdentifier.toLowerCase();

    return this.prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { email: lowerIdentifier },
          { username: lowerIdentifier },
          { phone: normalizedIdentifier },
        ],
      },
      select: authUserSelect,
    });
  }

  private createRefreshTokenMaterial(now: Date): RefreshTokenMaterial {
    const rawToken = randomBytes(32).toString("base64url");

    return {
      rawToken,
      tokenHash: hashRefreshToken(rawToken),
      expiresAt: new Date(now.getTime() + this.refreshTokenTtlMs),
    };
  }

  private signAccessToken(user: Pick<AuthUser, "id" | "role">) {
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

async function assertUniqueIdentity(
  tx: Prisma.TransactionClient,
  identity: {
    email?: string;
    phone?: string;
    username?: string;
  },
) {
  const filters: Prisma.UserWhereInput[] = [];

  if (identity.email) {
    filters.push({ email: identity.email });
  }

  if (identity.phone) {
    filters.push({ phone: identity.phone });
  }

  if (identity.username) {
    filters.push({ username: identity.username });
  }

  const existingUsers = await tx.user.findMany({
    where: { OR: filters },
    select: {
      email: true,
      phone: true,
      username: true,
    },
  });

  for (const existingUser of existingUsers) {
    if (identity.email && existingUser.email === identity.email) {
      throwDuplicate("DUPLICATE_EMAIL", "Email đã được sử dụng");
    }

    if (identity.phone && existingUser.phone === identity.phone) {
      throwDuplicate("DUPLICATE_PHONE", "Số điện thoại đã được sử dụng");
    }

    if (identity.username && existingUser.username === identity.username) {
      throwDuplicate("DUPLICATE_USERNAME", "Username đã được sử dụng");
    }
  }
}

async function createUniqueChildCode(tx: Prisma.TransactionClient) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `LP${randomInt(100000, 999999)}`;
    const existingProfile = await tx.studentProfile.findUnique({
      where: { childCode: code },
      select: { id: true },
    });

    if (!existingProfile) {
      return code;
    }
  }

  throw new InternalServerErrorException({
    code: "INTERNAL_SERVER_ERROR",
    message: "Không thể tạo mã liên kết học sinh",
  });
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = await deriveScryptKey(password, salt, scryptParams);

  return [
    "scrypt",
    "v1",
    String(scryptParams.N),
    String(scryptParams.r),
    String(scryptParams.p),
    salt,
    derivedKey.toString("base64url"),
  ].join("$");
}

async function verifyPassword(password: string, storedHash: string) {
  const parts = storedHash.split("$");

  if (parts[0] !== "scrypt") {
    return false;
  }

  if (parts.length === 3) {
    const salt = parts[1];
    const expectedHash = parts[2];

    if (!salt || !expectedHash) {
      return false;
    }

    const actualHash = await deriveScryptKey(password, salt);
    return safeCompareHex(actualHash, expectedHash);
  }

  if (parts.length === 7 && parts[1] === "v1") {
    const nValue = parts[2];
    const rValue = parts[3];
    const pValue = parts[4];
    const salt = parts[5];
    const expectedHash = parts[6];

    if (!nValue || !rValue || !pValue || !salt || !expectedHash) {
      return false;
    }

    const actualHash = await deriveScryptKey(password, salt, {
      N: Number(nValue),
      r: Number(rValue),
      p: Number(pValue),
      maxmem: 64 * 1024 * 1024,
    });

    return safeCompareBase64Url(actualHash, expectedHash);
  }

  return false;
}

function deriveScryptKey(
  password: string,
  salt: string,
  options?: Parameters<typeof scrypt>[3],
) {
  return new Promise<Buffer>((resolve, reject) => {
    const callback = (error: Error | null, derivedKey: Buffer) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    };

    if (options) {
      scrypt(password, salt, passwordKeyLength, options, callback);
      return;
    }

    scrypt(password, salt, passwordKeyLength, callback);
  });
}

function safeCompareHex(actual: Buffer, expectedHex: string) {
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function safeCompareBase64Url(actual: Buffer, expectedBase64Url: string) {
  const expected = Buffer.from(expectedBase64Url, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashRefreshToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function parseDurationMs(value: string) {
  const normalizedValue = value.trim().toLowerCase();
  const match = /^(\d+)(ms|s|m|h|d)?$/.exec(normalizedValue);

  if (!match) {
    throw new Error(`Invalid duration value: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? "s";
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  } as const;

  return amount * multipliers[unit as keyof typeof multipliers];
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string) {
  return phone.trim();
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeIdentifier(identifier: string) {
  return identifier.trim();
}

function parseDateOnly(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function serializeUser(user: Pick<AuthUser, keyof UserResponse>): UserResponse {
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    phone: user.phone,
    username: user.username,
    fullName: user.fullName,
  };
}

function assertActiveUser(user: Pick<AuthUser, "status">) {
  if (user.status !== UserStatus.ACTIVE) {
    throw new ForbiddenException({
      code: "FORBIDDEN",
      message: "Tài khoản không hoạt động",
    });
  }
}

function throwInvalidCredentials(): never {
  throw new UnauthorizedException({
    code: "INVALID_CREDENTIALS",
    message: "Thông tin đăng nhập không đúng",
  });
}

function throwInvalidRefreshToken(): never {
  throw new UnauthorizedException({
    code: "UNAUTHORIZED",
    message: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn",
  });
}

function throwDuplicate(code: string, message: string): never {
  throw new ConflictException({
    code,
    message,
  });
}

function handleUniqueConstraintError(error: unknown) {
  if (!isPrismaKnownRequestError(error) || error.code !== "P2002") {
    return;
  }

  const target = error.meta?.target;

  if (Array.isArray(target)) {
    if (target.includes("email")) {
      throwDuplicate("DUPLICATE_EMAIL", "Email đã được sử dụng");
    }

    if (target.includes("phone")) {
      throwDuplicate("DUPLICATE_PHONE", "Số điện thoại đã được sử dụng");
    }

    if (target.includes("username")) {
      throwDuplicate("DUPLICATE_USERNAME", "Username đã được sử dụng");
    }
  }
}

function isPrismaKnownRequestError(error: unknown): error is {
  code: string;
  meta?: { target?: unknown };
} {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  );
}
