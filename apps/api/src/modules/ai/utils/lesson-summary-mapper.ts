import { createHash } from "node:crypto";
import {
  normalizeLessonSummaryDiagramSpec,
  type LessonSummaryDiagramSpec,
} from "@learning-path/shared";

import type { RetrievedChunk } from "#api/modules/ai/types/ai-text.types";
import { compileLessonSummaryDiagramIntentWithDiagnostics } from "#api/modules/ai/utils/diagram-compilers/compile-diagram-intent";
import {
  mapLessonSummaryProviderDiagramInput,
  type LessonSummaryProviderDiagramInput,
} from "#api/modules/ai/types/lesson-summary-provider-diagram.types";
import {
  resolveLessonSummaryReviewIssueResolution,
  type LessonSummaryMvpBlock,
  type LessonSummaryOutput,
  type LessonSummaryProviderOutput,
  type LessonSummaryWarningDetail,
} from "#api/modules/ai/types/lesson-summary.types";
import {
  buildLessonSummarySourceTopics,
  isLessonSummaryRealWorldCandidate,
} from "#api/modules/ai/utils/lesson-summary-source-candidates";
import type { LessonSummaryReviewIssueDraft } from "#api/modules/ai/utils/lesson-summary-recovery";
import {
  describeLessonSummaryDiagramReviewIssue,
  simplifyLessonSummaryReviewCopy,
} from "#api/modules/ai/utils/lesson-summary-review-copy";

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
const GEOMETRY_SOLUTION_PATTERN =
  /\b(?:tam\s*giác|góc|cạnh|đoạn\s*thẳng|đường\s*thẳng|tia|trung\s*điểm|vuông|song\s*song|đường\s*tròn|cung\s*tròn)\b/iu;

type ProviderExample =
  | LessonSummaryProviderOutput["theorySections"][number]["units"][number]["illustration"]
  | LessonSummaryProviderOutput["applicationExercises"]["standardExercise"]
  | LessonSummaryProviderOutput["applicationExercises"]["realWorldExercise"];

type MapLessonSummaryProviderOutputInput = {
  lessonId: string;
  output: LessonSummaryProviderOutput;
  contextChunks: RetrievedChunk[];
  reviewIssuesByPath?: Map<string, LessonSummaryReviewIssueDraft[]>;
  rootReviewIssues?: LessonSummaryReviewIssueDraft[];
};

