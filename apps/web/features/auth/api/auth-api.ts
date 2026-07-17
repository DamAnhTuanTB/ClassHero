import { ApiRequestError, apiRequest } from "@/lib/api-client";

export type AuthRole = "ADMIN" | "STUDENT" | "PARENT";
export type AuthGender = "MALE" | "FEMALE" | "OTHER";

export type AuthUser = {
  id: string;
  role: AuthRole;
  email: string | null;
  phone: string | null;
  username: string | null;
  fullName?: string | null;
};

export type AuthTokenResponse = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type CurrentUserResponse = {
  user: AuthUser;
  studentProfile: {
    id: string;
    grade: number;
    childCode: string;
    address: string | null;
    displayName: string | null;
    totalXp: number;
    level: number;
  } | null;
  parentProfile: unknown | null;
};

export type RegisterStudentResponse = {
  user: AuthUser;
  studentProfile: {
    grade: number;
    childCode: string;
  };
};

export type RegisterParentResponse = {
  user: AuthUser;
};

export type SuccessResponse = {
  success: boolean;
};

export type ForgotPasswordResponse = {
  success: boolean;
  resetToken: string;
};

export type LoginRequest = {
  identifier: string;
  password: string;
};

export type RegisterStudentRequest = {
  phone?: string;
  username: string;
  password: string;
  fullName: string;
  grade: number;
  gender: AuthGender;
  birthYear: number;
  address: string;
};

export type RegisterParentRequest = {
  phone: string;
  password: string;
  fullName: string;
};

export type ForgotPasswordRequest = {
  identifier: string;
  fullName: string;
  grade: number;
};

export type ResetPasswordRequest = {
  token: string;
  newPassword: string;
};

export type LogoutRequest = {
  refreshToken: string;
};

export function login(request: LoginRequest) {
  return apiRequest<AuthTokenResponse>("/auth/login", {
    method: "POST",
    body: request,
  });
}

export function registerStudent(request: RegisterStudentRequest) {
  return apiRequest<RegisterStudentResponse>("/auth/register/student", {
    method: "POST",
    body: request,
  });
}

export function registerParent(request: RegisterParentRequest) {
  return apiRequest<RegisterParentResponse>("/auth/register/parent", {
    method: "POST",
    body: request,
  });
}

export function forgotPassword(request: ForgotPasswordRequest) {
  return apiRequest<ForgotPasswordResponse>("/auth/forgot-password", {
    method: "POST",
    body: request,
  });
}

export function resetPassword(request: ResetPasswordRequest) {
  return apiRequest<SuccessResponse>("/auth/reset-password", {
    method: "POST",
    body: request,
  });
}

export function logout(request: LogoutRequest, token?: string) {
  return apiRequest<SuccessResponse>("/auth/logout", {
    method: "POST",
    token,
    body: request,
  });
}

export function getCurrentUser(token: string) {
  return apiRequest<CurrentUserResponse>("/me", {
    token,
  });
}

export function getAuthErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiRequestError)) {
    return fallback;
  }

  switch (error.code) {
    case "INVALID_CREDENTIALS":
      return "Tên đăng nhập/SĐT hoặc mật khẩu chưa đúng.";
    case "DUPLICATE_EMAIL":
      return "Email này đã được sử dụng.";
    case "DUPLICATE_PHONE":
      return "Số điện thoại này đã được sử dụng.";
    case "DUPLICATE_USERNAME":
      return "Tên đăng nhập này đã được sử dụng.";
    case "INVALID_RESET_TOKEN":
      return "Mã đặt lại mật khẩu chưa hợp lệ hoặc đã được sử dụng.";
    case "RESET_TOKEN_EXPIRED":
      return "Mã đặt lại mật khẩu đã hết hạn.";
    case "INVALID_RECOVERY_INFO":
      return "Thông tin khôi phục chưa khớp. Vui lòng kiểm tra lại.";
    case "VALIDATION_ERROR":
      return "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các ô nhập.";
    default:
      return error.message || fallback;
  }
}
