import type { LessonSummaryDiagramSpec } from "@learning-path/shared";

import type { RetrievedChunk } from "#api/modules/ai/types/ai-text.types";
import type {
  LessonSummaryMvpBlock,
  LessonSummaryOutput,
  LessonSummaryProviderOutput,
  LessonSummaryWarningDetail,
} from "#api/modules/ai/types/lesson-summary.types";
import {
  buildLessonSummarySourceTopics,
  isLessonSummaryRealWorldCandidate,
} from "#api/modules/ai/utils/lesson-summary-source-candidates";

const EXERCISE_HEADING_PATTERN =
  /^(?:ví\s*dụ|luyện\s*tập|vận\s*dụng|bài\s*tập|ứng\s*dụng\s*thực\s*tế)(?:\s|$|[:：.-])/iu;
const FORBIDDEN_THEORY_LABEL_PATTERN =
  /(?:(?:ví\s*dụ|chẳng\s*hạn|chú\s*ý|lưu\s*ý|nhận\s*xét)(?:\s+\d+)?\s*[:：]|(?:^|\n)\s*(?:[-*+]\s*)?(?:\*\*|__)?(?:luyện\s*tập|vận\s*dụng|bài\s*tập)(?:\s+\d+)?\s*(?:[:：.-]|$))/imu;
const NOTE_EXAMPLE_PATTERN = /(?:ví\s*dụ|chẳng\s*hạn)\s*[:：]?/iu;
const SOURCE_IMAGE_PATTERN =
  /!\[[^\]]*\]\([^)]*\)|<img\b[^>]*>|\\includegraphics(?:\[[^\]]*\])?\{[^}]*\}|\\begin\{figure\}[\s\S]*?\\end\{figure\}/giu;
const SOURCE_FIGURE_REFERENCE_PATTERN =
  /\b(?:xem|quan\s*sát|dựa\s*vào)\s+(?:hình|hình\s*vẽ|sơ\s*đồ)(?:\s+(?:bên|dưới|trên|sau|kèm\s*theo|sau\s*đây))?\b/iu;
const PARENTHESIZED_SOURCE_FIGURE_REFERENCE_PATTERN =
  /\s*\((?:xem|quan\s*sát|dựa\s*vào)\s+(?:hình|hình\s*vẽ|sơ\s*đồ)[^)]*\)/giu;
const SOURCE_EXERCISE_LABEL_PATTERN =
  /^\s*(?:(?:bài|ví\s*dụ|luyện\s*tập|vận\s*dụng|thực\s*hành)\s*\d+(?:[.,]\d+)*(?:\s*[:.])?\s*)/iu;
const REDUNDANT_SOLUTION_CONCLUSION_PATTERN =
  /(?:^|\n)\s*(?:kết\s*luận|đáp\s*số)\s*:[^\n]*(?=\n|$)/giu;
const LEADING_HEADING_NUMBER_PATTERN = /^\s*(?:§\s*)?\d+(?:[.,]\d+)*(?:\s*[:.)-])?\s+/u;

type ProviderExample =
  | LessonSummaryProviderOutput["theorySections"][number]["units"][number]["illustration"]
  | LessonSummaryProviderOutput["applicationExercises"]["standardExercise"]
  | LessonSummaryProviderOutput["applicationExercises"]["realWorldExercise"];

type MapLessonSummaryProviderOutputInput = {
  lessonId: string;
  output: LessonSummaryProviderOutput;
  contextChunks: RetrievedChunk[];
};

