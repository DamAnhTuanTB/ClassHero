"use client";

import { Home, RotateCcw } from "lucide-react";
import Link from "next/link";
import { StudentFullScreenState } from "@/components/student/student-full-screen-state";

export default function StudentErrorPage({ reset }: { reset: () => void }) {
  return (
    <StudentFullScreenState
      title="Chưa thể mở trang này"
      description="ClassHero đang gặp sự cố tạm thời. Bạn có thể thử lại hoặc quay về Trang chủ."
      action={
        <div className="grid w-full gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={reset}
            className="student-learn-cta-3d inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-sky-500 px-5 text-sm font-black text-white transition hover:bg-sky-600"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Thử lại
          </button>
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
