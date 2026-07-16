import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/features/auth/screens/forgot-password";

export const metadata: Metadata = {
  title: "Quên mật khẩu | Hệ thống học theo lộ trình",
  description: "Nhận hướng dẫn đặt lại mật khẩu tài khoản.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
