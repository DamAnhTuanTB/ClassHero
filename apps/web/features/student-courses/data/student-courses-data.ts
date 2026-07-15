import type {
  StudentCourse,
  StudentCourseStat,
  StudentCourseSubject,
} from "@/features/student-courses/types";

export const studentProfile = {
  avatarLabel: "MA",
  grade: 7,
  name: "Minh Anh",
};

export const gradeOptions = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const subjectOptions: Array<{
  label: string;
  value: StudentCourseSubject | "ALL";
}> = [
  { label: "Tất cả", value: "ALL" },
  { label: "Toán", value: "MATH" },
  { label: "Lý", value: "PHYSICS" },
  { label: "Hóa", value: "CHEMISTRY" },
];

export const studentCourses: StudentCourse[] = [
  {
    access: "enrolled",
    chapterCount: 2,
    description:
      "Nền tảng vững chắc, bứt phá điểm số cùng lộ trình chuẩn SGK mới.",
    exerciseCount: 96,
    grade: 7,
    id: "course-math-7-foundation",
    lessonCount: 24,
    nextLesson: {
      examOpenLabel: "Mở bài kiểm tra lúc 19:30",
      id: "lesson-math-7-ratio",
      title: "Buổi 5: Tỉ lệ thức",
    },
    originalPriceVnd: 2_000_000,
    progressPercent: 42,
    salePriceVnd: 1_500_000,
    slug: "toan-7-nen-tang",
    subject: "MATH",
    title: "Toán 7 nền tảng",
    tone: "math",
    updatedLabel: "Hôm nay",
  },
  {
    access: "enrolled",
    chapterCount: 3,
    description:
      "Luyện tư duy giải bài khó theo chuyên đề, phù hợp học sinh muốn tăng tốc.",
    exerciseCount: 118,
    grade: 7,
    id: "course-math-7-advanced",
    lessonCount: 28,
    nextLesson: {
      id: "lesson-math-7-functions",
      title: "Buổi 2: Hàm số",
    },
    originalPriceVnd: 1_900_000,
    progressPercent: 18,
    salePriceVnd: 1_650_000,
    slug: "toan-7-nang-cao",
    subject: "MATH",
    title: "Toán 7 nâng cao",
    tone: "math",
    updatedLabel: "Mới học",
  },
  {
    access: "expiring",
    chapterCount: 3,
    description:
      "Khám phá thế giới vật lý qua thí nghiệm thực tế và bài giảng trực quan.",
    exerciseCount: 72,
    expiresInDays: 12,
    grade: 8,
    id: "course-physics-8-intro",
    lessonCount: 18,
    nextLesson: {
      id: "lesson-physics-8-force",
      title: "Buổi 7: Lực ma sát",
    },
    originalPriceVnd: 1_800_000,
    progressPercent: 64,
    salePriceVnd: 1_450_000,
    slug: "vat-ly-8-nhap-mon",
    subject: "PHYSICS",
    title: "Vật lý 8 nhập môn",
    tone: "physics",
    updatedLabel: "Còn 12 ngày",
  },
  {
    access: "locked",
    chapterCount: 3,
    description:
      "Mở rộng kỹ năng giải toán lớp 7 bằng hệ thống bài tập chọn lọc.",
    exerciseCount: 84,
    grade: 7,
    id: "course-math-7-speed",
    lessonCount: 20,
    originalPriceVnd: 1_850_000,
    salePriceVnd: 1_650_000,
    slug: "toan-7-tang-toc",
    subject: "MATH",
    title: "Toán 7 tăng tốc",
    tone: "math",
    trialLessonCount: 2,
  },
  {
    access: "trial",
    chapterCount: 3,
    description:
      "Làm quen chuyển động, lực và các hiện tượng vật lý qua ví dụ gần gũi.",
    exerciseCount: 72,
    grade: 8,
    id: "course-physics-8-trial",
    lessonCount: 18,
    nextLesson: {
      id: "lesson-physics-8-motion",
      title: "Buổi 1: Chuyển động cơ học",
    },
    originalPriceVnd: 1_800_000,
    salePriceVnd: 1_450_000,
    slug: "vat-ly-8-nhap-mon-trial",
    subject: "PHYSICS",
    title: "Vật lý 8 nhập môn",
    tone: "physics",
    trialLessonCount: 2,
  },
  {
    access: "locked",
    chapterCount: 4,
    description:
      "Lộ trình ôn thi vào 10 hiệu quả, hệ thống hóa kiến thức trọng tâm.",
    exerciseCount: 128,
    grade: 9,
    id: "course-chemistry-9-exam",
    lessonCount: 32,
    originalPriceVnd: 2_200_000,
    salePriceVnd: 1_850_000,
    slug: "hoa-9-on-thi",
    subject: "CHEMISTRY",
    title: "Hóa 9 ôn thi",
    tone: "chemistry",
    trialLessonCount: 2,
  },
];

export const purchasedStats: StudentCourseStat[] = [
  { label: "đang học", value: "2" },
  { label: "tiến độ", value: "42%" },
  { label: "buổi hôm nay", value: "1" },
];
