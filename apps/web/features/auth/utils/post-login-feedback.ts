import type { AuthRole } from "@/features/auth/api/auth-api";

type PostLoginToast = {
  title: string;
  description: string;
};

export function getPostLoginSuccessToast(role: AuthRole): PostLoginToast {
  switch (role) {
    case "ADMIN":
      return {
        title: "Đăng nhập admin thành công",
        description: "Chào mừng admin quay lại trang quản lý ClassHero.",
      };
    case "PARENT":
      return {
        title: "Đăng nhập phụ huynh thành công",
        description: "Chào mừng phụ huynh quay lại ClassHero.",
      };
    case "STUDENT":
    default:
      return {
        title: "Đăng nhập học sinh thành công",
        description: "Chào mừng em quay lại lớp học ClassHero.",
      };
  }
}
