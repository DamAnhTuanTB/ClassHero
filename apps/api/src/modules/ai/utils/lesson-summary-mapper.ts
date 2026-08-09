import type { RetrievedChunk } from "#api/modules/ai/types/ai-text.types";
import type {
  LessonSummaryMvpBlock,
  LessonSummaryOutput,
  LessonSummaryProviderOutput,
} from "#api/modules/ai/types/lesson-summary.types";
import {
  buildLessonSummarySourceCandidates,
  buildLessonSummarySourceTopics,
  isLessonSummaryRealWorldCandidate,
  type LessonSummarySourceCandidate,
} from "#api/modules/ai/utils/lesson-summary-source-candidates";

const EXERCISE_HEADING_PATTERN =
  /^(?:ví\s*dụ|luyện\s*tập|vận\s*dụng|bài\s*tập|ứng\s*dụng\s*thực\s*tế)(?:\s|$|[:：.-])/iu;
const FORBIDDEN_THEORY_LABEL_PATTERN =
  /(?:(?:ví\s*dụ|chẳng\s*hạn|chú\s*ý|lưu\s*ý|nhận\s*xét)(?:\s+\d+)?\s*[:：]|(?:^|\n)\s*(?:[-*+]\s*)?(?:\*\*|__)?(?:luyện\s*tập|vận\s*dụng|bài\s*tập)(?:\s+\d+)?\s*(?:[:：.-]|$))/imu;
const NOTE_EXAMPLE_PATTERN = /(?:ví\s*dụ|chẳng\s*hạn)\s*[:：]?/iu;

type MapLessonSummaryProviderOutputInput = {
  lessonId: string;
  output: LessonSummaryProviderOutput;
  contextChunks: RetrievedChunk[];
};

