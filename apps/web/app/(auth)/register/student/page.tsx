import type { Metadata } from "next";
import { StudentRegisterForm } from "@/features/auth/screens/student-register";

export const metadata: Metadata = {
  title: "Đăng ký học sinh | Hệ thống khóa học",
  description: "Tạo tài khoản học sinh để bắt đầu học với khóa học phù hợp.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function StudentRegisterPage() {
  return <StudentRegisterForm />;
}
