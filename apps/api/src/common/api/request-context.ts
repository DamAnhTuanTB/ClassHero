import type { AuthenticatedRequest } from "#api/common/auth/authenticated-request";

export function getRequestContext(request: AuthenticatedRequest) {
  return {
    ipAddress: request.ip,
    userAgent: request.get?.("user-agent"),
  };
}
