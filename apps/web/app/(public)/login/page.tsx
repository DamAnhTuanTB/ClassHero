import type { Metadata } from "next";
import { LoginForm } from "../../../features/auth/auth-forms";
import { AuthPageShell } from "../../../features/auth/auth-page-shell";

export const metadata: Metadata = {
  title: "Đăng nhập | Hệ thống học theo lộ trình",
  description: "Đăng nhập cho học sinh, phụ huynh và admin.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginPage() {
  return (
    <AuthPageShell variant="login">
      <LoginForm />
    </AuthPageShell>
  );
}