export function mapLessonSummaryProviderOutput(
  input: MapLessonSummaryProviderOutputInput,
): LessonSummaryOutput {
  const warningDetails: LessonSummaryWarningDetail[] = [];
  const addWarning = (
    code: string,
    path: string,
    message: string,
    severity: LessonSummaryWarningDetail["severity"] = "WARNING",
  ) => {
    warningDetails.push({ code, path, message, severity });
  };
  const chunksById = new Map(
    input.contextChunks.map((chunk) => [chunk.id, chunk] as const),
  );
  const sourceTopics = buildLessonSummarySourceTopics(input.contextChunks);
  const topicsById = new Map(sourceTopics.map((topic) => [topic.id, topic] as const));
  const fallbackSourceChunkId = input.contextChunks[0]?.id;
  const usedTopics = new Map<string, string>();

  if (sourceTopics.length === 0) {
    addWarning(
      "SOURCE_TOPIC_NOT_EXTRACTED",
      "theorySections",
      "Context không tạo được source topic chắc chắn; admin cần đối chiếu các đề mục lớn với tài liệu nguồn.",
    );
  }

  input.output.theorySections.forEach((section, sectionIndex) => {
    const sectionPath = `theorySections.${sectionIndex}`;
    const sourceTopic = topicsById.get(section.sourceTopicId);
    if (!sourceTopic) {
      addWarning(
        "SOURCE_TOPIC_UNKNOWN",
        `${sectionPath}.sourceTopicId`,
        "sourceTopicId không có trong context.",
      );
    } else {
      const duplicatePath = usedTopics.get(section.sourceTopicId);
      if (duplicatePath) {
        addWarning(
          "SOURCE_TOPIC_DUPLICATED",
          `${sectionPath}.sourceTopicId`,
          `sourceTopicId trùng với ${duplicatePath}.`,
        );
      } else {
        usedTopics.set(section.sourceTopicId, sectionPath);
      }
    }
    validateSourceIds(
      `${sectionPath}.sourceChunkIds`,
      section.sourceChunkIds,
      chunksById,
      addWarning,
    );
    if (EXERCISE_HEADING_PATTERN.test(section.displayHeading)) {
      addWarning(
        "THEORY_SECTION_USES_EXERCISE_HEADING",
        `${sectionPath}.displayHeading`,
        "Section lý thuyết đang dùng heading bài tập.",
      );
    }
    section.units.forEach((unit, unitIndex) => {
      const unitPath = `${sectionPath}.units.${unitIndex}`;
      validateSourceIds(
        `${unitPath}.theory.sourceChunkIds`,
        unit.theory.sourceChunkIds,
        chunksById,
        addWarning,
      );
      validateTheoryContent(unit.theory, `${unitPath}.theory`, addWarning);
      if (unit.theory.diagramSpec) {
        validateDiagramReferences(
          unit.theory.diagramSpec,
          `${unitPath}.theory.diagramSpec`,
          addWarning,
        );
      }
      validateExample(unit.illustration, `${unitPath}.illustration`, addWarning);

      unit.notes.forEach((note, noteIndex) => {
        const notePath = `${unitPath}.notes.${noteIndex}`;
        validateSourceIds(
          `${notePath}.sourceChunkIds`,
          note.sourceChunkIds,
          chunksById,
          addWarning,
        );
        if (!NOTE_EXAMPLE_PATTERN.test(note.content)) {
          addWarning(
            "NOTE_MISSING_INLINE_EXAMPLE",
            `${notePath}.content`,
            "note.content phải có một ví dụ ngắn.",
          );
        }
      });
    });
  });

  sourceTopics
    .map((topic) => topic.id)
    .filter((topicId) => !usedTopics.has(topicId))
    .forEach((topicId) => {
      addWarning(
        "SOURCE_TOPIC_OMITTED",
        "theorySections",
        `Output bỏ sót sourceTopicId ${topicId}.`,
      );
    });

  const application = input.output.applicationExercises;
  validateExample(
    application.standardExercise,
    "applicationExercises.standardExercise",
    addWarning,
  );
  validateExample(
    application.realWorldExercise,
    "applicationExercises.realWorldExercise",
    addWarning,
  );

  const mappedTheorySections = input.output.theorySections.map(
    (section, sectionIndex) => {
      const topic = topicsById.get(section.sourceTopicId);
      const sourceHeading = topic?.sourceHeadingRaw ?? section.displayHeading;
      const displayHeading = normalizeDisplayHeading(section.displayHeading);
      const sectionSourceChunkIds = safeSourceIds(
        [topic?.sourceChunkId, ...section.sourceChunkIds],
        chunksById,
        fallbackSourceChunkId,
      );
      return {
        sourceTopicId: section.sourceTopicId,
        section: {
          order: sectionIndex + 1,
          sourceHeading,
          displayHeading,
          sourceChunkIds: sectionSourceChunkIds,
          blocks: section.units.flatMap((unit) => {
            const theory = normalizeTheoryBlock(
              unit.theory,
              chunksById,
              sectionSourceChunkIds[0],
            );
            const illustration = toPersistedExample(unit.illustration);
            const notes = unit.notes.map((note) => ({
              ...note,
              content: normalizeGeneratedText(note.content),
              sourceChunkIds: safeSourceIds(
                note.sourceChunkIds,
                chunksById,
                sectionSourceChunkIds[0],
              ),
            }));
            return [theory, illustration, ...notes];
          }),
        },
      };
    },
  );
  const theorySections: LessonSummaryOutput["sections"] = [];
  const theorySectionIndexByTopicId = new Map<string, number>();
  mappedTheorySections.forEach(({ sourceTopicId, section }) => {
    const existingIndex = theorySectionIndexByTopicId.get(sourceTopicId);
    if (existingIndex === undefined) {
      theorySectionIndexByTopicId.set(sourceTopicId, theorySections.length);
      theorySections.push(section);
      return;
    }
    const existing = theorySections[existingIndex];
    if (!existing) return;
    // A source topic is one major section. Keep the first complete occurrence so
    // a duplicated provider section cannot repeat all theory/example pairs in UI.
  });
  theorySections.forEach((section, index) => {
    section.order = index + 1;
  });

  const applicationSourceChunkIds = safeSourceIds(
    [fallbackSourceChunkId],
    chunksById,
    fallbackSourceChunkId,
  );
  const persistedStandard = toPersistedExample(application.standardExercise);
  const persistedRealWorld = toPersistedExample(application.realWorldExercise);
  if (
    persistedRealWorld.type === "example" &&
    !isLessonSummaryRealWorldCandidate(persistedRealWorld.problem)
  ) {
    addWarning(
      "REAL_WORLD_CONTEXT_UNCLEAR",
      "applicationExercises.realWorldExercise.problem",
      "Bài cuối chưa thể hiện rõ ngữ cảnh đời sống hoặc dữ liệu thực tế.",
    );
  }
  if (
    persistedStandard.type === "example" &&
    isLessonSummaryRealWorldCandidate(persistedStandard.problem)
  ) {
    addWarning(
      "STANDARD_EXERCISE_LOOKS_REAL_WORLD",
      "applicationExercises.standardExercise.problem",
      "Bài tập thông thường đang có dấu hiệu là bài toán thực tế.",
    );
  }

  return {
    lessonId: input.lessonId,
    title: input.output.title,
    objectives: input.output.objectives,
    sections: [
      ...theorySections,
      {
        order: theorySections.length + 1,
        sourceHeading: "Bài tập vận dụng",
        displayHeading: "Bài tập vận dụng",
        sourceChunkIds: applicationSourceChunkIds,
        blocks: [persistedStandard, persistedRealWorld],
      },
    ],
  };
}

