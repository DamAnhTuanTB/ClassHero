import type { Metadata } from "next";
import { ResetPasswordForm } from "@/features/auth/screens/reset-password";

export const metadata: Metadata = {
  title: "Đặt lại mật khẩu | Hệ thống khóa học",
  description: "Đặt lại mật khẩu bằng mã khôi phục.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
