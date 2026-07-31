import { cookies } from "next/headers";
import { cache } from "react";
import { serverAuthAccessTokenCookieName } from "@/features/auth/session/auth-session-cookie";
import type { AuthUser, CurrentUserResponse } from "@/features/auth/types/auth-api-types";
import { apiRequest } from "@/lib/api-client";

export type ServerAuthSession = {
  accessToken: string;
  currentUser: CurrentUserResponse;
};

const readServerAuthSession = cache(async (): Promise<ServerAuthSession | null> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(serverAuthAccessTokenCookieName)?.value;

  if (!accessToken) {
    return null;
  }

  try {
    const currentUser = await apiRequest<CurrentUserResponse>("/me", {
      cache: "no-store",
      token: accessToken,
    });

    return {
      accessToken,
      currentUser,
    };
  } catch {
    return null;
  }
});

export function getServerAuthSession() {
  return readServerAuthSession();
}

export async function getServerAuthUser(): Promise<AuthUser | null> {
  const session = await getServerAuthSession();

  return session?.currentUser.user ?? null;
}