export function mapLessonSummaryProviderOutput(
  input: MapLessonSummaryProviderOutputInput,
): LessonSummaryOutput {
  const issues: string[] = [];
  const editorialWarnings: string[] = [];
  const chunksById = new Map(
    input.contextChunks.map((chunk) => [chunk.id, chunk] as const),
  );
  const sourceCandidates = buildLessonSummarySourceCandidates(input.contextChunks);
  const candidatesById = new Map(
    sourceCandidates.map((candidate) => [candidate.id, candidate] as const),
  );
  const sourceTopics = buildLessonSummarySourceTopics(input.contextChunks);
  const topicsById = new Map(sourceTopics.map((topic) => [topic.id, topic] as const));
  const fallbackSourceChunkId = input.contextChunks[0]?.id;
  const usedCandidates = new Map<string, string>();
  const usedTopics = new Map<string, string>();

  if (sourceCandidates.length === 0) {
    issues.push("Context không tạo được source candidate cho ví dụ/bài tập.");
  }
  if (sourceTopics.length === 0) {
    issues.push("Context không tạo được source topic cho section lý thuyết.");
  }

  input.output.theorySections.forEach((section, sectionIndex) => {
    const sectionPath = `theorySections.${sectionIndex}`;
    const sourceTopic = topicsById.get(section.sourceTopicId);
    if (!sourceTopic) {
      issues.push(`${sectionPath}.sourceTopicId không có trong context.`);
    } else {
      const duplicatePath = usedTopics.get(section.sourceTopicId);
      if (duplicatePath) {
        issues.push(`${sectionPath}.sourceTopicId trùng với ${duplicatePath}.`);
      } else {
        usedTopics.set(section.sourceTopicId, sectionPath);
      }
    }
    validateSourceIds(
      `${sectionPath}.sourceChunkIds`,
      section.sourceChunkIds,
      chunksById,
      issues,
    );
    if (EXERCISE_HEADING_PATTERN.test(section.displayHeading)) {
      issues.push(`${sectionPath} dùng heading bài tập cho section lý thuyết.`);
    }

    section.units.forEach((unit, unitIndex) => {
      const unitPath = `${sectionPath}.units.${unitIndex}`;
      validateSourceIds(
        `${unitPath}.theory.sourceChunkIds`,
        unit.theory.sourceChunkIds,
        chunksById,
        issues,
      );
      validateTheoryContent(unit.theory, `${unitPath}.theory`, issues);
      validateExample(
        unit.illustration,
        `${unitPath}.illustration`,
        candidatesById,
        usedCandidates,
        issues,
        section.sourceTopicId,
      );

      unit.notes.forEach((note, noteIndex) => {
        const notePath = `${unitPath}.notes.${noteIndex}`;
        validateSourceIds(
          `${notePath}.sourceChunkIds`,
          note.sourceChunkIds,
          chunksById,
          issues,
        );
        if (!NOTE_EXAMPLE_PATTERN.test(note.content)) {
          issues.push(`${notePath}.content phải có một ví dụ ngắn trong note.`);
        }
      });
    });
  });

  sourceTopics
    .map((topic) => topic.id)
    .filter((topicId) => !usedTopics.has(topicId))
    .forEach((topicId) => {
      issues.push(`theorySections bỏ sót sourceTopicId: ${topicId}.`);
    });

  const application = input.output.applicationExercises;
  validateSourceIds(
    "applicationExercises.sourceChunkIds",
    application.sourceChunkIds,
    chunksById,
    issues,
  );
  validateExample(
    application.standardExercise,
    "applicationExercises.standardExercise",
    candidatesById,
    usedCandidates,
    issues,
  );
  validateExample(
    application.realWorldExercise,
    "applicationExercises.realWorldExercise",
    candidatesById,
    usedCandidates,
    issues,
  );
  const realWorldCandidate = candidatesById.get(
    application.realWorldExercise.sourceCandidateId,
  );
  if (
    realWorldCandidate &&
    realWorldCandidate.kindHint !== "REAL_WORLD_EXERCISE" &&
    !isLessonSummaryRealWorldCandidate(realWorldCandidate.problem)
  ) {
    issues.push(
      "applicationExercises.realWorldExercise không tham chiếu bài toán có ngữ cảnh thực tế.",
    );
  }
  const visualCandidateLabels = [...usedCandidates.keys()]
    .map((candidateId) => candidatesById.get(candidateId))
    .filter(
      (candidate): candidate is LessonSummarySourceCandidate =>
        candidate?.completenessHint === "REQUIRES_FIGURE",
    )
    .map((candidate) => candidate.id);
  if (visualCandidateLabels.length > 0) {
    editorialWarnings.push(
      `Các candidate ${visualCandidateLabels.join(", ")} phụ thuộc hình nguồn; admin cần đối chiếu hình với solution/answer trước khi duyệt.`,
    );
  }
  const standardCandidate = candidatesById.get(
    application.standardExercise.sourceCandidateId,
  );
  if (standardCandidate?.kindHint === "REAL_WORLD_EXERCISE") {
    issues.push(
      "applicationExercises.standardExercise không được tham chiếu bài toán thực tế.",
    );
  }
  const preferredStandardCandidates = sourceCandidates.filter(
    (candidate) =>
      candidate.kindHint === "STANDARD_EXERCISE" &&
      candidate.formatHint === "SINGLE" &&
      candidate.completenessHint === "COMPLETE" &&
      /^(?:Bài|Luyện tập)(?:\s|[.:]|$)/iu.test(candidate.problem) &&
      (candidate.id === standardCandidate?.id || !usedCandidates.has(candidate.id)),
  );
  if (
    standardCandidate &&
    preferredStandardCandidates.length > 0 &&
    !preferredStandardCandidates.some(
      (candidate) => candidate.id === standardCandidate.id,
    )
  ) {
    editorialWarnings.push(
      "applicationExercises.standardExercise phải ưu tiên bài đơn bắt đầu bằng Bài/Luyện tập khi nguồn có candidate phù hợp.",
    );
  }
  const preferredRealWorldCandidates = sourceCandidates.filter(
    (candidate) =>
      candidate.kindHint === "REAL_WORLD_EXERCISE" &&
      candidate.formatHint === "SINGLE" &&
      candidate.completenessHint === "COMPLETE" &&
      candidate.pedagogyHint !== "DISCOVERY" &&
      /^(?:Bài|Luyện tập|Vận dụng)(?:\s|[.:]|$)/iu.test(candidate.problem) &&
      (candidate.id === realWorldCandidate?.id || !usedCandidates.has(candidate.id)),
  );
  if (
    realWorldCandidate &&
    preferredRealWorldCandidates.length > 0 &&
    !preferredRealWorldCandidates.some(
      (candidate) => candidate.id === realWorldCandidate.id,
    )
  ) {
    editorialWarnings.push(
      "applicationExercises.realWorldExercise phải ưu tiên bài thực tế hoàn chỉnh bắt đầu bằng Bài/Luyện tập/Vận dụng khi nguồn có candidate phù hợp.",
    );
  }

  const theorySections = input.output.theorySections.map((section, sectionIndex) => {
    const topic = topicsById.get(section.sourceTopicId);
    const sectionSourceChunkIds = safeSourceIds(
      [topic?.sourceChunkId, ...section.sourceChunkIds],
      chunksById,
      fallbackSourceChunkId,
    );
    return {
      order: sectionIndex + 1,
      sourceHeading: topic?.heading ?? section.displayHeading,
      displayHeading: section.displayHeading,
      sourceChunkIds: sectionSourceChunkIds,
      blocks: section.units.flatMap((unit) => {
        const theory = normalizeTheoryBlock(
          unit.theory,
          chunksById,
          sectionSourceChunkIds[0],
        );
        const illustration = toPersistedExample(
          unit.illustration,
          candidatesById,
          chunksById,
          sectionSourceChunkIds[0],
        );
        const notes = unit.notes.map((note) => ({
          ...note,
          sourceChunkIds: safeSourceIds(
            note.sourceChunkIds,
            chunksById,
            sectionSourceChunkIds[0],
          ),
        }));
        return unit.illustrationPlacement === "BEFORE_THEORY"
          ? [illustration, theory, ...notes]
          : [theory, illustration, ...notes];
      }),
    };
  });

  const applicationSourceChunkIds = safeSourceIds(
    [
      standardCandidate?.sourceChunkId,
      realWorldCandidate?.sourceChunkId,
      ...application.sourceChunkIds,
    ],
    chunksById,
    fallbackSourceChunkId,
  );
  const warnings = normalizeWarnings([
    ...(input.output.warnings ?? []),
    ...issues.map((issue) => `Cần admin kiểm tra: ${issue}`),
    ...editorialWarnings.map((warning) => `Cần admin kiểm tra: ${warning}`),
  ]);

  return {
    lessonId: input.lessonId,
    title: input.output.title,
    objectives: input.output.objectives,
    sections: [
      ...theorySections,
      {
        order: theorySections.length + 1,
        sourceHeading: application.sourceHeading,
        displayHeading: "Bài tập vận dụng",
        sourceChunkIds: applicationSourceChunkIds,
        blocks: [
          toPersistedExample(
            application.standardExercise,
            candidatesById,
            chunksById,
            applicationSourceChunkIds[0],
          ),
          toPersistedExample(
            application.realWorldExercise,
            candidatesById,
            chunksById,
            applicationSourceChunkIds[0],
          ),
        ],
      },
    ],
    warnings: warnings.length > 0 ? warnings : null,
  };
}

