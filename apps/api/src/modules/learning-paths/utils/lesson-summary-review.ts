import { createHash } from "node:crypto";
import { lessonSummaryDiagramSpecSchema } from "@learning-path/shared";
import { z } from "zod";

import {
  lessonSummaryMvpBlockSchema,
  lessonSummaryReviewIssueSchema,
  resolveLessonSummaryReviewIssueResolution,
} from "#api/modules/ai/types/lesson-summary.types";
import {
  describeLessonSummaryDiagramReviewIssue,
  simplifyLessonSummaryReviewCopy,
} from "#api/modules/ai/utils/lesson-summary-review-copy";

type ReviewIssue = z.infer<typeof lessonSummaryReviewIssueSchema>;
type JsonObject = Record<string, unknown>;
const FORMAL_PROOF_PATTERN = /\b(?:chứng\s*minh|chứng\s*tỏ)\b/iu;
const GEOMETRY_PROBLEM_PATTERN =
  /(?:\\triangle|△|\b(?:tam\s*giác|tứ\s*giác|hình\s+(?:vuông|chữ\s*nhật|thoi|bình\s*hành|thang|tròn)|góc|cạnh|đoạn\s*thẳng|đường\s*thẳng|tia|trung\s*điểm|vuông|song\s*song|đường\s*tròn|cung\s*tròn)\b)/iu;

export function improveLessonSummaryReviewIssueCopy(contentJson: unknown) {
  if (!isObject(contentJson) || contentJson.type !== "lesson_summary_blocks") {
    return contentJson;
  }
  if (!isObject(contentJson.data)) return contentJson;

  const data = contentJson.data;
  return {
    ...contentJson,
    data: {
      ...data,
      ...(Array.isArray(data.reviewIssues)
        ? { reviewIssues: improveIssues(data.reviewIssues) }
        : {}),
      ...(Array.isArray(data.sections)
        ? {
            sections: data.sections.map((section) => {
              if (!isObject(section) || !Array.isArray(section.blocks)) return section;
              return {
                ...section,
                blocks: section.blocks.map((block) => {
                  if (!isObject(block) || !Array.isArray(block.reviewIssues)) {
                    return block;
                  }
                  return {
                    ...block,
                    reviewIssues: improveIssues(block.reviewIssues),
                  };
                }),
              };
            }),
          }
        : {}),
    },
  };
}

export function reconcileLessonSummaryReviewIssues(contentJson: JsonObject) {
  if (contentJson.type !== "lesson_summary_blocks" || !isObject(contentJson.data)) {
    return contentJson;
  }

  const data = { ...contentJson.data };
  const targetGrade = typeof data.targetGrade === "number" ? data.targetGrade : null;
  const sections = Array.isArray(data.sections)
    ? data.sections.map((section, sectionIndex) =>
        reconcileSection(section, sectionIndex, targetGrade),
      )
    : data.sections;
  const existingRootIssues = parseIssues(data.reviewIssues);
  const rootValidationIssues = validateRoot(data);
  const reviewIssues = mergeIssues(existingRootIssues, rootValidationIssues, data);
  const { reviewIssues: _previousReviewIssues, ...dataWithoutReviewIssues } = data;

  return {
    ...contentJson,
    data: {
      ...dataWithoutReviewIssues,
      sections,
      ...(reviewIssues.length > 0 ? { reviewIssues } : {}),
    },
  };
}

export function listUnresolvedLessonSummaryReviewIssues(contentJson: JsonObject) {
  if (contentJson.type !== "lesson_summary_blocks" || !isObject(contentJson.data)) {
    return [] as ReviewIssue[];
  }
  const issues = parseIssues(contentJson.data.reviewIssues);
  if (!Array.isArray(contentJson.data.sections)) return issues.filter(isUnresolved);
  contentJson.data.sections.forEach((section) => {
    if (!isObject(section) || !Array.isArray(section.blocks)) return;
    section.blocks.forEach((block) => {
      if (!isObject(block)) return;
      issues.push(...parseIssues(block.reviewIssues));
    });
  });
  return issues.filter(isUnresolved);
}

function reconcileSection(
  value: unknown,
  sectionIndex: number,
  targetGrade: number | null,
) {
  if (!isObject(value) || !Array.isArray(value.blocks)) return value;
  return {
    ...value,
    blocks: value.blocks.map((block, blockIndex) =>
      reconcileBlock(block, sectionIndex, blockIndex, targetGrade),
    ),
  };
}

