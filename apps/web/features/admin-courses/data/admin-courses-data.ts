export type AdminSubject = "MATH" | "PHYSICS" | "CHEMISTRY";
export type AdminPublishStatus = "DRAFT" | "PUBLISHED" | "HIDDEN" | "ARCHIVED";

export type AdminLesson = {
  id: string;
  orderIndex: number;
  title: string;
  shortDescription: string;
  scheduledAt: string;
  examOpenAt: string;
  videoUrl: string;
  completionMinScore: number;
  status: AdminPublishStatus;
};

export type AdminLearningPath = {
  id: string;
  title: string;
  slug: string;
  subject: AdminSubject;
  grade: number;
  originalPriceVnd: number;
  salePriceVnd: number | null;
  totalLessonCount: number;
  status: AdminPublishStatus;
  trialEnabled: boolean;
  sortOrder: number;
  updatedAt: string;
  lessons: AdminLesson[];
};

export const subjectLabels: Record<AdminSubject, string> = {
  MATH: "Toán",
  PHYSICS: "Lý",
  CHEMISTRY: "Hóa",
};

export const statusLabels: Record<AdminPublishStatus, string> = {
  DRAFT: "Nháp",
  PUBLISHED: "Đang mở",
  HIDDEN: "Đã ẩn",
  ARCHIVED: "Lưu trữ",
};

export const statusStyles: Record<AdminPublishStatus, string> = {
  DRAFT: "border-slate-200 bg-slate-100 text-slate-700",
  PUBLISHED: "border-emerald-200 bg-emerald-50 text-emerald-700",
  HIDDEN: "border-amber-200 bg-amber-50 text-amber-700",
  ARCHIVED: "border-rose-200 bg-rose-50 text-rose-700",
};

export const adminSubjects = Object.keys(subjectLabels) as AdminSubject[];
export const adminStatuses = Object.keys(statusLabels) as AdminPublishStatus[];
export const adminGrades = Array.from({ length: 10 }, (_, index) => index + 3);

export const adminLearningPaths: AdminLearningPath[] = [
  {
    id: "path-math-7",
    title: "Toán 7 nền tảng",
    slug: "toan-7-nen-tang",
    subject: "MATH",
    grade: 7,
    originalPriceVnd: 2_000_000,
    salePriceVnd: 1_500_000,
    totalLessonCount: 4,
    status: "PUBLISHED",
    trialEnabled: true,
    sortOrder: 1,
    updatedAt: "2026-07-10T09:30:00.000Z",
    lessons: [
      {
        id: "lesson-math-7-1",
        orderIndex: 1,
        title: "Buổi 1: Số hữu tỉ",
        shortDescription: "Ôn tập số hữu tỉ, thứ tự và phép tính cơ bản.",
        scheduledAt: "2026-08-01T12:00",
        examOpenAt: "2026-08-01T13:00",
        videoUrl: "https://youtube.com/watch?v=toan7-01",
        completionMinScore: 7,
        status: "PUBLISHED",
      },
      {
        id: "lesson-math-7-2",
        orderIndex: 2,
        title: "Buổi 2: Lũy thừa",
        shortDescription: "Lũy thừa với số mũ tự nhiên và bài tập vận dụng.",
        scheduledAt: "2026-08-05T12:00",
        examOpenAt: "2026-08-05T13:00",
        videoUrl: "https://drive.google.com/file/d/toan7-02/view",
        completionMinScore: 7,
        status: "DRAFT",
      },
    ],
  },
  {
    id: "path-physics-8",
    title: "Vật lý 8 tăng tốc",
    slug: "vat-ly-8-tang-toc",
    subject: "PHYSICS",
    grade: 8,
    originalPriceVnd: 1_800_000,
    salePriceVnd: null,
    totalLessonCount: 3,
    status: "DRAFT",
    trialEnabled: true,
    sortOrder: 2,
    updatedAt: "2026-07-09T15:10:00.000Z",
    lessons: [
      {
        id: "lesson-physics-8-1",
        orderIndex: 1,
        title: "Buổi 1: Chuyển động cơ học",
        shortDescription: "Khái niệm chuyển động, vận tốc và bài tập đọc đồ thị.",
        scheduledAt: "2026-08-03T12:00",
        examOpenAt: "2026-08-03T13:00",
        videoUrl: "https://youtube.com/watch?v=ly8-01",
        completionMinScore: 7,
        status: "DRAFT",
      },
    ],
  },
  {
    id: "path-chemistry-9",
    title: "Hóa 9 ôn thi",
    slug: "hoa-9-on-thi",
    subject: "CHEMISTRY",
    grade: 9,
    originalPriceVnd: 2_200_000,
    salePriceVnd: 1_850_000,
    totalLessonCount: 5,
    status: "HIDDEN",
    trialEnabled: false,
    sortOrder: 3,
    updatedAt: "2026-07-08T10:00:00.000Z",
    lessons: [
      {
        id: "lesson-chemistry-9-1",
        orderIndex: 1,
        title: "Buổi 1: Oxit",
        shortDescription: "Phân loại oxit, tính chất hóa học và bài tập nhận biết.",
        scheduledAt: "2026-08-07T12:00",
        examOpenAt: "2026-08-07T13:00",
        videoUrl: "https://youtube.com/watch?v=hoa9-01",
        completionMinScore: 7,
        status: "HIDDEN",
      },
    ],
  },
];