type AddWarning = (
  code: string,
  path: string,
  message: string,
  severity?: LessonSummaryWarningDetail["severity"],
) => void;

function validateTheoryContent(
  block: LessonSummaryProviderOutput["theorySections"][number]["units"][number]["theory"],
  path: string,
  addWarning: AddWarning,
) {
  const values =
    block.type === "procedure"
      ? [block.purpose ?? "", ...block.steps.map((step) => step.content)]
      : [block.content];
  if (values.some((value) => FORBIDDEN_THEORY_LABEL_PATTERN.test(value))) {
    addWarning(
      "THEORY_CONTAINS_EXAMPLE",
      path,
      "Khối lý thuyết đang trộn ví dụ/bài tập/ghi chú vào field nội dung.",
    );
  }
  values.forEach((value) => {
    const sentenceCount = value
      .split(/[.!?](?=\s|$)/u)
      .map((sentence) => sentence.trim())
      .filter(Boolean).length;
    if (value.length >= 240 && sentenceCount >= 3 && !value.includes("\n")) {
      addWarning(
        "THEORY_PARAGRAPH_TOO_DENSE",
        path,
        "Nội dung dồn nhiều ý vào một paragraph dài; phải xuống dòng hoặc dùng bullet theo từng ý.",
      );
    }
  });
}

