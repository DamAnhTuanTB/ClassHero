import type { LessonSummaryDiagramIntent } from "#api/modules/ai/types/lesson-summary-diagram-intent.types";

export type SemanticDiagramVisualCase = {
  caseId: string;
  title: string;
  problem: string;
  intent: LessonSummaryDiagramIntent;
};

const base = {
  intentVersion: 1 as const,
  caption: null,
};

const geometryMeasures: Array<{ target: string; text: string }> = [];
const spatialDimensions: Array<{
  target: string;
  value: number;
  unit: string;
}> = [];

export const semanticDiagramVisualCases = [
  {
    caseId: "elementary-array",
    title: "Phép nhân bằng mô hình mảng",
    problem: "Biểu diễn 4 × 6 bằng bốn hàng, mỗi hàng sáu chấm.",
    intent: { ...base, grade: 3, difficulty: "SIMPLE", family: "ELEMENTARY_MODEL", archetype: "MULTIPLICATION_ARRAY", rows: 4, columns: 6, rowLabel: "4 hàng", columnLabel: "6 cột" },
  },
  {
    caseId: "elementary-tape",
    title: "Sơ đồ đoạn thẳng so sánh",
    problem: "An có 15 viên bi, Bình có nhiều hơn An 10 viên bi.",
    intent: { ...base, grade: 3, difficulty: "MEDIUM", family: "ELEMENTARY_MODEL", archetype: "TAPE_COMPARISON", bars: [{ label: "An", parts: [15], partLabels: ["15"] }, { label: "Bình", parts: [15, 10], partLabels: ["15", "10"] }], unit: "viên bi" },
  },
  {
    caseId: "elementary-fraction-bar",
    title: "Phân số trên băng giấy",
    problem: "Tô màu 3/5 băng giấy.",
    intent: { ...base, grade: 4, difficulty: "SIMPLE", family: "ELEMENTARY_MODEL", archetype: "FRACTION_MODEL", numerator: 3, denominator: 5, shape: "BAR", fractionLabel: "3/5" },
  },
  {
    caseId: "elementary-fraction-circle",
    title: "Phân số trên hình tròn",
    problem: "Tô màu 5/8 hình tròn.",
    intent: { ...base, grade: 5, difficulty: "MEDIUM", family: "ELEMENTARY_MODEL", archetype: "FRACTION_MODEL", numerator: 5, denominator: 8, shape: "CIRCLE", fractionLabel: "5/8" },
  },
  {
    caseId: "elementary-composite",
    title: "Hình chữ nhật ghép khuyết",
    problem: "Tính diện tích hình chữ L có kích thước ngoài 8 cm × 6 cm và phần khuyết 3 cm × 2 cm.",
    intent: { ...base, grade: 5, difficulty: "HARD", family: "ELEMENTARY_MODEL", archetype: "RECTILINEAR_COMPOSITE", outerWidth: 8, outerHeight: 6, cutoutWidth: 3, cutoutHeight: 2, unit: "cm" },
  },
  {
    caseId: "elementary-ruler",
    title: "Đọc số đo trên thước",
    problem: "Biểu diễn độ dài 7 cm trên thước chia từ 0 đến 10 cm.",
    intent: { ...base, grade: 3, difficulty: "SIMPLE", family: "ELEMENTARY_MODEL", archetype: "MEASUREMENT_SCALE", variant: "RULER", min: 0, max: 10, step: 1, value: 7, unit: "cm" },
  },
  {
    caseId: "elementary-thermometer",
    title: "Đọc nhiệt độ",
    problem: "Nhiệt kế chỉ 25 °C trên thang từ 0 °C đến 50 °C.",
    intent: { ...base, grade: 4, difficulty: "MEDIUM", family: "ELEMENTARY_MODEL", archetype: "MEASUREMENT_SCALE", variant: "THERMOMETER", min: 0, max: 50, step: 10, value: 25, unit: "°C" },
  },
  {
    caseId: "coordinate-number-line-integers",
    title: "Các điểm nguyên trên trục số",
    problem: "Biểu diễn P(-2), Q(3) trên trục số.",
    intent: { ...base, grade: 6, difficulty: "SIMPLE", family: "NUMBER_COORDINATE", archetype: "NUMBER_LINE", min: -5, max: 5, step: 1, points: [{ id: "P", label: "P", value: -2, endpoint: "POINT" }, { id: "Q", label: "Q", value: 3, endpoint: "POINT" }] },
  },
  {
    caseId: "coordinate-number-line-fractions",
    title: "Phân số trên trục số",
    problem: "Biểu diễn P(5/4), Q(-5/4) trên trục số.",
    intent: { ...base, grade: 7, difficulty: "MEDIUM", family: "NUMBER_COORDINATE", archetype: "NUMBER_LINE", min: -2, max: 2, step: 0.25, points: [{ id: "P", label: "P", value: 1.25, endpoint: "POINT" }, { id: "Q", label: "Q", value: -1.25, endpoint: "POINT" }] },
  },
  {
    caseId: "coordinate-interval",
    title: "Tập nghiệm nửa kín",
    problem: "Biểu diễn tập nghiệm -2 ≤ x < 3 trên trục số.",
    intent: { ...base, grade: 9, difficulty: "MEDIUM", family: "NUMBER_COORDINATE", archetype: "INTERVAL", min: -5, max: 5, step: 1, left: -2, right: 3, leftClosed: true, rightClosed: false, intervalLabel: "-2 ≤ x < 3" },
  },
  {
    caseId: "coordinate-three-points",
    title: "Ba điểm trên mặt phẳng Oxy",
    problem: "Biểu diễn A(1; 3), B(3; -1), C(-2; 2).",
    intent: { ...base, grade: 7, difficulty: "MEDIUM", family: "NUMBER_COORDINATE", archetype: "COORDINATE_POINTS", xMin: -4, xMax: 5, yMin: -4, yMax: 5, xStep: 1, yStep: 1, points: [{ id: "A", label: "A", x: 1, y: 3, showProjections: true }, { id: "B", label: "B", x: 3, y: -1, showProjections: true }, { id: "C", label: "C", x: -2, y: 2, showProjections: true }] },
  },
  {
    caseId: "coordinate-inequality-region",
    title: "Miền nghiệm hệ bất phương trình",
    problem: "Biểu diễn miền x ≥ 0, y ≥ 0, x + y ≤ 4.",
    intent: { ...base, grade: 9, difficulty: "HARD", family: "NUMBER_COORDINATE", archetype: "INEQUALITY_REGION", xMin: -1, xMax: 6, yMin: -1, yMax: 6, tickStep: 1, boundaries: [{ a: 1, b: 0, c: 0, operator: "GE", label: "x ≥ 0" }, { a: 0, b: 1, c: 0, operator: "GE", label: "y ≥ 0" }, { a: 1, b: 1, c: 4, operator: "LE", label: "x + y ≤ 4" }] },
  },
  {
    caseId: "graph-linear",
    title: "Đồ thị hàm số bậc nhất",
    problem: "Vẽ đồ thị y = 2x + 1 qua các điểm dựng đơn giản.",
    intent: { ...base, grade: 8, difficulty: "SIMPLE", family: "ALGEBRA_GRAPH", archetype: "LINEAR_FUNCTION", xMin: -4, xMax: 4, yMin: -5, yMax: 7, xStep: 1, yStep: 1, functions: [{ kind: "LINEAR", id: "linearOne", label: "y = 2x + 1", slope: 2, intercept: 1, constructionXs: [-1, 0, 1] }] },
  },
  {
    caseId: "graph-quadratic",
    title: "Parabol có năm điểm dựng",
    problem: "Vẽ parabol y = x² - 4.",
    intent: { ...base, grade: 9, difficulty: "MEDIUM", family: "ALGEBRA_GRAPH", archetype: "QUADRATIC_FUNCTION", xMin: -4, xMax: 4, yMin: -5, yMax: 6, xStep: 1, yStep: 1, functions: [{ kind: "QUADRATIC", id: "parabola", label: "y = x² - 4", a: 1, b: 0, c: -4, constructionXs: [-2, -1, 0, 1, 2] }] },
  },
  {
    caseId: "graph-linear-system",
    title: "Hai đường thẳng cắt nhau",
    problem: "Vẽ y = x + 1 và y = -x + 5 trên cùng hệ trục.",
    intent: { ...base, grade: 9, difficulty: "MEDIUM", family: "ALGEBRA_GRAPH", archetype: "LINEAR_SYSTEM", xMin: -2, xMax: 7, yMin: -2, yMax: 7, xStep: 1, yStep: 1, functions: [{ kind: "LINEAR", id: "lineOne", label: "y = x + 1", slope: 1, intercept: 1, constructionXs: [0, 2] }, { kind: "LINEAR", id: "lineTwo", label: "y = -x + 5", slope: -1, intercept: 5, constructionXs: [0, 2] }] },
  },
  {
    caseId: "graph-line-parabola",
    title: "Giao điểm đường thẳng và parabol",
    problem: "Vẽ y = x² - 2 và y = x trên cùng hệ trục.",
    intent: { ...base, grade: 9, difficulty: "HARD", family: "ALGEBRA_GRAPH", archetype: "LINE_QUADRATIC_INTERSECTION", xMin: -4, xMax: 4, yMin: -4, yMax: 7, xStep: 1, yStep: 1, functions: [{ kind: "QUADRATIC", id: "parabolaTwo", label: "y = x² - 2", a: 1, b: 0, c: -2, constructionXs: [-2, -1, 0, 1, 2] }, { kind: "LINEAR", id: "lineThree", label: "y = x", slope: 1, intercept: 0, constructionXs: [-2, 2] }] },
  },
  {
    caseId: "graph-inverse",
    title: "Đồ thị hàm số tỉ lệ nghịch",
    problem: "Vẽ đồ thị y = 4/x qua các điểm dựng có hoành độ -4, -2, -1, 1, 2, 4.",
    intent: { ...base, grade: 7, difficulty: "HARD", family: "ALGEBRA_GRAPH", archetype: "INVERSE_FUNCTION", xMin: -5, xMax: 5, yMin: -5, yMax: 5, xStep: 1, yStep: 1, functions: [{ kind: "INVERSE", id: "inverseOne", label: "y = 4/x", coefficient: 4, constructionXs: [-4, -2, -1, 1, 2, 4] }] },
  },
  {
    caseId: "data-value-table",
    title: "Bảng giá trị hàm số",
    problem: "Lập bảng giá trị của y = x² với x = -2, -1, 0, 1, 2.",
    intent: { ...base, grade: 7, difficulty: "SIMPLE", family: "DATA_STATISTICS", archetype: "VALUE_TABLE", columns: ["x", "-2", "-1", "0", "1", "2"], rows: [["y", "4", "1", "0", "1", "4"]] },
  },
  {
    caseId: "data-pictogram",
    title: "Biểu đồ tranh",
    problem: "Mỗi hình sao biểu diễn 2 học sinh; thể hiện sở thích của ba nhóm.",
    intent: { ...base, grade: 6, difficulty: "SIMPLE", family: "DATA_STATISTICS", archetype: "PICTOGRAM", categories: ["Bóng đá", "Cờ vua", "Bơi"], values: [8, 6, 4], valuePerSymbol: 2, symbol: "STAR", unit: "học sinh" },
  },
  {
    caseId: "data-bar-chart",
    title: "Biểu đồ cột",
    problem: "Biểu diễn số cây trồng được của bốn tổ.",
    intent: { ...base, grade: 4, difficulty: "MEDIUM", family: "DATA_STATISTICS", archetype: "BAR_CHART", categories: ["Tổ 1", "Tổ 2", "Tổ 3", "Tổ 4"], series: [{ label: "Số cây", values: [12, 18, 15, 20] }], yStep: 5, unit: "cây" },
  },
  {
    caseId: "data-grouped-bar-chart",
    title: "Biểu đồ cột kép",
    problem: "So sánh số cây trồng được của hai lớp trong ba tháng.",
    intent: { ...base, grade: 6, difficulty: "HARD", family: "DATA_STATISTICS", archetype: "BAR_CHART", categories: ["T1", "T2", "T3"], series: [{ label: "7A", values: [12, 18, 15] }, { label: "7B", values: [10, 15, 20] }], yStep: 5, unit: "cây" },
  },
  {
    caseId: "data-line-chart",
    title: "Biểu đồ đoạn thẳng",
    problem: "Biểu diễn nhiệt độ các ngày T2, T3, T4, T5, T6 lần lượt là 25, 27, 26, 30, 29 °C.",
    intent: { ...base, grade: 6, difficulty: "MEDIUM", family: "DATA_STATISTICS", archetype: "LINE_CHART", categories: ["T2", "T3", "T4", "T5", "T6"], series: [{ label: "Nhiệt độ", values: [25, 27, 26, 30, 29] }], yStep: 5, unit: "°C" },
  },
  {
    caseId: "data-histogram",
    title: "Biểu đồ tần số ghép nhóm",
    problem: "Biểu diễn tần số theo bốn khoảng điểm.",
    intent: { ...base, grade: 9, difficulty: "HARD", family: "DATA_STATISTICS", archetype: "HISTOGRAM", categories: ["[0;2)", "[2;4)", "[4;6)", "[6;8]"], series: [{ label: "Tần số", values: [3, 7, 9, 5] }], yStep: 2, unit: "học sinh" },
  },
  {
    caseId: "data-pie-chart",
    title: "Biểu đồ hình quạt tròn",
    problem: "Biểu diễn tỉ lệ bốn nhóm sở thích.",
    intent: { ...base, grade: 7, difficulty: "HARD", family: "DATA_STATISTICS", archetype: "PIE_CHART", categories: ["Đọc", "Thể thao", "Âm nhạc", "Khác"], series: [{ label: "Tỉ lệ", values: [35, 30, 20, 15] }], yStep: 10, unit: "%" },
  },
  {
    caseId: "data-clock",
    title: "Đồng hồ kim",
    problem: "Đồng hồ chỉ 3 giờ 30 phút.",
    intent: { ...base, grade: 3, difficulty: "SIMPLE", family: "DATA_STATISTICS", archetype: "CLOCK", hour: 3, minute: 30 },
  },
  {
    caseId: "geometry-angle-acute",
    title: "Góc nhọn",
    problem: "Vẽ góc xOy nhọn.",
    intent: { ...base, grade: 4, difficulty: "SIMPLE", family: "PLANE_GEOMETRY", archetype: "ANGLE_RAYS", variant: "ACUTE", pointLabels: ["O", "A", "B"], measures: [{ target: "ANGLE", text: "45°" }] },
  },
  {
    caseId: "geometry-angle-right",
    title: "Góc vuông",
    problem: "Vẽ góc vuông AOB.",
    intent: { ...base, grade: 4, difficulty: "SIMPLE", family: "PLANE_GEOMETRY", archetype: "ANGLE_RAYS", variant: "RIGHT", pointLabels: ["O", "A", "B"], measures: geometryMeasures },
  },
  {
    caseId: "geometry-angle-straight",
    title: "Góc bẹt",
    problem: "Vẽ góc bẹt AOB.",
    intent: { ...base, grade: 6, difficulty: "SIMPLE", family: "PLANE_GEOMETRY", archetype: "ANGLE_RAYS", variant: "STRAIGHT", pointLabels: ["O", "A", "B"], measures: [{ target: "ANGLE", text: "180°" }] },
  },
  {
    caseId: "geometry-angle-obtuse",
    title: "Góc tù",
    problem: "Vẽ góc AOB bằng 130°.",
    intent: { ...base, grade: 6, difficulty: "MEDIUM", family: "PLANE_GEOMETRY", archetype: "ANGLE_RAYS", variant: "OBTUSE", pointLabels: ["O", "A", "B"], measures: [{ target: "ANGLE", text: "130°" }] },
  },
  {
    caseId: "geometry-triangle-right",
    title: "Tam giác vuông 3–4–5",
    problem: "Vẽ tam giác ABC vuông tại B, AB = 3 cm, BC = 4 cm.",
    intent: { ...base, grade: 7, difficulty: "SIMPLE", family: "PLANE_GEOMETRY", archetype: "TRIANGLE", variant: "RIGHT", pointLabels: ["A", "B", "C"], measures: [{ target: "AB", text: "3 cm" }, { target: "BC", text: "4 cm" }] },
  },
  {
    caseId: "geometry-triangle-general",
    title: "Tam giác thường",
    problem: "Vẽ tam giác ABC và ghi tên ba đỉnh.",
    intent: { ...base, grade: 3, difficulty: "SIMPLE", family: "PLANE_GEOMETRY", archetype: "TRIANGLE", variant: "GENERAL", pointLabels: ["A", "B", "C"], measures: geometryMeasures },
  },
  {
    caseId: "geometry-triangle-equilateral",
    title: "Tam giác đều",
    problem: "Vẽ tam giác đều ABC và kí hiệu ba cạnh bằng nhau.",
    intent: { ...base, grade: 6, difficulty: "MEDIUM", family: "PLANE_GEOMETRY", archetype: "TRIANGLE", variant: "EQUILATERAL", pointLabels: ["A", "B", "C"], measures: geometryMeasures },
  },
  {
    caseId: "geometry-triangle-isosceles",
    title: "Tam giác cân",
    problem: "Vẽ tam giác ABC cân tại C.",
    intent: { ...base, grade: 7, difficulty: "MEDIUM", family: "PLANE_GEOMETRY", archetype: "TRIANGLE", variant: "ISOSCELES", pointLabels: ["A", "B", "C"], measures: geometryMeasures },
  },
  {
    caseId: "geometry-rectangle",
    title: "Hình chữ nhật",
    problem: "Vẽ hình chữ nhật ABCD.",
    intent: { ...base, grade: 4, difficulty: "SIMPLE", family: "PLANE_GEOMETRY", archetype: "QUADRILATERAL", variant: "RECTANGLE", pointLabels: ["A", "B", "C", "D"], measures: geometryMeasures },
  },
  {
    caseId: "geometry-square",
    title: "Hình vuông",
    problem: "Vẽ hình vuông ABCD, thể hiện góc vuông và bốn cạnh bằng nhau.",
    intent: { ...base, grade: 4, difficulty: "MEDIUM", family: "PLANE_GEOMETRY", archetype: "QUADRILATERAL", variant: "SQUARE", pointLabels: ["A", "B", "C", "D"], measures: geometryMeasures },
  },
  {
    caseId: "geometry-parallelogram",
    title: "Hình bình hành",
    problem: "Vẽ hình bình hành ABCD và kí hiệu hai cặp cạnh đối song song.",
    intent: { ...base, grade: 6, difficulty: "MEDIUM", family: "PLANE_GEOMETRY", archetype: "QUADRILATERAL", variant: "PARALLELOGRAM", pointLabels: ["A", "B", "C", "D"], measures: geometryMeasures },
  },
  {
    caseId: "geometry-trapezoid",
    title: "Hình thang",
    problem: "Vẽ hình thang ABCD có AB song song CD.",
    intent: { ...base, grade: 8, difficulty: "MEDIUM", family: "PLANE_GEOMETRY", archetype: "QUADRILATERAL", variant: "TRAPEZOID", pointLabels: ["A", "B", "C", "D"], measures: geometryMeasures },
  },
  {
    caseId: "geometry-rhombus",
    title: "Hình thoi",
    problem: "Vẽ hình thoi ABCD và kí hiệu bốn cạnh bằng nhau.",
    intent: { ...base, grade: 6, difficulty: "MEDIUM", family: "PLANE_GEOMETRY", archetype: "QUADRILATERAL", variant: "RHOMBUS", pointLabels: ["A", "B", "C", "D"], measures: geometryMeasures },
  },
  {
    caseId: "geometry-kite",
    title: "Hình diều",
    problem: "Vẽ tứ giác ABCD có AB = AD và BC = CD.",
    intent: { ...base, grade: 8, difficulty: "MEDIUM", family: "PLANE_GEOMETRY", archetype: "QUADRILATERAL", variant: "KITE", pointLabels: ["A", "B", "C", "D"], measures: geometryMeasures },
  },
  {
    caseId: "geometry-regular-hexagon",
    title: "Lục giác đều",
    problem: "Vẽ lục giác đều ABCDEF và kí hiệu sáu cạnh bằng nhau.",
    intent: { ...base, grade: 6, difficulty: "MEDIUM", family: "PLANE_GEOMETRY", archetype: "REGULAR_POLYGON", variant: "REGULAR_HEXAGON", pointLabels: ["A", "B", "C", "D", "E", "F"], measures: geometryMeasures },
  },
  {
    caseId: "geometry-line-ray-segment",
    title: "Đường thẳng, tia và đoạn thẳng",
    problem: "Phân biệt đường thẳng AB, tia CD và đoạn thẳng EF.",
    intent: { ...base, grade: 6, difficulty: "SIMPLE", family: "PLANE_GEOMETRY", archetype: "BASIC_CONSTRUCTION", variant: "LINE_RAY_SEGMENT", pointLabels: ["A", "B", "C", "D", "E", "F"], measures: geometryMeasures },
  },
  {
    caseId: "geometry-midpoint",
    title: "Trung điểm đoạn thẳng",
    problem: "M là trung điểm của đoạn thẳng AB.",
    intent: { ...base, grade: 6, difficulty: "SIMPLE", family: "PLANE_GEOMETRY", archetype: "BASIC_CONSTRUCTION", variant: "MIDPOINT", pointLabels: ["A", "M", "B"], measures: geometryMeasures },
  },
  {
    caseId: "geometry-perpendicular-lines",
    title: "Hai đường thẳng vuông góc",
    problem: "Hai đường thẳng AB và CD vuông góc tại O.",
    intent: { ...base, grade: 6, difficulty: "MEDIUM", family: "PLANE_GEOMETRY", archetype: "BASIC_CONSTRUCTION", variant: "PERPENDICULAR", pointLabels: ["A", "B", "C", "D", "O"], measures: geometryMeasures },
  },
  {
    caseId: "geometry-parallel-transversal",
    title: "Hai đường thẳng song song và cát tuyến",
    problem: "Vẽ hai đường thẳng AB, CD song song bị một cát tuyến cắt.",
    intent: { ...base, grade: 7, difficulty: "MEDIUM", family: "PLANE_GEOMETRY", archetype: "PARALLEL_TRANSVERSAL", variant: "GENERAL", pointLabels: ["A", "B", "C", "D"], measures: geometryMeasures },
  },
  {
    caseId: "geometry-circle-parts",
    title: "Bán kính, đường kính và dây",
    problem: "Trong đường tròn tâm O, vẽ bán kính OA, đường kính AB và dây BC.",
    intent: { ...base, grade: 6, difficulty: "MEDIUM", family: "PLANE_GEOMETRY", archetype: "CIRCLE_PARTS", variant: "RADIUS_DIAMETER_CHORD", pointLabels: ["O", "A", "B", "C"], measures: [{ target: "OA", text: "r" }] },
  },
  {
    caseId: "geometry-circle-sector",
    title: "Cung và hình quạt tròn",
    problem: "Vẽ hình quạt AOB của đường tròn tâm O có góc ở tâm 80°.",
    intent: { ...base, grade: 9, difficulty: "MEDIUM", family: "PLANE_GEOMETRY", archetype: "CIRCLE_PARTS", variant: "ARC_SECTOR", pointLabels: ["O", "A", "B"], measures: [{ target: "ANGLE", text: "80°" }] },
  },
  {
    caseId: "geometry-axial-symmetry",
    title: "Hình có trục đối xứng",
    problem: "Vẽ tam giác A'B'C' đối xứng với tam giác ABC qua trục d.",
    intent: { ...base, grade: 6, difficulty: "MEDIUM", family: "PLANE_GEOMETRY", archetype: "SYMMETRY", variant: "AXIAL", pointLabels: ["A", "B", "C", "A′", "B′", "C′"], measures: geometryMeasures },
  },
  {
    caseId: "geometry-central-symmetry",
    title: "Hình có tâm đối xứng",
    problem: "Vẽ tam giác A'B'C' đối xứng với tam giác ABC qua tâm O.",
    intent: { ...base, grade: 6, difficulty: "HARD", family: "PLANE_GEOMETRY", archetype: "SYMMETRY", variant: "CENTRAL", pointLabels: ["A", "B", "C", "A′", "B′", "C′", "O"], measures: geometryMeasures },
  },
  {
    caseId: "geometry-congruence-separate",
    title: "Cạnh huyền – cạnh góc vuông",
    problem: "Minh họa hai tam giác vuông có cạnh huyền và một cạnh góc vuông tương ứng bằng nhau.",
    intent: { ...base, grade: 7, difficulty: "MEDIUM", family: "PLANE_GEOMETRY", archetype: "RIGHT_TRIANGLE_CONGRUENCE", variant: "HYPOTENUSE_LEG", pointLabels: ["A", "B", "C", "A′", "B′", "C′"], measures: geometryMeasures },
  },
  {
    caseId: "geometry-congruence-two-legs",
    title: "Hai cạnh góc vuông",
    problem: "Minh hoạ hai tam giác vuông bằng nhau theo trường hợp hai cạnh góc vuông.",
    intent: { ...base, grade: 7, difficulty: "MEDIUM", family: "PLANE_GEOMETRY", archetype: "RIGHT_TRIANGLE_CONGRUENCE", variant: "TWO_LEGS", pointLabels: ["A", "B", "C", "A′", "B′", "C′"], measures: geometryMeasures },
  },
  {
    caseId: "geometry-congruence-hypotenuse-angle",
    title: "Cạnh huyền – góc nhọn",
    problem: "Minh hoạ hai tam giác vuông bằng nhau theo trường hợp cạnh huyền – góc nhọn.",
    intent: { ...base, grade: 7, difficulty: "MEDIUM", family: "PLANE_GEOMETRY", archetype: "RIGHT_TRIANGLE_CONGRUENCE", variant: "HYPOTENUSE_ACUTE_ANGLE", pointLabels: ["A", "B", "C", "A′", "B′", "C′"], measures: geometryMeasures },
  },
  {
    caseId: "geometry-congruence-shared",
    title: "Hai tam giác vuông chung cạnh huyền",
    problem: "Cho ABC vuông tại B và ADC vuông tại D, AC chung, AB = AD.",
    intent: { ...base, grade: 7, difficulty: "HARD", family: "PLANE_GEOMETRY", archetype: "RIGHT_TRIANGLE_CONGRUENCE", variant: "SHARED_HYPOTENUSE_LEG", pointLabels: ["A", "B", "C", "D"], measures: geometryMeasures },
  },
  {
    caseId: "advanced-centroid",
    title: "Ba đường trung tuyến",
    problem: "Vẽ ba đường trung tuyến AD, BE, CF đồng quy tại G.",
    intent: { ...base, grade: 7, difficulty: "HARD", family: "ADVANCED_GEOMETRY", archetype: "TRIANGLE_CENTROID", variant: "THREE_MEDIANS", pointLabels: ["A", "B", "C", "D", "E", "F", "G"], measures: geometryMeasures },
  },
  {
    caseId: "advanced-angle-bisectors",
    title: "Ba đường phân giác",
    problem: "Vẽ ba đường phân giác của tam giác ABC đồng quy tại I.",
    intent: { ...base, grade: 7, difficulty: "MEDIUM", family: "ADVANCED_GEOMETRY", archetype: "TRIANGLE_CONCURRENCY", variant: "ANGLE_BISECTORS", pointLabels: ["A", "B", "C", "I"], measures: geometryMeasures },
  },
  {
    caseId: "advanced-perpendicular-bisectors",
    title: "Ba đường trung trực",
    problem: "Vẽ ba đường trung trực của tam giác ABC đồng quy tại O.",
    intent: { ...base, grade: 7, difficulty: "HARD", family: "ADVANCED_GEOMETRY", archetype: "TRIANGLE_CONCURRENCY", variant: "PERPENDICULAR_BISECTORS", pointLabels: ["A", "B", "C", "D", "E", "F", "O"], measures: geometryMeasures },
  },
  {
    caseId: "advanced-altitudes",
    title: "Ba đường cao",
    problem: "Vẽ ba đường cao AD, BE, CF của tam giác ABC đồng quy tại H.",
    intent: { ...base, grade: 7, difficulty: "HARD", family: "ADVANCED_GEOMETRY", archetype: "TRIANGLE_CONCURRENCY", variant: "ALTITUDES", pointLabels: ["A", "B", "C", "D", "E", "F", "H"], measures: geometryMeasures },
  },
  {
    caseId: "advanced-thales",
    title: "Định lí Thales",
    problem: "Trong tam giác ABC, D thuộc AB, E thuộc AC và DE song song BC.",
    intent: { ...base, grade: 8, difficulty: "MEDIUM", family: "ADVANCED_GEOMETRY", archetype: "THALES", variant: "PARALLEL_SEGMENT", pointLabels: ["A", "B", "C", "D", "E"], measures: geometryMeasures },
  },
  {
    caseId: "advanced-right-altitude",
    title: "Đường cao trong tam giác vuông",
    problem: "Tam giác ABC vuông tại A, AH vuông góc BC.",
    intent: { ...base, grade: 9, difficulty: "HARD", family: "ADVANCED_GEOMETRY", archetype: "RIGHT_TRIANGLE_ALTITUDE", variant: "ALTITUDE_TO_HYPOTENUSE", pointLabels: ["A", "B", "C", "H"], measures: geometryMeasures },
  },
  {
    caseId: "advanced-tangent",
    title: "Tiếp tuyến đường tròn",
    problem: "Vẽ tiếp tuyến tại A của đường tròn tâm O.",
    intent: { ...base, grade: 9, difficulty: "MEDIUM", family: "ADVANCED_GEOMETRY", archetype: "CIRCLE_RELATIONS", variant: "TANGENT", pointLabels: ["O", "A", "B", "C"], measures: geometryMeasures },
  },
  {
    caseId: "advanced-chords",
    title: "Hai dây cắt nhau",
    problem: "Hai dây AB và CD của đường tròn tâm O cắt nhau tại I.",
    intent: { ...base, grade: 9, difficulty: "HARD", family: "ADVANCED_GEOMETRY", archetype: "CIRCLE_RELATIONS", variant: "INTERSECTING_CHORDS", pointLabels: ["O", "A", "B", "C", "D", "I"], measures: geometryMeasures },
  },
  {
    caseId: "advanced-cyclic",
    title: "Tứ giác nội tiếp",
    problem: "Vẽ tứ giác ABCD nội tiếp đường tròn tâm O.",
    intent: { ...base, grade: 9, difficulty: "HARD", family: "ADVANCED_GEOMETRY", archetype: "CIRCLE_RELATIONS", variant: "CYCLIC_QUADRILATERAL", pointLabels: ["O", "A", "B", "C", "D"], measures: geometryMeasures },
  },
  {
    caseId: "advanced-incircle",
    title: "Đường tròn nội tiếp",
    problem: "Vẽ đường tròn tâm I nội tiếp tam giác ABC.",
    intent: { ...base, grade: 9, difficulty: "HARD", family: "ADVANCED_GEOMETRY", archetype: "CIRCLE_RELATIONS", variant: "INCIRCLE", pointLabels: ["A", "B", "C", "I"], measures: geometryMeasures },
  },
  {
    caseId: "advanced-circumcircle",
    title: "Đường tròn ngoại tiếp",
    problem: "Vẽ đường tròn tâm O ngoại tiếp tam giác ABC.",
    intent: { ...base, grade: 9, difficulty: "HARD", family: "ADVANCED_GEOMETRY", archetype: "CIRCLE_RELATIONS", variant: "CIRCUMCIRCLE", pointLabels: ["O", "A", "B", "C"], measures: geometryMeasures },
  },
  {
    caseId: "advanced-central-inscribed-angles",
    title: "Góc ở tâm và góc nội tiếp",
    problem: "Cùng chắn cung AB, góc ở tâm AOB bằng 80° và góc nội tiếp ACB bằng 40°.",
    intent: { ...base, grade: 9, difficulty: "HARD", family: "ADVANCED_GEOMETRY", archetype: "CIRCLE_RELATIONS", variant: "CENTRAL_INSCRIBED_ANGLES", pointLabels: ["O", "A", "B", "C"], measures: [{ target: "CENTRAL", text: "80°" }, { target: "INSCRIBED", text: "40°" }] },
  },
  {
    caseId: "advanced-two-circles",
    title: "Hai đường tròn cắt nhau",
    problem: "Hai đường tròn tâm O và I cắt nhau tại A, B.",
    intent: { ...base, grade: 9, difficulty: "HARD", family: "ADVANCED_GEOMETRY", archetype: "CIRCLE_RELATIONS", variant: "TWO_CIRCLES", pointLabels: ["O", "I", "A", "B"], measures: geometryMeasures },
  },
  {
    caseId: "advanced-similarity-aa",
    title: "Hai tam giác đồng dạng theo góc–góc",
    problem: "Minh họa hai tam giác ABC và DEF đồng dạng theo trường hợp góc–góc.",
    intent: { ...base, grade: 8, difficulty: "MEDIUM", family: "ADVANCED_GEOMETRY", archetype: "TRIANGLE_SIMILARITY", variant: "AA_SIMILARITY", pointLabels: ["A", "B", "C", "D", "E", "F"], measures: geometryMeasures },
  },
  {
    caseId: "advanced-similarity-sas",
    title: "Hai tam giác đồng dạng theo cạnh–góc–cạnh",
    problem: "Minh họa hai tam giác có hai cặp cạnh tỉ lệ và góc xen giữa bằng nhau.",
    intent: { ...base, grade: 8, difficulty: "HARD", family: "ADVANCED_GEOMETRY", archetype: "TRIANGLE_SIMILARITY", variant: "SAS_SIMILARITY", pointLabels: ["A", "B", "C", "D", "E", "F"], measures: [{ target: "AB", text: "4" }, { target: "AC", text: "3" }, { target: "DE", text: "8" }, { target: "DF", text: "6" }] },
  },
  {
    caseId: "advanced-similarity-sss",
    title: "Hai tam giác đồng dạng theo cạnh–cạnh–cạnh",
    problem: "Minh họa hai tam giác có ba cặp cạnh tương ứng tỉ lệ 1:2.",
    intent: { ...base, grade: 8, difficulty: "HARD", family: "ADVANCED_GEOMETRY", archetype: "TRIANGLE_SIMILARITY", variant: "SSS_SIMILARITY", pointLabels: ["A", "B", "C", "D", "E", "F"], measures: [{ target: "AB", text: "4" }, { target: "AC", text: "3" }, { target: "BC", text: "5" }, { target: "DE", text: "8" }, { target: "DF", text: "6" }, { target: "EF", text: "10" }] },
  },
  {
    caseId: "spatial-cuboid",
    title: "Hình hộp chữ nhật",
    problem: "Vẽ hình hộp chữ nhật ABCD.EFGH.",
    intent: { ...base, grade: 7, difficulty: "MEDIUM", family: "SPATIAL_APPLIED", archetype: "CUBOID", variant: "RECTANGULAR_PRISM", pointLabels: ["A", "B", "C", "D", "E", "F", "G", "H"], dimensions: spatialDimensions },
  },
  {
    caseId: "spatial-cube",
    title: "Hình lập phương",
    problem: "Vẽ hình lập phương ABCD.EFGH.",
    intent: { ...base, grade: 7, difficulty: "MEDIUM", family: "SPATIAL_APPLIED", archetype: "CUBOID", variant: "CUBE", pointLabels: ["A", "B", "C", "D", "E", "F", "G", "H"], dimensions: [] },
  },
  {
    caseId: "spatial-triangular-prism",
    title: "Lăng trụ đứng tam giác",
    problem: "Vẽ lăng trụ đứng tam giác ABC.A'B'C', phân biệt cạnh thấy và cạnh khuất.",
    intent: { ...base, grade: 7, difficulty: "MEDIUM", family: "SPATIAL_APPLIED", archetype: "PRISM_OR_PYRAMID", variant: "TRIANGULAR_PRISM", pointLabels: ["A", "B", "C", "A'", "B'", "C'"], dimensions: [] },
  },
  {
    caseId: "spatial-pyramid",
    title: "Hình chóp tứ giác đều",
    problem: "Vẽ hình chóp S.ABCD có đáy ABCD là hình vuông, phân biệt cạnh thấy và cạnh khuất.",
    intent: { ...base, grade: 8, difficulty: "HARD", family: "SPATIAL_APPLIED", archetype: "PRISM_OR_PYRAMID", variant: "PYRAMID", pointLabels: ["A", "B", "C", "D", "S"], dimensions: [] },
  },
  {
    caseId: "spatial-triangular-pyramid",
    title: "Hình chóp tam giác",
    problem: "Vẽ hình chóp S.ABC, phân biệt cạnh thấy và cạnh khuất.",
    intent: { ...base, grade: 8, difficulty: "HARD", family: "SPATIAL_APPLIED", archetype: "PRISM_OR_PYRAMID", variant: "TRIANGULAR_PYRAMID", pointLabels: ["A", "B", "C", "S"], dimensions: [] },
  },
  {
    caseId: "spatial-cube-net",
    title: "Hình khai triển của hình lập phương",
    problem: "Vẽ một hình khai triển gồm sáu hình vuông bằng nhau của hình lập phương.",
    intent: { ...base, grade: 5, difficulty: "MEDIUM", family: "SPATIAL_APPLIED", archetype: "NET", variant: "CUBE_NET", pointLabels: [], dimensions: [] },
  },
  {
    caseId: "spatial-cuboid-net",
    title: "Hình khai triển của hình hộp chữ nhật",
    problem: "Vẽ hình khai triển sáu mặt của hình hộp chữ nhật.",
    intent: { ...base, grade: 7, difficulty: "HARD", family: "SPATIAL_APPLIED", archetype: "NET", variant: "CUBOID_NET", pointLabels: [], dimensions: [] },
  },
  {
    caseId: "spatial-cylinder",
    title: "Hình trụ",
    problem: "Vẽ hình trụ có bán kính 3 cm và chiều cao 5 cm.",
    intent: { ...base, grade: 9, difficulty: "MEDIUM", family: "SPATIAL_APPLIED", archetype: "CYLINDER", variant: "CYLINDER", pointLabels: ["O", "O′", "A"], dimensions: [{ target: "radius", value: 3, unit: "cm" }, { target: "height", value: 5, unit: "cm" }] },
  },
  {
    caseId: "spatial-cone",
    title: "Hình nón",
    problem: "Vẽ hình nón có bán kính r và chiều cao h.",
    intent: { ...base, grade: 9, difficulty: "MEDIUM", family: "SPATIAL_APPLIED", archetype: "CONE_OR_SPHERE", variant: "CONE", pointLabels: ["O", "S", "A"], dimensions: [{ target: "radius", value: 3, unit: "cm" }, { target: "height", value: 6, unit: "cm" }] },
  },
  {
    caseId: "spatial-sphere",
    title: "Hình cầu",
    problem: "Vẽ hình cầu tâm O bán kính 3 cm.",
    intent: { ...base, grade: 9, difficulty: "MEDIUM", family: "SPATIAL_APPLIED", archetype: "CONE_OR_SPHERE", variant: "SPHERE", pointLabels: ["O", "A"], dimensions: [{ target: "radius", value: 3, unit: "cm" }] },
  },
  {
    caseId: "spatial-ladder",
    title: "Bài toán chiếc thang",
    problem: "Một chiếc thang dài 5 m tựa vào tường, chân thang cách tường 3 m.",
    intent: { ...base, grade: 9, difficulty: "HARD", family: "SPATIAL_APPLIED", archetype: "APPLIED_RIGHT_TRIANGLE", variant: "LADDER", pointLabels: ["H", "B", "A"], dimensions: [{ target: "ladder", value: 5, unit: "m" }, { target: "ground", value: 3, unit: "m" }] },
  },
  {
    caseId: "spatial-shadow",
    title: "Bài toán bóng nắng",
    problem: "Cột cờ cao 4 m tạo bóng dài 3 m trên mặt đất.",
    intent: { ...base, grade: 9, difficulty: "HARD", family: "SPATIAL_APPLIED", archetype: "APPLIED_RIGHT_TRIANGLE", variant: "SHADOW", pointLabels: ["H", "B", "A"], dimensions: [{ target: "height", value: 4, unit: "m" }, { target: "ground", value: 3, unit: "m" }] },
  },
  {
    caseId: "schematic-venn",
    title: "Sơ đồ Venn hai tập hợp",
    problem: "Biểu diễn hai tập hợp A, B có phần giao.",
    intent: { ...base, grade: 6, difficulty: "SIMPLE", family: "SET_SCHEMATIC", archetype: "VENN", nodes: [{ id: "aOnly", label: "2", group: "A" }, { id: "intersection", label: "6", group: "A&B" }, { id: "bOnly", label: "9", group: "B" }], edges: [], setLabels: ["A", "B"] },
  },
  {
    caseId: "schematic-venn-three-sets",
    title: "Sơ đồ Venn ba tập hợp",
    problem: "Biểu diễn phần giao của ba tập hợp A, B, C.",
    intent: { ...base, grade: 7, difficulty: "HARD", family: "SET_SCHEMATIC", archetype: "VENN", nodes: [{ id: "a", label: "1", group: "A" }, { id: "ab", label: "2", group: "A&B" }, { id: "abc", label: "3", group: "A&B&C" }, { id: "c", label: "4", group: "C" }], edges: [], setLabels: ["A", "B", "C"] },
  },
  {
    caseId: "schematic-venn-universe",
    title: "Sơ đồ Venn trong tập vũ trụ",
    problem: "Biểu diễn hai tập A, B trong tập vũ trụ U và phần giao A ∩ B.",
    intent: { ...base, grade: 6, difficulty: "MEDIUM", family: "SET_SCHEMATIC", archetype: "VENN_UNIVERSE", nodes: [{ id: "a", label: "2", group: "A" }, { id: "ab", label: "6", group: "A&B" }, { id: "b", label: "9", group: "B" }], edges: [], setLabels: ["U", "A", "B"] },
  },
  {
    caseId: "schematic-tree",
    title: "Sơ đồ cây xác suất",
    problem: "Mô tả hai kết quả khi tung một đồng xu.",
    intent: { ...base, grade: 8, difficulty: "MEDIUM", family: "SET_SCHEMATIC", archetype: "TREE", nodes: [{ id: "root", label: "Bắt đầu", group: null }, { id: "heads", label: "Ngửa", group: null }, { id: "tails", label: "Sấp", group: null }], edges: [{ from: "root", to: "heads", label: "1/2" }, { from: "root", to: "tails", label: "1/2" }], setLabels: [] },
  },
  {
    caseId: "schematic-flow",
    title: "Sơ đồ quy trình",
    problem: "Mô tả quy trình đo và tính chu vi hình chữ nhật.",
    intent: { ...base, grade: 4, difficulty: "MEDIUM", family: "SET_SCHEMATIC", archetype: "FLOW", nodes: [{ id: "start", label: "Đo", group: null }, { id: "calculate", label: "Tính", group: null }, { id: "result", label: "Kết quả", group: null }], edges: [{ from: "start", to: "calculate", label: null }, { from: "calculate", to: "result", label: null }], setLabels: [] },
  },
  {
    caseId: "schematic-network",
    title: "Sơ đồ mạng đường đi",
    problem: "Tìm đường đi ngắn qua các điểm A, B, C, D.",
    intent: { ...base, grade: 8, difficulty: "HARD", family: "SET_SCHEMATIC", archetype: "NETWORK", nodes: [{ id: "A", label: "A", group: null }, { id: "B", label: "B", group: null }, { id: "C", label: "C", group: null }, { id: "D", label: "D", group: null }], edges: [{ from: "A", to: "B", label: "4" }, { from: "A", to: "C", label: "3" }, { from: "B", to: "D", label: "2" }, { from: "C", to: "D", label: "5" }], setLabels: [] },
  },
] satisfies SemanticDiagramVisualCase[];
