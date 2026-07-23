export type AdminSubject = "MATH" | "PHYSICS" | "CHEMISTRY";
export type AdminPublishStatus = "DRAFT" | "PUBLISHED" | "HIDDEN" | "ARCHIVED";
export type AdminEditableStatus = Exclude<AdminPublishStatus, "ARCHIVED">;

export type AdminLesson = {
  id: string;
  chapterId?: string;
  orderIndex: number;
  title: string;
  shortDescription: string;
  scheduledAt: string;
  examOpenAt: string;
  videoUrl: string;
  completionMinScore: number;
  trialEnabled: boolean;
  status: AdminPublishStatus;
};

export type AdminChapter = {
  id: string;
  orderIndex: number;
  title: string;
  overview: string;
  objectives: string;
  status: AdminPublishStatus;
  lessons: AdminLesson[];
};

export type AdminLearningPath = {
  id: string;
  title: string;
  slug: string;
  thumbnailFileId?: string | null;
  thumbnailFileName?: string;
  thumbnailImageUrl: string;
  description: string;
  subject: AdminSubject;
  grade: number;
  originalPriceVnd: number;
  salePriceVnd: number | null;
  enrolledStudentCount: number;
  totalChapterCount: number;
  totalLessonCount: number;
  status: AdminPublishStatus;
  sortOrder: number;
  updatedAt: string;
  chapters: AdminChapter[];
};

export const subjectLabels: Record<AdminSubject, string> = {
  MATH: "Toán",
  PHYSICS: "Lý",
  CHEMISTRY: "Hóa",
};

export const statusLabels: Record<AdminPublishStatus, string> = {
  DRAFT: "Nháp",
  PUBLISHED: "Phát hành",
  HIDDEN: "Chưa phát hành",
  ARCHIVED: "Lưu trữ",
};

export const statusStyles: Record<AdminPublishStatus, string> = {
  DRAFT:
    "border-[var(--theme-border)] bg-[var(--theme-surface-soft)] text-[var(--theme-text)]",
  PUBLISHED:
    "border-[var(--theme-success-border)] bg-[var(--theme-success-bg)] text-[var(--theme-success-text)]",
  HIDDEN:
    "border-[var(--theme-warning-border)] bg-[var(--theme-warning-bg)] text-[var(--theme-warning-text)]",
  ARCHIVED:
    "border-[var(--theme-danger-border)] bg-[var(--theme-danger-soft)] text-[var(--theme-danger)]",
};

export const adminSubjects = Object.keys(subjectLabels) as AdminSubject[];
export const adminStatuses: AdminEditableStatus[] = ["DRAFT", "PUBLISHED", "HIDDEN"];
export const adminGrades = Array.from({ length: 10 }, (_, index) => index + 3);

