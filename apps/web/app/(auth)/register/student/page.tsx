import type { Metadata } from "next";
import { StudentRegisterForm } from "@/features/auth/screens/student-register";

export const metadata: Metadata = {
  title: "Đăng ký học sinh | Hệ thống học theo lộ trình",
  description: "Tạo tài khoản học sinh để bắt đầu học theo lộ trình.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function StudentRegisterPage() {
  return <StudentRegisterForm />;
}