function validateExample(example: ProviderExample, path: string, addWarning: AddWarning) {
  if (SOURCE_FIGURE_REFERENCE_PATTERN.test(example.problem)) {
    addWarning(
      "EXAMPLE_REFERENCES_SOURCE_FIGURE",
      `${path}.problem`,
      "Đề bài còn tham chiếu hình của tài liệu nguồn; cần tự đủ dữ kiện hoặc có diagramSpec chính xác.",
    );
  }
  if (
    /^(?:thực hiện|sử dụng|dựa vào|quan sát|làm theo|tính theo|kết quả tùy|theo yêu cầu|nếu (?:hình|ta có))/iu.test(
      example.answer.trim(),
    )
  ) {
    addWarning(
      "ANSWER_NOT_CONCRETE",
      `${path}.answer`,
      "Đáp án còn chung chung, chưa nêu kết quả cụ thể của đề.",
    );
  }
  const solution = example.solution ?? "";
  if (
    hasUnsafeControlCharacters(example.answer) ||
    hasUnsafeControlCharacters(solution) ||
    hasUnsafeControlCharacters(example.problem)
  ) {
    addWarning(
      "MATH_CONTROL_CHARACTER_NORMALIZED",
      path,
      "Nội dung có ký tự điều khiển do LaTeX escape sai; backend đã chuẩn hóa và admin cần kiểm tra công thức.",
      "INFO",
    );
  }
  validateExampleSubparts(example.problem, solution, example.answer, path, addWarning);
  const solutionSentenceCount = solution
    .split(/[.!?](?=\s|$)/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;
  if (solution.length >= 240 && solutionSentenceCount >= 3 && !solution.includes("\n")) {
    addWarning(
      "SOLUTION_PARAGRAPH_TOO_DENSE",
      `${path}.solution`,
      "Lời giải nên ngắt dòng theo từng bước lập luận.",
    );
  }
  if (example.diagramSpec) {
    validateDiagramReferences(example.diagramSpec, `${path}.diagramSpec`, addWarning);
  }
}

function validateExampleSubparts(
  problem: string,
  solution: string,
  answer: string,
  path: string,
  addWarning: AddWarning,
) {
  const subparts = [
    ...new Set(
      [...problem.matchAll(/(?:^|\n|\s)([a-h])\)\s/giu)].map((match) =>
        match[1]!.toLocaleLowerCase("vi"),
      ),
    ),
  ];
  if (subparts.length < 2) return;
  const response = `${solution}\n${answer}`;
  const missing = subparts.filter(
    (subpart) => !new RegExp(`(?:^|\\n|\\s|;)${subpart}\\)`, "iu").test(response),
  );
  if (missing.length > 0) {
    addWarning(
      "EXAMPLE_SUBPARTS_INCOMPLETE",
      path,
      `Lời giải/đáp án chưa thể hiện đủ các ý: ${missing.map((value) => `${value})`).join(", ")}.`,
    );
  }
}