function validateTheoryContent(
  block: LessonSummaryProviderOutput["theorySections"][number]["units"][number]["theory"],
  path: string,
  issues: string[],
) {
  const values =
    block.type === "procedure"
      ? [block.purpose ?? "", ...block.steps.map((step) => step.content)]
      : [block.content];
  if (values.some((value) => FORBIDDEN_THEORY_LABEL_PATTERN.test(value))) {
    issues.push(`${path} trộn ví dụ/bài tập/ghi chú vào field lý thuyết.`);
  }
  values.forEach((value) => {
    const sentenceCount = value
      .split(/[.!?](?=\s|$)/u)
      .map((sentence) => sentence.trim())
      .filter(Boolean).length;
    if (value.length >= 240 && sentenceCount >= 3 && !value.includes("\n")) {
      issues.push(
        `${path} dồn nhiều ý vào một paragraph dài; phải xuống dòng hoặc dùng bullet cho từng ý.`,
      );
    }
  });
}

function validateExample(
  example:
    | LessonSummaryProviderOutput["theorySections"][number]["units"][number]["illustration"]
    | LessonSummaryProviderOutput["applicationExercises"]["standardExercise"]
    | LessonSummaryProviderOutput["applicationExercises"]["realWorldExercise"],
  path: string,
  candidatesById: Map<string, LessonSummarySourceCandidate>,
  usedCandidates: Map<string, string>,
  issues: string[],
  requiredTopicId?: string,
) {
  const candidate = candidatesById.get(example.sourceCandidateId);
  if (!candidate) {
    issues.push(`${path}.sourceCandidateId không có trong context.`);
    return;
  }

  if (requiredTopicId && candidate.relatedTopicId !== requiredTopicId) {
    issues.push(`${path}.sourceCandidateId không thuộc source topic của theory section.`);
  }
  const solution = example.solution ?? "";
  if (
    /^(?:thực hiện|sử dụng|dựa vào|quan sát|làm theo|tính theo|kết quả tùy|theo yêu cầu|nếu (?:hình|ta có))/iu.test(
      example.answer.trim(),
    )
  ) {
    issues.push(`${path}.answer còn chung chung, chưa nêu kết quả cụ thể của đề.`);
  }
  const solutionSentenceCount = solution
    .split(/[.!?](?=\s|$)/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean).length;
  if (solution.length >= 240 && solutionSentenceCount >= 3 && !solution.includes("\n")) {
    issues.push(`${path}.solution phải ngắt dòng theo từng ý lập luận.`);
  }

  const duplicatePath = usedCandidates.get(example.sourceCandidateId);
  if (duplicatePath) {
    issues.push(`${path}.sourceCandidateId trùng với ${duplicatePath}.`);
  } else {
    usedCandidates.set(example.sourceCandidateId, path);
  }
}

