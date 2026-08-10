import type { LessonSummaryDiagramIntent } from "#api/modules/ai/types/lesson-summary-diagram-intent.types";

export type MathDiagramLiveGateBDifficulty = "SIMPLE" | "MEDIUM" | "HARD";

export type MathDiagramLiveGateBLesson = {
  caseId: string;
  grade: 3 | 4 | 5 | 6 | 7 | 8 | 9;
  difficulty: MathDiagramLiveGateBDifficulty;
  title: string;
  referenceId: string;
  officialReaderUrl: string;
  readerPages: readonly number[];
  expectedFamilies: readonly LessonSummaryDiagramIntent["family"][];
  coverageFamilies?: readonly LessonSummaryDiagramIntent["family"][];
  minimumDiagramCount: number;
  sourceMode: "OFFICIAL_READER_LOCAL_OCR" | "LOCAL_MATHPIX_CACHE";
};

/**
 * Gate B uses complete, distinct KNTT textbook lessons. Reader pages are the
 * electronic-reader indices (normally printed page + 1), not invented prompts.
 * The source preparation step records the exact CDN URL and OCR hash for every
 * page before any paid request may start.
 */
export const mathDiagramLiveGateBLessons = [
  {
    caseId: "g3-simple-bai14-fraction",
    grade: 3,
    difficulty: "SIMPLE",
    title: "Bài 14. Một phần mấy",
    referenceId: "nxbgd-kntt-math-3-v1",
    officialReaderUrl:
      "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-3-tap-mot.4698702815",
    readerPages: [43, 44, 45, 46],
    expectedFamilies: ["ELEMENTARY_MODEL"],
    minimumDiagramCount: 2,
    sourceMode: "OFFICIAL_READER_LOCAL_OCR",
  },
  {
    caseId: "g3-medium-bai17-circle",
    grade: 3,
    difficulty: "MEDIUM",
    title: "Bài 17. Hình tròn. Tâm, bán kính, đường kính của hình tròn",
    referenceId: "nxbgd-kntt-math-3-v1",
    officialReaderUrl:
      "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-3-tap-mot.4698702815",
    readerPages: [53, 54],
    expectedFamilies: ["PLANE_GEOMETRY"],
    minimumDiagramCount: 2,
    sourceMode: "OFFICIAL_READER_LOCAL_OCR",
  },
  {
    caseId: "g3-hard-bai21-solids",
    grade: 3,
    difficulty: "HARD",
    title: "Bài 21. Khối lập phương, khối hộp chữ nhật",
    referenceId: "nxbgd-kntt-math-3-v1",
    officialReaderUrl:
      "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-3-tap-mot.4698702815",
    readerPages: [64, 65],
    expectedFamilies: ["SPATIAL_APPLIED"],
    minimumDiagramCount: 2,
    sourceMode: "OFFICIAL_READER_LOCAL_OCR",
  },
  {
    caseId: "g4-simple-bai1-number-line",
    grade: 4,
    difficulty: "SIMPLE",
    title: "Bài 1. Ôn tập các số đến 100 000",
    referenceId: "nxbgd-kntt-math-4-v1",
    officialReaderUrl:
      "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-4-tap-mot.4714093295",
    readerPages: [7, 8, 9],
    expectedFamilies: ["NUMBER_COORDINATE"],
    minimumDiagramCount: 1,
    sourceMode: "OFFICIAL_READER_LOCAL_OCR",
  },
  {
    caseId: "g4-medium-bai29-parallel",
    grade: 4,
    difficulty: "MEDIUM",
    title: "Bài 29. Hai đường thẳng song song",
    referenceId: "nxbgd-kntt-math-4-v1",
    officialReaderUrl:
      "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-4-tap-mot.4714093295",
    readerPages: [99, 100, 101],
    expectedFamilies: ["PLANE_GEOMETRY"],
    minimumDiagramCount: 2,
    sourceMode: "OFFICIAL_READER_LOCAL_OCR",
  },
  {
    caseId: "g4-hard-bai31-quadrilaterals",
    grade: 4,
    difficulty: "HARD",
    title: "Bài 31. Hình bình hành, hình thoi",
    referenceId: "nxbgd-kntt-math-4-v1",
    officialReaderUrl:
      "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-4-tap-mot.4714093295",
    readerPages: [106, 107, 108, 109, 110],
    expectedFamilies: ["PLANE_GEOMETRY"],
    minimumDiagramCount: 3,
    sourceMode: "OFFICIAL_READER_LOCAL_OCR",
  },
  {
    caseId: "g5-simple-bai25-triangle-area",
    grade: 5,
    difficulty: "SIMPLE",
    title: "Bài 25. Hình tam giác. Diện tích hình tam giác",
    referenceId: "nxbgd-kntt-math-5-v1",
    officialReaderUrl:
      "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-5-tap-mot.4699756373",
    readerPages: [92, 93, 94, 95, 96, 97, 98],
    expectedFamilies: ["PLANE_GEOMETRY"],
    coverageFamilies: ["ELEMENTARY_MODEL", "PLANE_GEOMETRY"],
    minimumDiagramCount: 3,
    sourceMode: "OFFICIAL_READER_LOCAL_OCR",
  },
  {
    caseId: "g5-medium-bai26-trapezoid-area",
    grade: 5,
    difficulty: "MEDIUM",
    title: "Bài 26. Hình thang. Diện tích hình thang",
    referenceId: "nxbgd-kntt-math-5-v1",
    officialReaderUrl:
      "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-5-tap-mot.4699756373",
    readerPages: [99, 100, 101, 102, 103, 104, 105],
    expectedFamilies: ["PLANE_GEOMETRY"],
    coverageFamilies: ["ELEMENTARY_MODEL", "PLANE_GEOMETRY"],
    minimumDiagramCount: 3,
    sourceMode: "OFFICIAL_READER_LOCAL_OCR",
  },
  {
    caseId: "g5-hard-bai27-circle-area",
    grade: 5,
    difficulty: "HARD",
    title: "Bài 27. Đường tròn. Chu vi và diện tích hình tròn",
    referenceId: "nxbgd-kntt-math-5-v1",
    officialReaderUrl:
      "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-5-tap-mot.4699756373",
    readerPages: [106, 107, 108, 109, 110, 111, 112, 113],
    expectedFamilies: ["PLANE_GEOMETRY"],
    minimumDiagramCount: 3,
    sourceMode: "OFFICIAL_READER_LOCAL_OCR",
  },
  {
    caseId: "g6-simple-bai1-set",
    grade: 6,
    difficulty: "SIMPLE",
    title: "Bài 1. Tập hợp",
    referenceId: "nxbgd-kntt-math-6-v1",
    officialReaderUrl:
      "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-6-tap-mot.4699854777",
    readerPages: [6, 7, 8, 9],
    expectedFamilies: ["SET_SCHEMATIC"],
    minimumDiagramCount: 1,
    sourceMode: "OFFICIAL_READER_LOCAL_OCR",
  },
  {
    caseId: "g6-medium-bai33-point-ray",
    grade: 6,
    difficulty: "MEDIUM",
    title: "Bài 33. Điểm nằm giữa hai điểm. Tia",
    referenceId: "nxbgd-kntt-math-6-v2",
    officialReaderUrl:
      "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-6-tap-hai.4699864675",
    readerPages: [49, 50, 51],
    expectedFamilies: ["PLANE_GEOMETRY"],
    minimumDiagramCount: 2,
    sourceMode: "OFFICIAL_READER_LOCAL_OCR",
  },
  {
    caseId: "g6-hard-bai41-double-bar",
    grade: 6,
    difficulty: "HARD",
    title: "Bài 41. Biểu đồ cột kép",
    referenceId: "nxbgd-kntt-math-6-v2",
    officialReaderUrl:
      "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-6-tap-hai.4699864675",
    readerPages: [83, 84, 85, 86, 87],
    expectedFamilies: ["DATA_STATISTICS"],
    minimumDiagramCount: 2,
    sourceMode: "OFFICIAL_READER_LOCAL_OCR",
  },
  {
    caseId: "g7-simple-bai1-rational-number-line",
    grade: 7,
    difficulty: "SIMPLE",
    title: "Bài 1. Tập hợp các số hữu tỉ",
    referenceId: "nxbgd-kntt-math-7-v1",
    officialReaderUrl:
      "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-7-tap-mot.4714106181",
    readerPages: [6, 7, 8, 9],
    expectedFamilies: ["NUMBER_COORDINATE"],
    minimumDiagramCount: 1,
    sourceMode: "LOCAL_MATHPIX_CACHE",
  },
  {
    caseId: "g7-medium-bai36-cuboid",
    grade: 7,
    difficulty: "MEDIUM",
    title: "Bài 36. Hình hộp chữ nhật và hình lập phương",
    referenceId: "nxbgd-kntt-math-7-v2",
    officialReaderUrl:
      "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-7-tap-hai.4700015846",
    readerPages: [86, 87, 88, 89, 90, 91, 92, 93, 94],
    expectedFamilies: ["SPATIAL_APPLIED"],
    minimumDiagramCount: 3,
    sourceMode: "OFFICIAL_READER_LOCAL_OCR",
  },
  {
    caseId: "g7-hard-bai15-right-triangle-congruence",
    grade: 7,
    difficulty: "HARD",
    title: "Bài 15. Ba trường hợp bằng nhau của tam giác vuông",
    referenceId: "nxbgd-kntt-math-7-v1",
    officialReaderUrl:
      "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-7-tap-mot.4714106181",
    readerPages: [76, 77, 78, 79, 80],
    expectedFamilies: ["PLANE_GEOMETRY"],
    minimumDiagramCount: 6,
    sourceMode: "LOCAL_MATHPIX_CACHE",
  },
  {
    caseId: "g8-simple-bai28-linear-function",
    grade: 8,
    difficulty: "SIMPLE",
    title: "Bài 28. Hàm số bậc nhất và đồ thị của hàm số bậc nhất",
    referenceId: "nxbgd-kntt-math-8-v2",
    officialReaderUrl:
      "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-8-tap-hai.4700102182",
    readerPages: [48, 49, 50, 51],
    expectedFamilies: ["ALGEBRA_GRAPH"],
    minimumDiagramCount: 2,
    sourceMode: "OFFICIAL_READER_LOCAL_OCR",
  },
  {
    caseId: "g8-medium-bai30-probability",
    grade: 8,
    difficulty: "MEDIUM",
    title: "Bài 30. Kết quả có thể và kết quả thuận lợi",
    referenceId: "nxbgd-kntt-math-8-v2",
    officialReaderUrl:
      "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-8-tap-hai.4700102182",
    readerPages: [60, 61, 62, 63, 64, 65],
    expectedFamilies: ["SET_SCHEMATIC"],
    minimumDiagramCount: 1,
    sourceMode: "OFFICIAL_READER_LOCAL_OCR",
  },
  {
    caseId: "g8-hard-bai34-triangle-similarity",
    grade: 8,
    difficulty: "HARD",
    title: "Bài 34. Ba trường hợp đồng dạng của hai tam giác",
    referenceId: "nxbgd-kntt-math-8-v2",
    officialReaderUrl:
      "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-8-tap-hai.4700102182",
    readerPages: [84, 85, 86, 87, 88, 89, 90, 91],
    expectedFamilies: ["ADVANCED_GEOMETRY"],
    minimumDiagramCount: 4,
    sourceMode: "OFFICIAL_READER_LOCAL_OCR",
  },
  {
    caseId: "g9-simple-bai22-frequency-chart",
    grade: 9,
    difficulty: "SIMPLE",
    title: "Bài 22. Bảng tần số và biểu đồ tần số",
    referenceId: "nxbgd-kntt-math-9-v2",
    officialReaderUrl:
      "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-9-tap-hai.4714699696",
    readerPages: [33, 34, 35, 36, 37, 38],
    expectedFamilies: ["DATA_STATISTICS"],
    minimumDiagramCount: 2,
    sourceMode: "OFFICIAL_READER_LOCAL_OCR",
  },
  {
    caseId: "g9-medium-bai18-quadratic-graph",
    grade: 9,
    difficulty: "MEDIUM",
    title: "Bài 18. Hàm số y = ax² (a ≠ 0)",
    referenceId: "nxbgd-kntt-math-9-v2",
    officialReaderUrl:
      "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-9-tap-hai.4714699696",
    readerPages: [5, 6, 7, 8, 9, 10],
    expectedFamilies: ["ALGEBRA_GRAPH"],
    minimumDiagramCount: 3,
    sourceMode: "OFFICIAL_READER_LOCAL_OCR",
  },
  {
    caseId: "g9-hard-bai16-tangent",
    grade: 9,
    difficulty: "HARD",
    title: "Bài 16. Vị trí tương đối của đường thẳng và đường tròn",
    referenceId: "nxbgd-kntt-math-9-v1",
    officialReaderUrl:
      "https://taphuan.nxbgd.vn/tap-huan/doc-sach/sgk-toan-9-tap-mot.4714692201",
    readerPages: [100, 101, 102, 103, 104],
    expectedFamilies: ["ADVANCED_GEOMETRY"],
    minimumDiagramCount: 4,
    sourceMode: "OFFICIAL_READER_LOCAL_OCR",
  },
] as const satisfies readonly MathDiagramLiveGateBLesson[];
