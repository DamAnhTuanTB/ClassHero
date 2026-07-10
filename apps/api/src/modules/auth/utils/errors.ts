import { UserStatus } from "@prisma/client";
import {
  getPrismaUniqueTarget,
  isPrismaUniqueConstraintError,
} from "#api/common/errors/prisma-error.mapper";
import {
  throwBadRequest,
  throwConflict,
  throwForbidden,
  throwUnauthorized,
} from "#api/common/errors/api-exception";

export function assertActiveUser(user: Pick<{ status: UserStatus }, "status">) {
  if (user.status !== UserStatus.ACTIVE) {
    throwForbidden("FORBIDDEN", "Tài khoản không hoạt động");
  }
}

export function throwInvalidCredentials(): never {
  throwUnauthorized("INVALID_CREDENTIALS", "Thông tin đăng nhập không đúng");
}

export function throwInvalidRefreshToken(): never {
  throwUnauthorized("UNAUTHORIZED", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn");
}

export function throwInvalidAccessToken(): never {
  throwUnauthorized("UNAUTHORIZED", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn");
}

export function throwInvalidResetToken(): never {
  throwBadRequest("INVALID_RESET_TOKEN", "Token đặt lại mật khẩu không hợp lệ");
}

export function throwInvalidRecoveryInfo(): never {
  throwBadRequest("INVALID_RECOVERY_INFO", "Thông tin khôi phục chưa chính xác");
}

export function throwResetTokenExpired(): never {
  throwBadRequest("RESET_TOKEN_EXPIRED", "Token đặt lại mật khẩu đã hết hạn");
}

export function throwDuplicate(code: string, message: string): never {
  throwConflict(code, message);
}

export function handleUniqueConstraintError(error: unknown) {
  if (!isPrismaUniqueConstraintError(error)) {
    return;
  }

  const target = getPrismaUniqueTarget(error);

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
