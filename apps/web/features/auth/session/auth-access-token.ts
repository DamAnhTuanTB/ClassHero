import type { AuthRole } from "@/features/auth/types/auth-api-types";

export type AuthAccessTokenClaims = {
  expiresAtMs: number;
  role: AuthRole;
  subject: string;
  tokenType: "access";
};

export function readAuthAccessTokenClaims(
  token: string | null | undefined,
): AuthAccessTokenClaims | null {
  const payload = readAccessTokenPayload(token);

  if (
    !payload ||
    typeof payload.exp !== "number" ||
    !Number.isFinite(payload.exp) ||
    typeof payload.sub !== "string" ||
    !isAuthRole(payload.role) ||
    payload.tokenType !== "access"
  ) {
    return null;
  }

  return {
    expiresAtMs: payload.exp * 1000,
    role: payload.role,
    subject: payload.sub,
    tokenType: "access",
  };
}

export function readAuthAccessTokenExpiresAtMs(
  token: string | null | undefined,
): number | null {
  const payload = readAccessTokenPayload(token);

  return payload && typeof payload.exp === "number" && Number.isFinite(payload.exp)
    ? payload.exp * 1000
    : null;
}

function readAccessTokenPayload(token: string | null | undefined) {
  const encodedPayload = token?.split(".")[1];

  if (!encodedPayload) {
    return null;
  }

  try {
    const normalizedPayload = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = normalizedPayload.padEnd(
      Math.ceil(normalizedPayload.length / 4) * 4,
      "=",
    );

    return JSON.parse(globalThis.atob(paddedPayload)) as Partial<{
      exp: unknown;
      role: unknown;
      sub: unknown;
      tokenType: unknown;
    }>;
  } catch {
    return null;
  }
}

function isAuthRole(value: unknown): value is AuthRole {
  return value === "ADMIN" || value === "STUDENT" || value === "PARENT";
}