export function mapLessonSummaryProviderOutput(
  input: MapLessonSummaryProviderOutputInput,
): LessonSummaryOutput {
  const runtimeReviewIssuesByPath = new Map(
    [...(input.reviewIssuesByPath?.entries() ?? [])].map(([path, issues]) => [
      path,
      [...issues],
    ]),
  );
  const addRuntimeReviewIssue = (
    providerPath: string,
    issue: LessonSummaryReviewIssueDraft,
  ) => {
    const current = runtimeReviewIssuesByPath.get(providerPath) ?? [];
    if (
      current.some(
        (candidate) => candidate.code === issue.code && candidate.path === issue.path,
      )
    ) {
      return;
    }
    current.push(issue);
    runtimeReviewIssuesByPath.set(providerPath, current);
  };
  const addBlockProcessingIssue = (providerPath: string, error: unknown) => {
    addRuntimeReviewIssue(providerPath, {
      code: "BLOCK_CANNOT_PROCESS",
      path: providerPath,
      message: "Khối này có dữ liệu chưa thể xử lý đầy đủ.",
      suggestion:
        "Kiểm tra các trường của khối theo chi tiết kỹ thuật rồi sửa và lưu lại; các khối khác vẫn được giữ nguyên.",
      technicalDetails: error instanceof Error ? error.message : String(error),
    });
  };
  const safelyValidateBlock = (providerPath: string, validate: () => void) => {
    try {
      validate();
    } catch (error) {
      addBlockProcessingIssue(providerPath, error);
    }
  };
  const diagramCache = new Map<string, LessonSummaryDiagramSpec | null>();
  const resolveDiagram = (
    diagram: LessonSummaryProviderDiagramInput | null,
    providerPath: string,
  ) => {
    if (!diagram) return null;
    if (diagramCache.has(providerPath)) return diagramCache.get(providerPath) ?? null;
    try {
      const compiled =
        "kind" in diagram && diagram.kind === "INTENT"
          ? compileLessonSummaryDiagramIntentWithDiagnostics(diagram.intent)
          : null;
      const spec = normalizeLessonSummaryDiagramSpec(
        compiled?.spec ?? mapLessonSummaryProviderDiagramInput(diagram),
      );
      if (compiled?.semanticIssues.length) {
        const technicalDetails = compiled.semanticIssues
          .slice(0, 12)
          .map((issue) => `${issue.code}: ${issue.message}`)
          .join("\n");
        const copy = describeLessonSummaryDiagramReviewIssue(technicalDetails);
        addRuntimeReviewIssue(providerPath, {
          code: "DIAGRAM_NEEDS_REVIEW",
          path: `${providerPath}.diagramSpec`,
          message:
            copy?.message ??
            "Hình vẽ vẫn hiển thị được nhưng còn chi tiết cần kiểm tra lại.",
          suggestion:
            copy?.suggestion ??
            "Đối chiếu các điểm và nét vẽ với đề bài; sửa hình hoặc chấp nhận nếu hình hiện tại vẫn dùng được.",
          technicalDetails,
        });
      }
      diagramCache.set(providerPath, spec);
      return spec;
    } catch (error) {
      diagramCache.set(providerPath, null);
      addRuntimeReviewIssue(providerPath, {
        code: "DIAGRAM_CANNOT_RENDER",
        path: `${providerPath}.diagramSpec`,
        message: "Hình vẽ thiếu dữ liệu cần thiết nên chưa thể hiển thị an toàn.",
        suggestion:
          "Bổ sung các điểm, cạnh hoặc nhãn còn thiếu trong dữ liệu hình vẽ rồi lưu lại; nội dung chữ và các khối khác vẫn được giữ.",
        technicalDetails: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  };
  const attachReviewIssues = <T extends LessonSummaryMvpBlock>(
    block: T,
    providerPath: string,
  ): T => {
    const drafts = runtimeReviewIssuesByPath.get(providerPath) ?? [];
    if (drafts.length === 0) return block;
    return {
      ...block,
      reviewIssues: drafts.map((issue, issueIndex) => {
        const fingerprint = fingerprintIssueTarget(block, issue);
        const copy = simplifyLessonSummaryReviewCopy(issue);
        return {
          ...issue,
          ...copy,
          id: `${issue.code}-${issueIndex + 1}-${fingerprint.slice(0, 12)}`,
          fingerprint,
          resolution: resolveLessonSummaryReviewIssueResolution(issue.code),
          accepted: false,
        };
      }),
    };
  };
  const safelyMapBlock = <T extends LessonSummaryMvpBlock>(
    providerPath: string,
    mapBlock: () => T,
    fallbackBlock: () => T,
  ) => {
    let block: T;
    try {
      block = mapBlock();
    } catch (error) {
      addBlockProcessingIssue(providerPath, error);
      block = fallbackBlock();
    }
    return attachReviewIssues(block, providerPath);
  };
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
      "Chưa xác định chắc chắn được các chủ đề từ tài liệu nguồn; quản trị viên cần đối chiếu lại các đề mục lớn.",
    );
  }

  input.output.theorySections.forEach((section, sectionIndex) => {
    const sectionPath = `theorySections.${sectionIndex}`;
    const sourceTopic = topicsById.get(section.sourceTopicId);
    if (!sourceTopic) {
      addWarning(
        "SOURCE_TOPIC_UNKNOWN",
        `${sectionPath}.sourceTopicId`,
        "Chủ đề nguồn của đề mục này không có trong tài liệu đã chọn.",
      );
    } else {
      const duplicatePath = usedTopics.get(section.sourceTopicId);
      if (duplicatePath) {
        addWarning(
          "SOURCE_TOPIC_DUPLICATED",
          `${sectionPath}.sourceTopicId`,
          "Chủ đề nguồn của đề mục này đang bị dùng lặp ở một đề mục khác.",
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
        "Đề mục lý thuyết đang dùng tiêu đề của phần bài tập.",
      );
    }
    section.units.forEach((unit, unitIndex) => {
      const unitPath = `${sectionPath}.units.${unitIndex}`;
      const theoryPath = `${unitPath}.theory`;
      const illustrationPath = `${unitPath}.illustration`;
      safelyValidateBlock(theoryPath, () => {
        validateSourceIds(
          `${theoryPath}.sourceChunkIds`,
          unit.theory.sourceChunkIds,
          chunksById,
          addWarning,
        );
        validateTheoryContent(unit.theory, theoryPath, addWarning);
        if (unit.theory.diagramSpec) {
          const diagram = resolveDiagram(unit.theory.diagramSpec, theoryPath);
          if (diagram) {
            validateDiagramReferences(diagram, `${theoryPath}.diagramSpec`, addWarning);
          }
        }
      });
      safelyValidateBlock(illustrationPath, () =>
        validateExample(unit.illustration, illustrationPath, addWarning, resolveDiagram),
      );

      unit.notes.forEach((note, noteIndex) => {
        const notePath = `${unitPath}.notes.${noteIndex}`;
        safelyValidateBlock(notePath, () => {
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
              "Nội dung ghi chú phải có một ví dụ ngắn.",
            );
          }
        });
      });
    });
  });

  sourceTopics
    .map((topic) => topic.id)
    .filter((topicId) => !usedTopics.has(topicId))
    .forEach(() => {
      addWarning(
        "SOURCE_TOPIC_OMITTED",
        "theorySections",
        "Nội dung tạo ra đang bỏ sót một chủ đề có trong tài liệu nguồn.",
      );
    });

  const application = input.output.applicationExercises;
  safelyValidateBlock("applicationExercises.standardExercise", () =>
    validateExample(
      application.standardExercise,
      "applicationExercises.standardExercise",
      addWarning,
      resolveDiagram,
    ),
  );
  safelyValidateBlock("applicationExercises.realWorldExercise", () =>
    validateExample(
      application.realWorldExercise,
      "applicationExercises.realWorldExercise",
      addWarning,
      resolveDiagram,
    ),
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
          blocks: section.units.flatMap((unit, unitIndex) => {
            const unitPath = `theorySections.${sectionIndex}.units.${unitIndex}`;
            const theoryPath = `${unitPath}.theory`;
            const illustrationPath = `${unitPath}.illustration`;
            const theory = safelyMapBlock(
              theoryPath,
              () =>
                normalizeTheoryBlock(
                  unit.theory,
                  chunksById,
                  sectionSourceChunkIds[0],
                  resolveDiagram(unit.theory.diagramSpec, theoryPath),
                ),
              () => fallbackTheoryBlock(unit.theory, sectionSourceChunkIds),
            );
            const illustration = safelyMapBlock(
              illustrationPath,
              () =>
                toPersistedExample(
                  unit.illustration,
                  resolveDiagram(unit.illustration.diagramSpec, illustrationPath),
                ),
              () => fallbackExampleBlock(),
            );
            const notes = unit.notes.map((note, noteIndex) => {
              const notePath = `${unitPath}.notes.${noteIndex}`;
              return safelyMapBlock(
                notePath,
                () => ({
                  ...note,
                  content: normalizeGeneratedText(note.content),
                  sourceChunkIds: safeSourceIds(
                    note.sourceChunkIds,
                    chunksById,
                    sectionSourceChunkIds[0],
                  ),
                }),
                () => fallbackNoteBlock(sectionSourceChunkIds),
              );
            });
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
  const persistedStandard = safelyMapBlock(
    "applicationExercises.standardExercise",
    () =>
      toPersistedExample(
        application.standardExercise,
        resolveDiagram(
          application.standardExercise.diagramSpec,
          "applicationExercises.standardExercise",
        ),
      ),
    () => fallbackExampleBlock(),
  );
  const persistedRealWorld = safelyMapBlock(
    "applicationExercises.realWorldExercise",
    () =>
      toPersistedExample(
        application.realWorldExercise,
        resolveDiagram(
          application.realWorldExercise.diagramSpec,
          "applicationExercises.realWorldExercise",
        ),
      ),
    () => fallbackExampleBlock(),
  );
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

  const rootReviewTarget = {
    title: input.output.title,
    objectives: input.output.objectives,
  };
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
    ...(input.rootReviewIssues?.length
      ? {
          reviewIssues: input.rootReviewIssues.map((issue, issueIndex) => {
            const fingerprint = fingerprintIssueTarget(rootReviewTarget, issue);
            const copy = simplifyLessonSummaryReviewCopy(issue);
            return {
              ...issue,
              ...copy,
              id: `${issue.code}-${issueIndex + 1}-${fingerprint.slice(0, 12)}`,
              fingerprint,
              resolution: resolveLessonSummaryReviewIssueResolution(issue.code),
              accepted: false,
            };
          }),
        }
      : {}),
  };
}

function fingerprintBlock(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function fingerprintIssueTarget(
  value: Record<string, unknown>,
  issue: LessonSummaryReviewIssueDraft,
) {
  if (issue.code.startsWith("DIAGRAM_")) {
    const visual = value.visual;
    return fingerprintBlock(
      visual && typeof visual === "object" && "spec" in visual
        ? (visual as { spec: unknown }).spec
        : null,
    );
  }
  const field = issue.path.split(".").at(-1);
  return fingerprintBlock(field && field in value ? value[field] : value);
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
      "Khối lý thuyết đang trộn ví dụ, bài tập hoặc ghi chú vào phần nội dung.",
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
        "Nội dung dồn nhiều ý vào một đoạn văn dài; cần xuống dòng hoặc dùng gạch đầu dòng cho từng ý.",
      );
    }
  });
}

