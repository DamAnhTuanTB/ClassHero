import type { AuthRole } from "@/features/auth/api/auth-api";

export function getPostLoginRedirectPath(role: AuthRole) {
  switch (role) {
    case "ADMIN":
      return "/admin/courses";
    case "PARENT":
    case "STUDENT":
    default:
      return "/";
  }
}
