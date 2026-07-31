import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readAuthAccessTokenClaims } from "@/features/auth/session/auth-access-token";
import {
  serverAuthAccessTokenCookieName,
  serverAuthSessionMarkerCookieName,
} from "@/features/auth/session/auth-session-cookie";

const serverAuthSessionSchema = z.object({
  accessToken: z.string().min(1).max(8_192),
});

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return errorResponse(403, "FORBIDDEN", "Nguồn yêu cầu không hợp lệ.");
  }

  const parsedBody = serverAuthSessionSchema.safeParse(await readRequestJson(request));

  if (!parsedBody.success) {
    return errorResponse(400, "VALIDATION_ERROR", "Phiên đăng nhập chưa hợp lệ.");
  }

  const claims = readAuthAccessTokenClaims(parsedBody.data.accessToken);
  const nowMs = Date.now();

  if (!claims || claims.expiresAtMs <= nowMs) {
    return errorResponse(
      401,
      "UNAUTHORIZED",
      "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.",
    );
  }

  const maxAge = Math.max(1, Math.floor((claims.expiresAtMs - nowMs) / 1000));
  const response = NextResponse.json({ data: { success: true } });
  const sharedCookieOptions = {
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };

  response.cookies.set(serverAuthAccessTokenCookieName, parsedBody.data.accessToken, {
    ...sharedCookieOptions,
    httpOnly: true,
    priority: "high",
  });
  response.cookies.set(serverAuthSessionMarkerCookieName, "1", {
    ...sharedCookieOptions,
    httpOnly: false,
  });

  return response;
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return errorResponse(403, "FORBIDDEN", "Nguồn yêu cầu không hợp lệ.");
  }

  const response = NextResponse.json({ data: { success: true } });

  response.cookies.delete(serverAuthAccessTokenCookieName);
  response.cookies.delete(serverAuthSessionMarkerCookieName);

  return response;
}

async function readRequestJson(request: NextRequest) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}

function isSameOriginRequest(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  try {
    const originHost = new URL(origin).host;
    const requestHost =
      request.headers.get("x-forwarded-host") ?? request.headers.get("host");

    return Boolean(requestHost) && originHost === requestHost;
  } catch {
    return false;
  }
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details: [],
      },
    },
    { status },
  );
}