export const adminLearningPaths: AdminLearningPath[] = [
  {
    id: "path-math-7",
    title: "Toán 7 nền tảng",
    slug: "toan-7-nen-tang",
    thumbnailFileName: "",
    thumbnailImageUrl: "",
    description:
      "Khóa học củng cố nền tảng Toán 7 theo từng buổi học, giúp học sinh nắm chắc lý thuyết và luyện bài tập trọng tâm.",
    subject: "MATH",
    grade: 7,
    originalPriceVnd: 2_000_000,
    salePriceVnd: 1_500_000,
    enrolledStudentCount: 38,
    totalChapterCount: 2,
    totalLessonCount: 2,
    status: "PUBLISHED",
    sortOrder: 1,
    updatedAt: "2026-07-10T09:30:00.000Z",
    chapters: [
      {
        id: "chapter-math-7-1",
        orderIndex: 1,
        title: "Chương 1: Số hữu tỉ",
        overview: "Tổng quan số hữu tỉ, thứ tự và các phép tính nền tảng.",
        objectives:
          "Nhận biết số hữu tỉ; thực hiện phép tính cơ bản; đọc hiểu bài toán vận dụng.",
        status: "PUBLISHED",
        lessons: [
          {
            id: "lesson-math-7-1",
            orderIndex: 1,
            title: "Buổi học 1: Số hữu tỉ",
            shortDescription: "Ôn tập số hữu tỉ, thứ tự và phép tính cơ bản.",
            scheduledAt: "2026-08-01T12:00",
            examOpenAt: "2026-08-01T13:00",
            videoUrl: "https://youtube.com/watch?v=toan7-01",
            completionMinScore: 7,
            trialEnabled: true,
            status: "PUBLISHED",
          },
          {
            id: "lesson-math-7-2",
            orderIndex: 2,
            title: "Buổi học 2: Lũy thừa",
            shortDescription: "Lũy thừa với số mũ tự nhiên và bài tập vận dụng.",
            scheduledAt: "2026-08-05T12:00",
            examOpenAt: "2026-08-05T13:00",
            videoUrl: "https://drive.google.com/file/d/toan7-02/view",
            completionMinScore: 7,
            trialEnabled: false,
            status: "DRAFT",
          },
        ],
      },
      {
        id: "chapter-math-7-2",
        orderIndex: 2,
        title: "Chương 2: Biểu thức đại số",
        overview: "Chuẩn bị nền tảng biểu thức, giá trị biểu thức và quy tắc biến đổi.",
        objectives:
          "Nhận diện biểu thức đại số; thay giá trị biến; luyện bài tập rút gọn cơ bản.",
        status: "DRAFT",
        lessons: [],
      },
    ],
  },
  {
    id: "path-physics-8",
    title: "Vật lý 8 tăng tốc",
    slug: "vat-ly-8-tang-toc",
    thumbnailFileName: "",
    thumbnailImageUrl: "",
    description:
      "Chuỗi buổi học Vật lý 8 tập trung vào chuyển động, lực và các dạng bài vận dụng thường gặp.",
    subject: "PHYSICS",
    grade: 8,
    originalPriceVnd: 1_800_000,
    salePriceVnd: null,
    enrolledStudentCount: 24,
    totalChapterCount: 1,
    totalLessonCount: 1,
    status: "DRAFT",
    sortOrder: 2,
    updatedAt: "2026-07-09T15:10:00.000Z",
    chapters: [
      {
        id: "chapter-physics-8-1",
        orderIndex: 1,
        title: "Chương 1: Cơ học cơ bản",
        overview: "Khái quát chuyển động, vận tốc và các đại lượng cơ học mở đầu.",
        objectives:
          "Phân biệt chuyển động và đứng yên; tính vận tốc; đọc dữ liệu từ bảng và đồ thị.",
        status: "DRAFT",
        lessons: [
          {
            id: "lesson-physics-8-1",
            orderIndex: 1,
            title: "Buổi học 1: Chuyển động cơ học",
            shortDescription: "Khái niệm chuyển động, vận tốc và bài tập đọc đồ thị.",
            scheduledAt: "2026-08-03T12:00",
            examOpenAt: "2026-08-03T13:00",
            videoUrl: "https://youtube.com/watch?v=ly8-01",
            completionMinScore: 7,
            trialEnabled: true,
            status: "DRAFT",
          },
        ],
      },
    ],
  },
  {
    id: "path-chemistry-9",
    title: "Hóa 9 ôn thi",
    slug: "hoa-9-on-thi",
    thumbnailFileName: "",
    thumbnailImageUrl: "",
    description:
      "Khóa học ôn tập Hóa 9 theo chuyên đề, kết hợp lý thuyết ngắn gọn và bài tập nhận biết.",
    subject: "CHEMISTRY",
    grade: 9,
    originalPriceVnd: 2_200_000,
    salePriceVnd: 1_850_000,
    enrolledStudentCount: 17,
    totalChapterCount: 1,
    totalLessonCount: 1,
    status: "HIDDEN",
    sortOrder: 3,
    updatedAt: "2026-07-08T10:00:00.000Z",
    chapters: [
      {
        id: "chapter-chemistry-9-1",
        orderIndex: 1,
        title: "Chương 1: Hợp chất vô cơ",
        overview: "Tổng quan oxit, axit, bazơ và muối trong chương trình Hóa 9.",
        objectives:
          "Phân loại hợp chất; nhận biết tính chất hóa học; luyện bài tập nhận biết.",
        status: "HIDDEN",
        lessons: [
          {
            id: "lesson-chemistry-9-1",
            orderIndex: 1,
            title: "Buổi học 1: Oxit",
            shortDescription: "Phân loại oxit, tính chất hóa học và bài tập nhận biết.",
            scheduledAt: "2026-08-07T12:00",
            examOpenAt: "2026-08-07T13:00",
            videoUrl: "https://youtube.com/watch?v=hoa9-01",
            completionMinScore: 7,
            trialEnabled: false,
            status: "HIDDEN",
          },
        ],
      },
    ],
  },
];
