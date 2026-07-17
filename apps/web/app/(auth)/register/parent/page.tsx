import type { Metadata } from "next";
import { ParentRegisterForm } from "@/features/auth/screens/parent-register";

export const metadata: Metadata = {
  title: "Đăng ký phụ huynh | Hệ thống khóa học",
  description: "Tạo tài khoản phụ huynh để theo dõi việc học của con.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ParentRegisterPage() {
  return <ParentRegisterForm />;
}
