"use client";

import { ApiRequestError } from "@/lib/api-client";

export type AuthSessionErrorReason = "expired-session" | "forbidden";

export function getAuthSessionErrorReason(
  error: unknown,
): AuthSessionErrorReason | null {
  if (!(error instanceof ApiRequestError)) {
    return null;
  }

  if (error.statusCode === 401 && error.code !== "INVALID_CREDENTIALS") {
    return "expired-session";
  }

  if (error.statusCode === 403) {
    return "forbidden";
  }

  return null;
}

export function isAuthSessionError(error: unknown) {
  return getAuthSessionErrorReason(error) !== null;
}