function reconcileBlock(
  value: unknown,
  sectionIndex: number,
  blockIndex: number,
  targetGrade: number | null,
) {
  if (!isObject(value)) return value;
  const blockWithoutIssues = omitReviewIssues(value);
  const parsedBlock = lessonSummaryMvpBlockSchema.safeParse(blockWithoutIssues);
  const normalizedBlock = parsedBlock.success ? parsedBlock.data : blockWithoutIssues;
  const existingIssues = parseIssues(value.reviewIssues);
  const validationIssues = validateBlock(
    normalizedBlock,
    `sections.${sectionIndex}.blocks.${blockIndex}`,
    targetGrade,
  );
  const reviewIssues = mergeIssues(existingIssues, validationIssues, normalizedBlock);
  return {
    ...normalizedBlock,
    ...(reviewIssues.length > 0 ? { reviewIssues } : {}),
  };
}

function validateRoot(data: JsonObject) {
  const issues: ReviewIssue[] = [];
  if (typeof data.title !== "string" || data.title.trim().length === 0) {
    issues.push(
      createIssue({
        code: "MISSING_SUMMARY_TITLE",
        path: "title",
        message: "Bài tóm tắt đang thiếu tiêu đề.",
        suggestion: "Bổ sung tiêu đề bài tóm tắt rồi lưu lại.",
        technicalDetails: "Required field is missing or empty: title.",
        fingerprint: fingerprint(data.title),
      }),
    );
  }
  return issues;
}

function validateBlock(value: JsonObject, blockPath: string, targetGrade: number | null) {
  const issues: ReviewIssue[] = [];
  const parsed = lessonSummaryMvpBlockSchema.safeParse(value);
  if (!parsed.success) {
    issues.push(
      createIssue({
        code: "BLOCK_SCHEMA_INVALID",
        path: blockPath,
        message: describeBlockProblem(parsed.error),
        suggestion: suggestBlockFix(parsed.error),
        technicalDetails: formatZodIssues(parsed.error),
        fingerprint: fingerprint(value),
      }),
    );
  }

  const visual = isObject(value.visual) ? value.visual : null;
  if (visual?.kind === "DIAGRAM_SPEC") {
    const diagram = lessonSummaryDiagramSpecSchema.safeParse(visual.spec);
    if (!diagram.success) {
      const technicalDetails = formatZodIssues(diagram.error);
      const copy = describeLessonSummaryDiagramReviewIssue(technicalDetails);
      issues.push(
        createIssue({
          code: "DIAGRAM_NEEDS_REVIEW",
          path: `${blockPath}.visual.spec`,
          message: copy?.message ?? "Hình vẽ còn chi tiết chưa khớp quy tắc toán học.",
          suggestion:
            copy?.suggestion ??
            "Sửa các điểm, cạnh hoặc ký hiệu nêu trong chi tiết kỹ thuật; nếu hình hiện tại vẫn dùng được, chọn Chấp nhận hình này.",
          technicalDetails,
          fingerprint: fingerprint(visual.spec),
        }),
      );
    }
  }
  if (
    value.type === "example" &&
    typeof value.problem === "string" &&
    isFormalGeometryProof(value.problem, Boolean(visual)) &&
    targetGrade !== null &&
    targetGrade >= 7 &&
    targetGrade <= 9
  ) {
    const geometryStatement = isObject(value.geometryStatement)
      ? value.geometryStatement
      : null;
    const hasHypotheses =
      geometryStatement &&
      Array.isArray(geometryStatement.hypotheses) &&
      geometryStatement.hypotheses.some(
        (statement) => typeof statement === "string" && statement.trim().length > 0,
      );
    const hasConclusions =
      geometryStatement &&
      Array.isArray(geometryStatement.conclusions) &&
      geometryStatement.conclusions.some(
        (statement) => typeof statement === "string" && statement.trim().length > 0,
      );
    if (!hasHypotheses || !hasConclusions) {
      issues.push(
        createIssue({
          code: "MISSING_GEOMETRY_STATEMENT",
          path: `${blockPath}.geometryStatement`,
          message: "Bài chứng minh hình học đang thiếu bảng giả thiết–kết luận.",
          suggestion:
            "Bổ sung GT chỉ gồm dữ kiện đã cho và KL đúng điều phải chứng minh rồi lưu lại.",
          technicalDetails:
            "Formal geometry proofs for grades 7–9 require geometryStatement.",
          fingerprint: fingerprint(value.geometryStatement ?? null),
        }),
      );
    }
  }
  return deduplicateIssues(issues);
}

function isFormalGeometryProof(problem: string, hasDiagram: boolean) {
  return (
    FORMAL_PROOF_PATTERN.test(problem) &&
    (hasDiagram || GEOMETRY_PROBLEM_PATTERN.test(problem))
  );
}

