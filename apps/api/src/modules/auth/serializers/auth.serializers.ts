import { UserRole } from "@prisma/client";
import { ForgotPasswordDto } from "#api/modules/auth/dto/forgot-password.dto";
import { normalizeNameForIdentityMatch } from "#api/modules/auth/utils/normalizers";
import type {
  AuthUser,
  CurrentUser,
  UserResponse,
} from "#api/modules/auth/types/auth.types";

export function serializeUser(user: Pick<AuthUser, keyof UserResponse>): UserResponse {
  return {
    id: user.id,
    role: user.role,
    email: user.email,
    phone: user.phone,
    username: user.username,
    fullName: user.fullName,
  };
}

export function matchesPasswordResetIdentity(user: AuthUser, dto: ForgotPasswordDto) {
  if (
    normalizeNameForIdentityMatch(user.fullName ?? "") !==
    normalizeNameForIdentityMatch(dto.fullName)
  ) {
    return false;
  }

  if (user.role !== UserRole.STUDENT || user.studentProfile?.grade !== dto.grade) {
    return false;
  }

  return true;
}

export function serializeCurrentUser(user: CurrentUser) {
  return {
    user: {
      id: user.id,
      role: user.role,
      status: user.status,
      email: user.email,
      phone: user.phone,
      username: user.username,
      fullName: user.fullName,
      gender: user.gender,
      dateOfBirth: formatDateOnly(user.dateOfBirth),
      avatarFileId: user.avatarFileId,
      lastLoginAt: formatDateTime(user.lastLoginAt),
      emailVerifiedAt: formatDateTime(user.emailVerifiedAt),
      phoneVerifiedAt: formatDateTime(user.phoneVerifiedAt),
      createdAt: user.createdAt.toISOString(),
    },
    studentProfile: user.studentProfile
      ? {
          id: user.studentProfile.id,
          grade: user.studentProfile.grade,
          childCode: user.studentProfile.childCode,
          address: user.studentProfile.address,
          displayName: user.studentProfile.displayName,
          totalXp: user.studentProfile.totalXp,
          level: user.studentProfile.level,
        }
      : null,
    parentProfile: user.parentProfile
      ? {
          id: user.parentProfile.id,
        }
      : null,
  };
}

function formatDateOnly(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function formatDateTime(value: Date | null) {
  return value ? value.toISOString() : null;
}
