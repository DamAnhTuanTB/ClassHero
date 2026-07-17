import { apiRequest } from "@/lib/api-client";
import type {
  AuthTokenResponse,
  CurrentUserResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LogoutRequest,
  RegisterParentRequest,
  RegisterParentResponse,
  RegisterStudentRequest,
  RegisterStudentResponse,
  ResetPasswordRequest,
  SuccessResponse,
} from "@/features/auth/types/auth-api-types";

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
