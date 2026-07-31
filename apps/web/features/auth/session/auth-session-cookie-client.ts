"use client";

import { serverAuthSessionMarkerCookieName } from "@/features/auth/session/auth-session-cookie";

const serverAuthSessionEndpoint = "/api/auth/session";

export async function persistServerAuthSessionCookie(accessToken: string) {
  const response = await fetch(serverAuthSessionEndpoint, {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ accessToken }),
  });

  if (!response.ok) {
    throw new Error("Không thể đồng bộ phiên đăng nhập với máy chủ web.");
  }
}

export async function clearServerAuthSessionCookie() {
  await fetch(serverAuthSessionEndpoint, {
    method: "DELETE",
    cache: "no-store",
    credentials: "same-origin",
    keepalive: true,
  });
}

export function hasServerAuthSessionMarker() {
  if (typeof document === "undefined") {
    return false;
  }

  return document.cookie
    .split("; ")
    .some((cookie) => cookie.startsWith(`${serverAuthSessionMarkerCookieName}=`));
}