function validateExample(
  example: ProviderExample,
  path: string,
  addWarning: AddWarning,
  resolveDiagram: (
    diagram: LessonSummaryProviderDiagramInput | null,
    providerPath: string,
  ) => LessonSummaryDiagramSpec | null,
) {
  if (SOURCE_FIGURE_REFERENCE_PATTERN.test(example.problem)) {
    addWarning(
      "EXAMPLE_REFERENCES_SOURCE_FIGURE",
      `${path}.problem`,
      "Đề bài còn tham chiếu hình của tài liệu nguồn; cần ghi đủ dữ kiện hoặc có hình minh họa chính xác.",
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
      "Một công thức toán có ký tự bị mã hóa sai; hệ thống đã tự chuẩn hóa và quản trị viên cần kiểm tra lại công thức.",
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
    const diagram = resolveDiagram(example.diagramSpec, path);
    if (diagram) {
      validateDiagramReferences(diagram, `${path}.diagramSpec`, addWarning);
    }
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
      addWarning("DIAGRAM_DUPLICATE_POINT_ID", path, `Tên điểm ${point.id} bị trùng.`);
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
        `Điểm ${point.id} nằm ngoài khung hiển thị nên hình không thể hiện chính xác.`,
      );
    }
  });
  const primitiveIds = new Set<string>();
  const requirePoint = (id: string) => {
    if (!pointIds.has(id)) {
      addWarning(
        "DIAGRAM_UNKNOWN_POINT",
        path,
        `Hình vẽ đang tham chiếu điểm ${id} chưa được khai báo.`,
      );
    }
  };
  spec.primitives.forEach((primitive) => {
    if (primitiveIds.has(primitive.id)) {
      addWarning(
        "DIAGRAM_DUPLICATE_PRIMITIVE_ID",
        path,
        `Tên nét vẽ ${primitive.id} bị trùng.`,
      );
    }
    primitiveIds.add(primitive.id);
    if (primitive.type === "POLYLINE" && primitive.pointIds.length === 2) {
      addWarning(
        "DIAGRAM_SEGMENT_USES_POLYLINE",
        path,
        `Nét vẽ ${primitive.id} chỉ có hai điểm và sẽ được chuẩn hóa thành đoạn thẳng.`,
        "INFO",
      );
    }
    if (
      primitive.type === "CIRCLE" &&
      primitive.radius < Math.max(spec.viewBox.width, spec.viewBox.height, 1) * 0.005 &&
      spec.primitives.length > 1
    ) {
      addWarning(
        "DIAGRAM_DEGENERATE_CIRCLE_REMOVED",
        path,
        `Đường tròn ${primitive.id} quá nhỏ so với hình và sẽ bị loại khi chuẩn hóa.`,
        "INFO",
      );
    }
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
            `Ký hiệu hình học đang tham chiếu nét ${id} chưa được khai báo.`,
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
            `Ký hiệu hình học đang tham chiếu ${id}, nhưng đối tượng này không phải đoạn thẳng, đường thẳng hoặc tia.`,
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
            `Ký hiệu bằng nhau đang gắn vào các đoạn có độ dài theo tọa độ chưa khớp: ${vectors.map((value) => value.id).join(", ")}.`,
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
            "Ký hiệu song song không khớp với hướng của các đoạn theo tọa độ.",
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
            `Ký hiệu góc vuông tại ${marker.vertex} không khớp với góc 90° theo tọa độ.`,
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
      "Khối đang tham chiếu một phần nội dung không thuộc tài liệu đã chọn.",
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
  diagramSpec?: LessonSummaryDiagramSpec | null,
): LessonSummaryMvpBlock {
  const sourceChunkIds = safeSourceIds(
    block.sourceChunkIds,
    chunksById,
    fallbackSourceChunkId,
  );
  const visual = diagramSpec
    ? {
        visual: {
          kind: "DIAGRAM_SPEC" as const,
          spec: diagramSpec,
        },
      }
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

function toPersistedExample(
  example: ProviderExample,
  diagramSpec?: LessonSummaryDiagramSpec | null,
): LessonSummaryMvpBlock {
  const problem = stripSourceImages(example.problem);
  return {
    type: "example",
    problem:
      problem.length >= 8
        ? problem
        : "[Cần admin bổ sung đề bài tự đủ dữ kiện, không phụ thuộc hình nguồn]",
    solution: normalizeSolution(example.solution),
    answer: normalizeGeneratedText(example.answer),
    ...(diagramSpec
      ? {
          visual: {
            kind: "DIAGRAM_SPEC" as const,
            spec: diagramSpec,
          },
        }
      : {}),
  };
}

function fallbackTheoryBlock(
  block: LessonSummaryProviderOutput["theorySections"][number]["units"][number]["theory"],
  sourceChunkIds: string[],
): LessonSummaryMvpBlock {
  const title = "[Cần bổ sung tiêu đề]";
  if (block.type === "procedure") {
    return {
      type: "procedure",
      title,
      purpose: null,
      steps: [{ order: 1, content: "[Cần bổ sung nội dung bước]" }],
      sourceChunkIds,
    };
  }
  return {
    type: block.type,
    title,
    content: "[Cần bổ sung nội dung]",
    sourceChunkIds,
  };
}

function fallbackExampleBlock(): Extract<LessonSummaryMvpBlock, { type: "example" }> {
  return {
    type: "example",
    problem: "[Cần bổ sung đề bài]",
    solution: null,
    answer: "[Cần bổ sung đáp án]",
  };
}

function fallbackNoteBlock(
  sourceChunkIds: string[],
): Extract<LessonSummaryMvpBlock, { type: "note" }> {
  return {
    type: "note",
    content: "Ví dụ: [Cần bổ sung ghi chú]",
    sourceChunkIds,
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
  if (!normalized) return null;
  if (normalized.includes("\n") || !GEOMETRY_SOLUTION_PATTERN.test(normalized)) {
    return normalized;
  }

  const statements = normalized
    .split(/(?<=[.!?])\s+(?=[\p{L}$])/u)
    .map((statement) => statement.trim())
    .filter(Boolean);
  return statements.length > 1
    ? statements.map((statement) => `- ${statement}`).join("\n")
    : normalized;
}

function normalizeGeneratedText(value: string) {
  const repairedLatex = value
    .replaceAll(`${String.fromCharCode(9)}riangle`, "\\triangle")
    .replaceAll(`${String.fromCharCode(12)}rac`, "\\frac")
    .replaceAll(`${String.fromCharCode(8)}eta`, "\\beta")
    .replaceAll(`${String.fromCharCode(13)}ight`, "\\right")
    .replaceAll(`${String.fromCharCode(28)}hat{`, "\\widehat{")
    .replaceAll(`${String.fromCharCode(27)}0`, "\\circ")
    .replace(
      /\\{2,}(?=(?:angle|triangle|frac|dfrac|sqrt|cdot|times|left|right|mathrm|text|circ|widehat|overline|perp|parallel|cong|neq|ne|le|ge)\b)/gu,
      "\\",
    );

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