function mergeIssues(
  existing: ReviewIssue[],
  validation: ReviewIssue[],
  currentValue: JsonObject,
) {
  const unchanged = existing.filter(
    (issue) => issue.fingerprint === fingerprintIssueTarget(currentValue, issue),
  );
  const merged = [...unchanged];
  validation.forEach((issue) => {
    if (
      merged.some(
        (candidate) => candidate.code === issue.code && candidate.path === issue.path,
      )
    ) {
      return;
    }
    merged.push(issue);
  });
  return deduplicateIssues(merged).slice(0, 50);
}

function fingerprintIssueTarget(value: JsonObject, issue: ReviewIssue) {
  if (issue.code.startsWith("DIAGRAM_")) {
    const visual = isObject(value.visual) ? value.visual : null;
    return fingerprint(visual?.spec ?? null);
  }
  const field = issue.path.split(".").at(-1);
  return fingerprint(field && field in value ? value[field] : value);
}

function parseIssues(value: unknown): ReviewIssue[] {
  const parsed = z.array(lessonSummaryReviewIssueSchema).safeParse(value);
  return parsed.success ? parsed.data.map(normalizeIssueResolution) : [];
}

function improveIssues(value: unknown[]) {
  return value.map((candidate) => {
    const parsed = lessonSummaryReviewIssueSchema.safeParse(candidate);
    if (!parsed.success) return candidate;
    const diagramCopy = parsed.data.code.startsWith("DIAGRAM_")
      ? describeLessonSummaryDiagramReviewIssue(parsed.data.technicalDetails ?? null)
      : null;
    const copy = simplifyLessonSummaryReviewCopy(
      diagramCopy ?? {
        message: parsed.data.message,
        suggestion: parsed.data.suggestion,
      },
    );
    return { ...normalizeIssueResolution(parsed.data), ...copy };
  });
}

function createIssue(input: Omit<ReviewIssue, "id" | "accepted">): ReviewIssue {
  const suffix = createHash("sha256")
    .update(`${input.code}:${input.path}:${input.fingerprint}`)
    .digest("hex")
    .slice(0, 12);
  const copy = simplifyLessonSummaryReviewCopy(input);
  return {
    ...input,
    ...copy,
    id: `${input.code}-${suffix}`,
    resolution: resolveLessonSummaryReviewIssueResolution(input.code),
    accepted: false,
  };
}

function describeBlockProblem(error: z.ZodError) {
  const first = error.issues[0];
  const field = friendlyField(first?.path ?? []);
  return field
    ? `Khối có dữ liệu chưa hợp lệ tại ${field}.`
    : "Khối có dữ liệu chưa đúng cấu trúc cần thiết.";
}

function suggestBlockFix(error: z.ZodError) {
  const first = error.issues[0];
  const field = friendlyField(first?.path ?? []);
  return field
    ? `Kiểm tra và bổ sung ${field}, rồi lưu lại.`
    : "Mở dữ liệu của khối, bổ sung phần còn thiếu hoặc sửa giá trị chưa đúng theo chi tiết kỹ thuật.";
}

function friendlyField(path: Array<PropertyKey>) {
  const key = String(path.at(-1) ?? "");
  return (
    {
      title: "tiêu đề",
      content: "nội dung",
      problem: "đề bài",
      solution: "lời giải",
      answer: "đáp án",
      geometryStatement: "bảng giả thiết–kết luận",
      steps: "các bước thực hiện",
      sourceChunkIds: "nguồn tham chiếu",
      visual: "hình minh họa",
      spec: "dữ liệu hình vẽ",
      type: "loại khối",
    } as Record<string, string>
  )[key];
}

function formatZodIssues(error: z.ZodError) {
  return error.issues
    .slice(0, 12)
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("\n");
}

function deduplicateIssues(issues: ReviewIssue[]) {
  return issues.filter(
    (issue, index) =>
      issues.findIndex(
        (candidate) => candidate.code === issue.code && candidate.path === issue.path,
      ) === index,
  );
}

function omitReviewIssues(value: JsonObject) {
  const { reviewIssues: _reviewIssues, ...rest } = value;
  return rest;
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnresolved(issue: ReviewIssue) {
  return (
    resolveLessonSummaryReviewIssueResolution(issue.code) === "FIX_ONLY" ||
    !issue.accepted
  );
}

function normalizeIssueResolution(issue: ReviewIssue): ReviewIssue {
  const resolution = resolveLessonSummaryReviewIssueResolution(issue.code);
  return {
    ...issue,
    resolution,
    accepted: resolution === "FIX_ONLY" ? false : issue.accepted,
  };
}