function validateSourceIds(
  path: string,
  sourceChunkIds: string[],
  chunksById: Map<string, RetrievedChunk>,
  issues: string[],
) {
  const invalidIds = sourceChunkIds.filter((id) => !chunksById.has(id));
  if (invalidIds.length > 0) {
    issues.push(`${path} chứa ID ngoài context: ${invalidIds.join(", ")}.`);
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

function normalizeWarnings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].map((value) =>
    value.slice(0, 1_000),
  );
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
  if (block.type !== "procedure") return { ...block, sourceChunkIds };
  return {
    ...block,
    sourceChunkIds,
    steps: block.steps.map((step, index) => ({ ...step, order: index + 1 })),
  };
}

function toPersistedExample(
  example:
    | LessonSummaryProviderOutput["theorySections"][number]["units"][number]["illustration"]
    | LessonSummaryProviderOutput["applicationExercises"]["standardExercise"]
    | LessonSummaryProviderOutput["applicationExercises"]["realWorldExercise"],
  candidatesById: Map<string, LessonSummarySourceCandidate>,
  chunksById: Map<string, RetrievedChunk>,
  fallbackSourceChunkId?: string,
): LessonSummaryMvpBlock {
  const candidate = candidatesById.get(example.sourceCandidateId);
  return {
    type: "example",
    sourceChunkIds: safeSourceIds(
      [candidate?.sourceChunkId],
      chunksById,
      fallbackSourceChunkId,
    ),
    problem:
      candidate?.problem ??
      `[Cần admin bổ sung đề bài] Không tìm thấy sourceCandidateId: ${example.sourceCandidateId}`,
    solution: example.solution,
    answer: example.answer,
  };
}
