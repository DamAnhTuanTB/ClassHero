import { StudentDataErrorState } from "@/components/student/student-data-error-state";

export default function StudentUnknownPage() {
  return (
    <StudentDataErrorState
      title="Trang này không hợp lệ"
      description="Đường dẫn bạn vừa mở không tồn tại hoặc đã được thay đổi."
      primaryAction={{
        href: "/student/courses",
        icon: "book",
        label: "Về khóa học của tôi",
      }}
      secondaryAction={{
        href: "/student/explore",
        icon: "home",
        label: "Về Trang chủ",
        tone: "secondary",
      }}
    />
  );
}