function validateDiagramReferences(
  spec: LessonSummaryDiagramSpec,
  path: string,
  addWarning: AddWarning,
) {
  const pointIds = new Set<string>();
  const pointsById = new Map(spec.points.map((point) => [point.id, point] as const));
  spec.points.forEach((point) => {
    if (pointIds.has(point.id)) {
      addWarning("DIAGRAM_DUPLICATE_POINT_ID", path, `Point ID ${point.id} bị trùng.`);
    }
    pointIds.add(point.id);
    const { minX, minY, width, height } = spec.viewBox;
    if (
      point.x < minX ||
      point.x > minX + width ||
      point.y < minY ||
      point.y > minY + height
    ) {
      addWarning(
        "DIAGRAM_POINT_OUTSIDE_VIEWBOX",
        path,
        `Point ${point.id} nằm ngoài viewBox nên sơ đồ không thể hiển thị chính xác.`,
      );
    }
  });
  const primitiveIds = new Set<string>();
  const requirePoint = (id: string) => {
    if (!pointIds.has(id)) {
      addWarning(
        "DIAGRAM_UNKNOWN_POINT",
        path,
        `Diagram tham chiếu point ${id} không tồn tại.`,
      );
    }
  };
  spec.primitives.forEach((primitive) => {
    if (primitiveIds.has(primitive.id)) {
      addWarning(
        "DIAGRAM_DUPLICATE_PRIMITIVE_ID",
        path,
        `Primitive ID ${primitive.id} bị trùng.`,
      );
    }
    primitiveIds.add(primitive.id);
    if (
      primitive.type === "SEGMENT" ||
      primitive.type === "LINE" ||
      primitive.type === "RAY"
    ) {
      requirePoint(primitive.from);
      requirePoint(primitive.to);
    } else if (primitive.type === "POLYGON" || primitive.type === "POLYLINE") {
      primitive.pointIds.forEach(requirePoint);
    } else {
      requirePoint(primitive.center);
    }
  });
  spec.markers.forEach((marker) => {
    if (marker.type === "EQUAL_LENGTH" || marker.type === "PARALLEL") {
      const vectors: Array<{ id: string; dx: number; dy: number; length: number }> = [];
      marker.segmentIds.forEach((id) => {
        const primitive = spec.primitives.find((value) => value.id === id);
        if (!primitiveIds.has(id) || !primitive) {
          addWarning(
            "DIAGRAM_UNKNOWN_SEGMENT",
            path,
            `Marker tham chiếu primitive ${id} không tồn tại.`,
          );
          return;
        }
        if (
          primitive.type !== "SEGMENT" &&
          primitive.type !== "LINE" &&
          primitive.type !== "RAY"
        ) {
          addWarning(
            "DIAGRAM_MARKER_REQUIRES_SEGMENT",
            path,
            `Marker ${marker.type} tham chiếu ${id} không phải đoạn/đường/tia.`,
          );
          return;
        }
        const from = pointsById.get(primitive.from);
        const to = pointsById.get(primitive.to);
        if (!from || !to) return;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        vectors.push({ id, dx, dy, length: Math.hypot(dx, dy) });
      });
      if (marker.type === "EQUAL_LENGTH" && vectors.length >= 2) {
        const lengths = vectors.map((vector) => vector.length);
        const largest = Math.max(...lengths);
        const smallest = Math.min(...lengths);
        if (largest === 0 || (largest - smallest) / largest > 0.02) {
          addWarning(
            "DIAGRAM_EQUAL_LENGTH_NOT_TO_SCALE",
            path,
            `Marker bằng nhau tham chiếu các đoạn không cùng độ dài theo tọa độ: ${vectors.map((value) => value.id).join(", ")}.`,
          );
        }
      }
      if (marker.type === "PARALLEL" && vectors.length >= 2) {
        const [first, ...rest] = vectors;
        if (
          first &&
          rest.some((vector) => {
            const denominator = first.length * vector.length;
            return (
              denominator === 0 ||
              Math.abs(first.dx * vector.dy - first.dy * vector.dx) / denominator > 0.02
            );
          })
        ) {
          addWarning(
            "DIAGRAM_PARALLEL_NOT_TO_SCALE",
            path,
            "Marker song song không khớp với hướng của các đoạn theo tọa độ.",
          );
        }
      }
      return;
    }
    requirePoint(marker.vertex);
    marker.armPointIds.forEach(requirePoint);
    if (marker.type === "RIGHT_ANGLE") {
      const vertex = pointsById.get(marker.vertex);
      const first = pointsById.get(marker.armPointIds[0]!);
      const second = pointsById.get(marker.armPointIds[1]!);
      if (vertex && first && second) {
        const firstVector = { x: first.x - vertex.x, y: first.y - vertex.y };
        const secondVector = { x: second.x - vertex.x, y: second.y - vertex.y };
        const denominator =
          Math.hypot(firstVector.x, firstVector.y) *
          Math.hypot(secondVector.x, secondVector.y);
        const normalizedDot =
          denominator === 0
            ? 1
            : Math.abs(firstVector.x * secondVector.x + firstVector.y * secondVector.y) /
              denominator;
        if (normalizedDot > 0.02) {
          addWarning(
            "DIAGRAM_RIGHT_ANGLE_NOT_TO_SCALE",
            path,
            `Marker vuông tại ${marker.vertex} không khớp góc 90° theo tọa độ.`,
          );
        }
      }
    }
  });
  spec.labels.forEach((label) => requirePoint(label.anchorPointId));
}

