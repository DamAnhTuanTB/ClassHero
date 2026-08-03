import { BookOpen, Home } from "lucide-react";
import Link from "next/link";
import { StudentFullScreenState } from "@/components/student/student-full-screen-state";

export default function StudentUnknownPage() {
  return (
    <StudentFullScreenState
      title="Trang này không hợp lệ"
      description="Đường dẫn bạn vừa mở không tồn tại hoặc đã được thay đổi."
      action={
        <div className="grid w-full gap-3 sm:grid-cols-2">
          <Link
            href="/student/courses"
            className="student-learn-cta-3d inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-sky-500 px-5 text-sm font-black text-white transition hover:bg-sky-600"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Về khóa học của tôi
          </Link>
          <Link
            href="/student/explore"
            className="student-learn-cta-3d-emerald inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-500 px-5 text-sm font-black text-white transition hover:bg-emerald-400"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Về Trang chủ
          </Link>
        </div>
      }
    />
  );
}
