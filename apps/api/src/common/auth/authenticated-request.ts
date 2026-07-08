import { UserRole } from "@prisma/client";

export type AuthenticatedUser = {
  id: string;
  role: UserRole;
};

export type AuthenticatedRequest = {
  headers: {
    authorization?: string | string[];
  };
  user?: AuthenticatedUser;
  ip?: string;
  get?: (headerName: string) => string | undefined;
};
