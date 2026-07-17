import type { AuthRole } from "@/features/auth/types/auth-api-types";

export function getPostLoginRedirectPath(role: AuthRole) {
  switch (role) {
    case "ADMIN":
      return "/admin/courses";
    case "PARENT":
      return "/";
    case "STUDENT":
      return "/student/courses";
  }
}
