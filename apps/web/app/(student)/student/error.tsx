"use client";

import { StudentDataErrorState } from "@/components/student/student-data-error-state";

export default function StudentErrorPage({ reset }: { reset: () => void }) {
  return (
    <StudentDataErrorState
      title="Chưa thể mở trang này"
      description="ClassHero đang gặp sự cố tạm thời. Bạn có thể thử lại hoặc quay về Trang chủ."
      primaryAction={{ icon: "retry", label: "Thử lại", onClick: reset }}
      secondaryAction={{
        href: "/student/explore",
        icon: "home",
        label: "Về Trang chủ",
        tone: "secondary",
      }}
    />
  );
}
