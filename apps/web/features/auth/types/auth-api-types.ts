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
