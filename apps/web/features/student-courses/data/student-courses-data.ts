import type {
  StudentCourse,
  StudentCourseDetail,
  StudentCourseStat,
  StudentCourseSubject,
  StudentTodayGoal,
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
    chapterCount: 12,
    description:
      "Nắm vững kiến thức trọng tâm, rèn luyện kỹ năng giải bài tập và bứt phá điểm số.",
    exerciseCount: 96,
    grade: 7,
    id: "course-math-7-foundation",
    lessonCount: 48,
    nextLesson: {
      examOpenLabel: "Mở bài kiểm tra lúc 19:30",
      id: "lesson-math-7-ratio",
      kind: "inProgress",
      title: "Buổi 5: Tỉ lệ thức",
    },
    originalPriceVnd: 2_000_000,
    progressPercent: 42,
    salePriceVnd: 1_500_000,
    slug: "toan-7-nen-tang",
    subject: "MATH",
    title: "Toán 7 - Bứt phá học kỳ 1",
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
      kind: "first",
      title: "Buổi 1: Hàm số",
    },
    originalPriceVnd: 1_900_000,
    progressPercent: 0,
    salePriceVnd: 1_650_000,
    slug: "toan-7-nang-cao",
    subject: "MATH",
    title: "Toán 7 nâng cao",
    tone: "math",
    updatedLabel: "Mới học",
  },
  {
    access: "enrolled",
    chapterCount: 5,
    description:
      "Ôn chắc từng chuyên đề qua bài tập ngắn, giúp em giữ nhịp học đều mỗi tuần.",
    exerciseCount: 90,
    grade: 7,
    id: "course-math-7-practice",
    lessonCount: 24,
    nextLesson: {
      id: "lesson-math-7-practice-polynomial",
      kind: "next",
      title: "Buổi 6: Đa thức một biến",
    },
    originalPriceVnd: 1_750_000,
    progressPercent: 58,
    salePriceVnd: 1_400_000,
    slug: "toan-7-luyen-tap",
    subject: "MATH",
    title: "Toán 7 luyện tập",
    tone: "math",
    updatedLabel: "Hôm qua",
  },
  {
    access: "enrolled",
    chapterCount: 6,
    description: "Hệ thống hóa kiến thức quan trọng trước khi kết thúc lộ trình học kỳ.",
    exerciseCount: 104,
    grade: 7,
    id: "course-math-7-final-review",
    lessonCount: 36,
    nextLesson: {
      id: "lesson-math-7-final-review",
      kind: "last",
      title: "Buổi 36: Tổng ôn cuối khóa",
    },
    originalPriceVnd: 1_950_000,
    progressPercent: 92,
    salePriceVnd: 1_600_000,
    slug: "toan-7-tong-on",
    subject: "MATH",
    title: "Toán 7 tổng ôn",
    tone: "math",
    updatedLabel: "Sắp hoàn thành",
  },
  {
    access: "locked",
    chapterCount: 3,
    description: "Mở rộng kỹ năng giải toán lớp 7 bằng hệ thống bài tập chọn lọc.",
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
    access: "locked",
    chapterCount: 3,
    description: "Làm quen chuyển động, lực và các hiện tượng vật lý qua ví dụ gần gũi.",
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
    description: "Lộ trình ôn thi vào 10 hiệu quả, hệ thống hóa kiến thức trọng tâm.",
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

export const studentCourseDetails: Partial<Record<string, StudentCourseDetail>> = {
  "toan-7-nen-tang": {
    chapters: [
      {
        description: "Nắm vững khái niệm số hữu tỉ, thứ tự và các phép toán.",
        id: "chapter-rational-numbers",
        lessons: [
          {
            durationMinutes: 30,
            id: "lesson-math-7-rational-set",
            status: "completed",
            title: "Bài 1. Tập hợp Q các số hữu tỉ",
          },
          {
            durationMinutes: 40,
            id: "lesson-math-7-add-subtract",
            status: "completed",
            title: "Bài 2. Cộng, trừ số hữu tỉ",
          },
          {
            durationMinutes: 45,
            id: "lesson-math-7-multiply-divide",
            status: "completed",
            title: "Bài 3. Nhân, chia số hữu tỉ",
          },
          {
            durationMinutes: 35,
            id: "lesson-math-7-powers",
            status: "completed",
            title: "Bài 4. Lũy thừa của một số hữu tỉ",
          },
          {
            durationMinutes: 40,
            id: "lesson-math-7-ratio",
            status: "current",
            title: "Bài 5. Tỉ lệ thức",
          },
          {
            durationMinutes: 40,
            id: "lesson-math-7-ratio-practice",
            status: "locked",
            title: "Bài 6. Luyện tập tỉ lệ thức",
          },
        ],
        order: 1,
        progressPercent: 100,
        title: "Số hữu tỉ và tập hợp Q",
        tone: "emerald",
      },
      {
        description: "Làm quen với đại lượng tỉ lệ thuận, nghịch và hàm số.",
        id: "chapter-functions",
        lessons: [
          {
            durationMinutes: 35,
            id: "lesson-math-7-direct-proportion",
            status: "locked",
            title: "Bài 1. Đại lượng tỉ lệ thuận",
          },
          {
            durationMinutes: 40,
            id: "lesson-math-7-inverse-proportion",
            status: "locked",
            title: "Bài 2. Đại lượng tỉ lệ nghịch",
          },
        ],
        order: 2,
        progressPercent: 0,
        title: "Hàm số và đồ thị",
        tone: "amber",
      },
      {
        description: "Thu thập, phân loại dữ liệu và biểu diễn bằng biểu đồ.",
        id: "chapter-statistics",
        lessons: [
          {
            durationMinutes: 35,
            id: "lesson-math-7-data-table",
            status: "locked",
            title: "Bài 1. Bảng dữ liệu ban đầu",
          },
        ],
        order: 3,
        progressPercent: 0,
        title: "Thống kê",
        tone: "violet",
      },
    ],
    continueLessonId: "lesson-math-7-ratio",
    continueLessonKind: "inProgress",
    continueLessonTitle: "Buổi 5: Tỉ lệ thức",
    totalHours: 18,
  },
  "toan-7-nang-cao": {
    chapters: [
      {
        description: "Khởi động với hàm số và các dạng bài nhận biết nhanh.",
        id: "chapter-advanced-functions",
        lessons: [
          {
            durationMinutes: 35,
            id: "lesson-math-7-functions",
            status: "current",
            title: "Bài 1. Hàm số",
          },
          {
            durationMinutes: 40,
            id: "lesson-math-7-function-graph",
            status: "locked",
            title: "Bài 2. Mặt phẳng tọa độ",
          },
          {
            durationMinutes: 45,
            id: "lesson-math-7-linear-relation",
            status: "locked",
            title: "Bài 3. Đồ thị hàm số",
          },
        ],
        order: 1,
        progressPercent: 0,
        title: "Hàm số nâng cao",
        tone: "violet",
      },
      {
        description: "Rèn cách biến đổi biểu thức và nhận diện bài toán khó.",
        id: "chapter-advanced-expressions",
        lessons: [
          {
            durationMinutes: 40,
            id: "lesson-math-7-advanced-expression",
            status: "locked",
            title: "Bài 1. Biểu thức đại số nâng cao",
          },
        ],
        order: 2,
        progressPercent: 0,
        title: "Biểu thức đại số",
        tone: "amber",
      },
    ],
    continueLessonId: "lesson-math-7-functions",
    continueLessonKind: "first",
    continueLessonTitle: "Buổi 1: Hàm số",
    totalHours: 12,
  },
  "toan-7-luyen-tap": {
    chapters: [
      {
        description: "Ôn nhanh các nền tảng đại số qua bài tập ngắn.",
        id: "chapter-practice-foundation",
        lessons: [
          {
            durationMinutes: 30,
            id: "lesson-math-7-practice-rational",
            status: "completed",
            title: "Bài 1. Ôn số hữu tỉ",
          },
          {
            durationMinutes: 35,
            id: "lesson-math-7-practice-ratio",
            status: "completed",
            title: "Bài 2. Tỉ lệ thức cơ bản",
          },
          {
            durationMinutes: 35,
            id: "lesson-math-7-practice-proportion",
            status: "completed",
            title: "Bài 3. Đại lượng tỉ lệ",
          },
          {
            durationMinutes: 40,
            id: "lesson-math-7-practice-statistics",
            status: "completed",
            title: "Bài 4. Thống kê",
          },
          {
            durationMinutes: 40,
            id: "lesson-math-7-practice-expression",
            status: "completed",
            title: "Bài 5. Biểu thức đại số",
          },
          {
            durationMinutes: 45,
            id: "lesson-math-7-practice-polynomial",
            status: "next",
            title: "Bài 6. Đa thức một biến",
          },
        ],
        order: 1,
        progressPercent: 83,
        title: "Luyện tập trọng tâm",
        tone: "emerald",
      },
      {
        description: "Mở rộng với các đề luyện tổng hợp theo tuần.",
        id: "chapter-practice-weekly",
        lessons: [
          {
            durationMinutes: 45,
            id: "lesson-math-7-practice-weekly-1",
            status: "locked",
            title: "Bài 1. Đề luyện tuần 1",
          },
        ],
        order: 2,
        progressPercent: 0,
        title: "Đề luyện theo tuần",
        tone: "amber",
      },
    ],
    continueLessonId: "lesson-math-7-practice-polynomial",
    continueLessonKind: "next",
    continueLessonTitle: "Buổi 6: Đa thức một biến",
    totalHours: 10,
  },
  "toan-7-tong-on": {
    chapters: [
      {
        description: "Hoàn thiện các chuyên đề cuối cùng trước khi kết thúc khóa.",
        id: "chapter-final-review",
        lessons: [
          {
            durationMinutes: 45,
            id: "lesson-math-7-final-topic-1",
            status: "completed",
            title: "Bài 34. Tổng hợp đại số",
          },
          {
            durationMinutes: 45,
            id: "lesson-math-7-final-topic-2",
            status: "completed",
            title: "Bài 35. Tổng hợp hình học",
          },
          {
            durationMinutes: 50,
            id: "lesson-math-7-final-review",
            status: "next",
            title: "Bài 36. Tổng ôn cuối khóa",
          },
        ],
        order: 6,
        progressPercent: 94,
        title: "Tổng ôn cuối khóa",
        tone: "emerald",
      },
    ],
    continueLessonId: "lesson-math-7-final-review",
    continueLessonKind: "last",
    continueLessonTitle: "Buổi 36: Tổng ôn cuối khóa",
    totalHours: 14,
  },
  "toan-7-tang-toc": {
    chapters: [
      {
        description: "Khởi động với các dạng bài nền tảng để xem thử nhịp học.",
        id: "chapter-speed-trial-foundation",
        lessons: [
          {
            durationMinutes: 30,
            id: "lesson-math-7-speed-trial-rational",
            isTrial: true,
            status: "current",
            title: "Bài 1. Học thử: Ôn số hữu tỉ",
          },
          {
            durationMinutes: 35,
            id: "lesson-math-7-speed-trial-ratio",
            isTrial: true,
            status: "next",
            title: "Bài 2. Học thử: Tỉ lệ thức nhanh",
          },
          {
            durationMinutes: 40,
            id: "lesson-math-7-speed-proportion",
            status: "locked",
            title: "Bài 3. Đại lượng tỉ lệ",
          },
          {
            durationMinutes: 45,
            id: "lesson-math-7-speed-graph",
            status: "locked",
            title: "Bài 4. Hàm số và đồ thị",
          },
        ],
        order: 1,
        progressPercent: 0,
        title: "Học thử tăng tốc",
        tone: "emerald",
      },
      {
        description: "Các chuyên đề luyện tốc độ mở sau khi đăng ký khóa học.",
        id: "chapter-speed-intensive",
        lessons: [
          {
            durationMinutes: 45,
            id: "lesson-math-7-speed-expression",
            status: "locked",
            title: "Bài 1. Biểu thức đại số chọn lọc",
          },
          {
            durationMinutes: 50,
            id: "lesson-math-7-speed-test",
            status: "locked",
            title: "Bài 2. Bài kiểm tra tăng tốc",
          },
        ],
        order: 2,
        progressPercent: 0,
        title: "Chuyên đề tăng tốc",
        tone: "amber",
      },
    ],
    continueLessonId: "lesson-math-7-speed-trial-rational",
    continueLessonKind: "first",
    continueLessonTitle: "Buổi 1: Học thử - Ôn số hữu tỉ",
    totalHours: 9,
  },
};

export const purchasedStats: StudentCourseStat[] = [
  { label: "đang học", value: "4" },
  { label: "tiến độ", value: "42%" },
  { label: "buổi hôm nay", value: "1" },
];

export const learningStreakStat = {
  label: "chuỗi ngày học",
  unit: "ngày liên tiếp",
  value: "7",
};

export const todayLearningGoals: StudentTodayGoal[] = [
  {
    completed: true,
    icon: "lesson",
    id: "complete-one-lesson",
    metric: "1/1 buổi",
    title: "Hoàn thành 1 buổi học",
    tone: "sky",
  },
  {
    completed: false,
    icon: "score",
    id: "score-eight-plus",
    metric: "Mục tiêu 8+",
    title: "Làm bài kiểm tra đạt từ 8 điểm",
    tone: "indigo",
  },
];