function validateSourceIds(
  path: string,
  sourceChunkIds: string[],
  chunksById: Map<string, RetrievedChunk>,
  addWarning: AddWarning,
) {
  const invalidIds = sourceChunkIds.filter((id) => !chunksById.has(id));
  if (invalidIds.length > 0) {
    addWarning(
      "SOURCE_CHUNK_OUTSIDE_CONTEXT",
      path,
      `Chứa ID ngoài context: ${invalidIds.join(", ")}.`,
    );
  }
}

function uniqueSourceIds(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function safeSourceIds(
  values: Array<string | undefined>,
  chunksById: Map<string, RetrievedChunk>,
  fallbackSourceChunkId?: string,
) {
  const validIds = uniqueSourceIds(values).filter((value) => chunksById.has(value));
  if (validIds.length > 0) return validIds.slice(0, 20);
  return fallbackSourceChunkId ? [fallbackSourceChunkId] : [];
}

function normalizeTheoryBlock(
  block: LessonSummaryProviderOutput["theorySections"][number]["units"][number]["theory"],
  chunksById: Map<string, RetrievedChunk>,
  fallbackSourceChunkId?: string,
): LessonSummaryMvpBlock {
  const sourceChunkIds = safeSourceIds(
    block.sourceChunkIds,
    chunksById,
    fallbackSourceChunkId,
  );
  const visual = block.diagramSpec
    ? { visual: { kind: "DIAGRAM_SPEC" as const, spec: block.diagramSpec } }
    : {};

  switch (block.type) {
    case "procedure":
      return {
        type: block.type,
        title: block.title,
        purpose: block.purpose ? normalizeGeneratedText(block.purpose) : null,
        sourceChunkIds,
        steps: block.steps.map((step, index) => ({
          ...step,
          order: index + 1,
          content: normalizeGeneratedText(step.content),
        })),
        ...visual,
      };
    case "knowledge":
    case "property":
    case "theorem":
      return {
        type: block.type,
        title: block.title,
        content: normalizeGeneratedText(block.content),
        sourceChunkIds,
        ...visual,
      };
  }
}

function toPersistedExample(example: ProviderExample): LessonSummaryMvpBlock {
  const problem = stripSourceImages(example.problem);
  return {
    type: "example",
    problem:
      problem.length >= 8
        ? problem
        : "[Cần admin bổ sung đề bài tự đủ dữ kiện, không phụ thuộc hình nguồn]",
    solution: normalizeSolution(example.solution),
    answer: normalizeGeneratedText(example.answer),
    ...(example.diagramSpec
      ? { visual: { kind: "DIAGRAM_SPEC" as const, spec: example.diagramSpec } }
      : {}),
  };
}

function stripSourceImages(value: string) {
  return normalizeGeneratedText(
    value
      .replace(SOURCE_IMAGE_PATTERN, "")
      .replace(PARENTHESIZED_SOURCE_FIGURE_REFERENCE_PATTERN, "")
      .replace(SOURCE_EXERCISE_LABEL_PATTERN, "")
      .replace(/\[Hình nguồn đã được lược bỏ\]/giu, "")
      .replace(/\n{3,}/gu, "\n\n"),
  );
}

function normalizeSolution(value: string | null) {
  if (!value) return null;
  const normalized = normalizeGeneratedText(
    value.replace(REDUNDANT_SOLUTION_CONCLUSION_PATTERN, ""),
  );
  return normalized || null;
}

function normalizeGeneratedText(value: string) {
  const repairedLatex = value
    .replace(/\u001chat(?=\{)/gu, "\\widehat")
    .replace(/\u001b0/gu, "\\circ");

  return [...repairedLatex]
    .map((character) => {
      const code = character.charCodeAt(0);
      if (code === 7) return "\\";
      return isUnsafeControlCode(code) ? "" : character;
    })
    .join("")
    .trim();
}

function normalizeDisplayHeading(value: string) {
  return normalizeGeneratedText(value).replace(LEADING_HEADING_NUMBER_PATTERN, "");
}

function hasUnsafeControlCharacters(value: string) {
  return [...value].some((character) => isUnsafeControlCode(character.charCodeAt(0)));
}

function isUnsafeControlCode(code: number) {
  return (
    (code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31)
  );
}
