import { Prisma, UserRole } from "@prisma/client";
import {
  authUserSelect,
  currentUserSelect,
} from "#api/modules/auth/selectors/user.selects";

export type AuthUser = Prisma.UserGetPayload<{ select: typeof authUserSelect }>;
export type CurrentUser = Prisma.UserGetPayload<{ select: typeof currentUserSelect }>;

export type UserResponse = {
  id: string;
  role: UserRole;
  email: string | null;
  phone: string | null;
  username: string | null;
  fullName: string | null;
};

export type RefreshTokenMaterial = {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
};

export type RequestContext = {
  ipAddress?: string;
  userAgent?: string;
};
