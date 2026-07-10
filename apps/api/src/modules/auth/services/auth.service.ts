import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  FilePurpose,
  FileStatus,
  Gender,
  Prisma,
  UserRole,
  UserStatus,
} from "@prisma/client";
import {
  throwBadRequest,
  throwForbidden,
  throwInternalServerError,
  throwNotFound,
} from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { EnvConfig } from "#api/config/env.validation";
import {
  hashPassword,
  hashPasswordResetToken,
  hashRefreshToken,
  verifyPassword,
} from "#api/modules/auth/utils/crypto";
import {
  assertActiveUser,
  handleUniqueConstraintError,
  throwInvalidAccessToken,
  throwInvalidCredentials,
  throwInvalidRecoveryInfo,
  throwInvalidRefreshToken,
  throwInvalidResetToken,
  throwResetTokenExpired,
} from "#api/modules/auth/utils/errors";
import {
  assertUniqueIdentity,
  createUniqueChildCode,
} from "#api/modules/auth/utils/identity";
import {
  normalizeEmail,
  normalizeIdentifier,
  normalizeName,
  normalizeNullableText,
  normalizeOptionalSecret,
  normalizePhone,
  normalizeUsername,
  parseBirthYear,
} from "#api/modules/auth/utils/normalizers";
import {
  authUserSelect,
  currentUserSelect,
} from "#api/modules/auth/selectors/user.selects";
import {
  matchesPasswordResetIdentity,
  serializeCurrentUser,
  serializeUser,
} from "#api/modules/auth/serializers/auth.serializers";
import type { AuthUser, RequestContext } from "#api/modules/auth/types/auth.types";
import { AuthTokenService } from "#api/modules/auth/services/auth-token.service";
import { ForgotPasswordDto } from "#api/modules/auth/dto/forgot-password.dto";
import { LoginDto } from "#api/modules/auth/dto/login.dto";
import { RefreshTokenDto } from "#api/modules/auth/dto/refresh-token.dto";
import { RegisterParentDto } from "#api/modules/auth/dto/register-parent.dto";
import { RegisterStudentDto } from "#api/modules/auth/dto/register-student.dto";
import { ResetPasswordDto } from "#api/modules/auth/dto/reset-password.dto";
import { UpdateStudentProfileDto } from "#api/modules/auth/dto/update-student-profile.dto";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly webUrl: string;
  private readonly resendApiKey?: string;
  private readonly resendFromEmail?: string;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuthTokenService) private readonly authTokenService: AuthTokenService,
    @Inject(ConfigService) configService: ConfigService<EnvConfig, true>,
  ) {
    this.webUrl = configService.get("WEB_URL", { infer: true });
    this.resendApiKey = normalizeOptionalSecret(
      configService.get("RESEND_API_KEY", { infer: true }),
    );
    this.resendFromEmail = normalizeOptionalSecret(
      configService.get("RESEND_FROM_EMAIL", { infer: true }),
    );
  }

  async registerStudent(dto: RegisterStudentDto) {
    const email = dto.email ? normalizeEmail(dto.email) : null;
    const phone = dto.phone ? normalizePhone(dto.phone) : null;
    const username = normalizeUsername(dto.username);
    const passwordHash = await hashPassword(dto.password);
    const dateOfBirth = parseBirthYear(dto.birthYear);

    const user = await this.createStudentWithProfile({
      email,
      phone,
      username,
      passwordHash,
      fullName: normalizeName(dto.fullName),
      gender: dto.gender,
      dateOfBirth,
      grade: dto.grade,
      address: normalizeName(dto.address),
    });

    const studentProfile = user.studentProfile;

    if (!studentProfile) {
      throwInternalServerError("INTERNAL_SERVER_ERROR", "Không thể tạo hồ sơ học sinh");
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
    const email = dto.email ? normalizeEmail(dto.email) : null;
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

    const refreshToken = this.authTokenService.createRefreshTokenMaterial(new Date());
    const accessToken = await this.authTokenService.signAccessToken(user);

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

    const refreshToken = this.authTokenService.createRefreshTokenMaterial(now);
    const accessToken = await this.authTokenService.signAccessToken(existingToken.user);

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

  async forgotPassword(dto: ForgotPasswordDto, context: RequestContext = {}) {
    const user = await this.findUserByIdentifier(dto.identifier);

    if (
      !user ||
      user.deletedAt ||
      user.status !== UserStatus.ACTIVE ||
      !matchesPasswordResetIdentity(user, dto)
    ) {
      throwInvalidRecoveryInfo();
    }

    const now = new Date();
    const resetToken = this.authTokenService.createPasswordResetTokenMaterial(now);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      }),
      this.prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: resetToken.tokenHash,
          expiresAt: resetToken.expiresAt,
          requestIp: context.ipAddress,
          userAgent: context.userAgent,
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "AUTH_PASSWORD_RESET_REQUESTED",
          entityType: "User",
          entityId: user.id,
          metadata: {
            deliveryChannel: "inline",
          },
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      }),
    ]);

    return { success: true, resetToken: resetToken.rawToken };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const now = new Date();
    const tokenHash = hashPasswordResetToken(dto.token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: authUserSelect,
        },
      },
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.revokedAt ||
      resetToken.user.deletedAt
    ) {
      throwInvalidResetToken();
    }

    if (resetToken.expiresAt <= now) {
      throwResetTokenExpired();
    }

    assertActiveUser(resetToken.user);

    const passwordHash = await hashPassword(dto.newPassword);

    await this.prisma.$transaction(async (tx) => {
      const consumeResult = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          revokedAt: null,
          expiresAt: {
            gt: now,
          },
        },
        data: {
          usedAt: now,
        },
      });

      if (consumeResult.count !== 1) {
        throwInvalidResetToken();
      }

      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      });

      await tx.refreshToken.updateMany({
        where: {
          userId: resetToken.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      await tx.passwordResetToken.updateMany({
        where: {
          userId: resetToken.userId,
          id: {
            not: resetToken.id,
          },
          usedAt: null,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: resetToken.userId,
          action: "AUTH_PASSWORD_RESET_COMPLETED",
          entityType: "User",
          entityId: resetToken.userId,
        },
      });
    });

    return { success: true };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: currentUserSelect,
    });

    if (!user || user.deletedAt) {
      throwInvalidAccessToken();
    }

    assertActiveUser(user);

    return serializeCurrentUser(user);
  }

  async updateStudentProfile(userId: string, dto: UpdateStudentProfileDto) {
    const profileData: Prisma.StudentProfileUpdateInput = {};
    const userData: Prisma.UserUpdateInput = {};
    const changedFields: string[] = [];

    if (dto.displayName !== undefined) {
      profileData.displayName = normalizeName(dto.displayName);
      changedFields.push("displayName");
    }

    if (dto.address !== undefined) {
      profileData.address = normalizeNullableText(dto.address);
      changedFields.push("address");
    }

    if (dto.avatarFileId !== undefined) {
      await this.assertAvatarFileAllowed(userId, dto.avatarFileId);
      userData.avatarFile = {
        connect: {
          id: dto.avatarFileId,
        },
      };
      changedFields.push("avatarFileId");
    }

    if (changedFields.length === 0) {
      throwBadRequest("VALIDATION_ERROR", "Cần cung cấp ít nhất một trường để cập nhật");
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          status: true,
          deletedAt: true,
          studentProfile: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!existingUser || existingUser.deletedAt) {
        throwInvalidAccessToken();
      }

      assertActiveUser(existingUser);

      if (existingUser.role !== UserRole.STUDENT) {
        throwForbidden("FORBIDDEN", "Chỉ học sinh được cập nhật hồ sơ học sinh");
      }

      if (!existingUser.studentProfile) {
        throwNotFound("NOT_FOUND", "Không tìm thấy hồ sơ học sinh");
      }

      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: userData,
        });
      }

      if (Object.keys(profileData).length > 0) {
        await tx.studentProfile.update({
          where: { userId },
          data: profileData,
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: "STUDENT_PROFILE_UPDATED",
          entityType: "StudentProfile",
          entityId: existingUser.studentProfile.id,
          metadata: {
            changedFields,
          },
        },
      });

      return tx.user.findUnique({
        where: { id: userId },
        select: currentUserSelect,
      });
    });

    if (!user || user.deletedAt) {
      throwInvalidAccessToken();
    }

    return serializeCurrentUser(user);
  }

  private async createStudentWithProfile(data: {
    email: string | null;
    phone: string | null;
    username: string;
    passwordHash: string;
    fullName: string;
    gender: Gender;
    dateOfBirth: Date;
    grade: number;
    address: string;
  }) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await assertUniqueIdentity(tx, {
          email: data.email ?? undefined,
          phone: data.phone ?? undefined,
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
                address: data.address,
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
    email: string | null;
    phone: string;
    passwordHash: string;
    fullName: string;
  }) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await assertUniqueIdentity(tx, {
          email: data.email ?? undefined,
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

  private async assertAvatarFileAllowed(userId: string, avatarFileId: string) {
    const file = await this.prisma.file.findFirst({
      where: {
        id: avatarFileId,
        purpose: FilePurpose.AVATAR,
        status: {
          in: [FileStatus.UPLOADED, FileStatus.READY],
        },
        deletedAt: null,
        OR: [{ uploadedById: userId }, { uploadedById: null }],
      },
      select: {
        id: true,
      },
    });

    if (!file) {
      throwNotFound("NOT_FOUND", "Không tìm thấy avatar hợp lệ");
    }
  }

  private async sendPasswordResetEmail(
    user: Pick<AuthUser, "email" | "fullName">,
    rawToken: string,
  ) {
    if (!user.email || !this.resendApiKey || !this.resendFromEmail) {
      return;
    }

    const resetUrl = new URL("/reset-password", this.webUrl);
    resetUrl.searchParams.set("token", rawToken);

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.resendFromEmail,
          to: [user.email],
          subject: "Đặt lại mật khẩu",
          text: [
            `Xin chào ${user.fullName ?? ""}`.trim(),
            "Bạn vừa yêu cầu đặt lại mật khẩu.",
            `Mở liên kết này để đặt mật khẩu mới: ${resetUrl.toString()}`,
            "Liên kết hết hạn sau 15 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.",
          ].join("\n\n"),
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          `Password reset email delivery failed with status ${response.status}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      this.logger.warn(`Password reset email delivery failed: ${message}`);
    }
  }
}
