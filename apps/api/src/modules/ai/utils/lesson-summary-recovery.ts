import {
  lessonSummaryDiagramSpecSchema,
  lessonSummaryDiagramSpecStructuralSchema,
  type LessonSummaryDiagramSpec,
} from "@learning-path/shared";
import { z } from "zod";

import type { RetrievedChunk } from "#api/modules/ai/types/ai-text.types";
import {
  lessonSummaryProviderDiagramInputSchema,
  mapLessonSummaryProviderDiagramInput,
  type LessonSummaryProviderDiagramInput,
  type LessonSummaryProviderDiagramTransport,
} from "#api/modules/ai/types/lesson-summary-provider-diagram.types";
import type {
  LessonSummaryProviderOutput,
  LessonSummaryProviderTransportOutput,
} from "#api/modules/ai/types/lesson-summary.types";
import {
  describeLessonSummaryDiagramReviewIssue,
  hasOnlyAutoRemovableDiagramLabelIssues,
} from "#api/modules/ai/utils/lesson-summary-review-copy";
import { compileLessonSummaryDiagramIntentWithDiagnostics } from "#api/modules/ai/utils/diagram-compilers/compile-diagram-intent";

export type LessonSummaryReviewIssueDraft = {
  code: string;
  path: string;
  message: string;
  suggestion: string;
  technicalDetails: string | null;
};

export type LessonSummaryProviderRecovery = {
  output: LessonSummaryProviderOutput;
  reviewIssuesByPath: Map<string, LessonSummaryReviewIssueDraft[]>;
  rootReviewIssues: LessonSummaryReviewIssueDraft[];
};

type MutableReviewIssues = Map<string, LessonSummaryReviewIssueDraft[]>;

export function recoverLessonSummaryProviderOutput(input: {
  output: LessonSummaryProviderTransportOutput;
  contextChunks: RetrievedChunk[];
}): LessonSummaryProviderRecovery {
  const issuesByPath: MutableReviewIssues = new Map();
  const rootReviewIssues: LessonSummaryReviewIssueDraft[] = [];
  const validChunkIds = new Set(input.contextChunks.map((chunk) => chunk.id));
  const fallbackChunkId = input.contextChunks[0]?.id;
  const addIssue = (path: string, issue: LessonSummaryReviewIssueDraft) => {
    const current = issuesByPath.get(path) ?? [];
    current.push(issue);
    issuesByPath.set(path, current);
  };
  const safeChunkIds = (values: string[], blockPath: string) => {
    const safe = [...new Set(values.filter((value) => validChunkIds.has(value)))].slice(
      0,
      20,
    );
    if (safe.length > 0) return safe;
    addIssue(blockPath, {
      code: "MISSING_SOURCE_REFERENCE",
      path: `${blockPath}.sourceChunkIds`,
      message: "Khối chưa có tham chiếu hợp lệ tới tài liệu nguồn.",
      suggestion:
        "Kiểm tra lại nội dung khối với tài liệu buổi học; hệ thống đã tạm gắn đoạn nguồn gần nhất.",
      technicalDetails: `Không tìm thấy sourceChunkIds hợp lệ tại ${blockPath}.sourceChunkIds.`,
    });
    return fallbackChunkId ? [fallbackChunkId] : values.slice(0, 1);
  };
  const text = (
    value: string,
    fallback: string,
    blockPath: string,
    fieldPath: string,
    fieldLabel: string,
  ) => {
    const normalized = value.trim();
    if (hasVisibleText(normalized)) return normalized;
    addIssue(blockPath, {
      code: "MISSING_REQUIRED_FIELD",
      path: fieldPath,
      message: `Khối đang thiếu ${fieldLabel}.`,
      suggestion: `Bổ sung ${fieldLabel} rồi lưu lại.`,
      technicalDetails: `Required field is empty: ${fieldPath}.`,
    });
    return fallback;
  };
  const recoverDiagram = (
    diagram: LessonSummaryProviderDiagramTransport | null,
    blockPath: string,
  ): LessonSummaryProviderDiagramInput | null => {
    if (!diagram) return null;
    const accepted = lessonSummaryProviderDiagramInputSchema.safeParse(diagram);
    if (accepted.success) {
      try {
        // An INTENT can satisfy the provider schema while still being impossible
        // for its deterministic compiler to draw (for example, a two-triangle
        // archetype with fewer than six point labels). Compile/map it here so a
        // block-local renderer defect cannot escape later and fail the whole job.
        let mapped: LessonSummaryDiagramSpec;
        let semanticDetails: string | null = null;
        if ("kind" in accepted.data && accepted.data.kind === "INTENT") {
          const compiled = compileLessonSummaryDiagramIntentWithDiagnostics(
            accepted.data.intent,
          );
          mapped = compiled.spec;
          semanticDetails = formatCompiledSemanticIssues(compiled.semanticIssues);
        } else {
          mapped = mapLessonSummaryProviderDiagramInput(accepted.data);
        }
        const structurallySafe = lessonSummaryDiagramSpecStructuralSchema.parse(mapped);
        if (semanticDetails) {
          const copy = describeLessonSummaryDiagramReviewIssue(semanticDetails);
          addIssue(blockPath, {
            code: "DIAGRAM_NEEDS_REVIEW",
            path: `${blockPath}.diagramSpec`,
            message:
              copy?.message ??
              "Hình vẽ vẫn hiển thị được nhưng còn chi tiết cần kiểm tra lại.",
            suggestion:
              copy?.suggestion ??
              "Đối chiếu các điểm và nét vẽ với đề bài; sửa hình hoặc chấp nhận nếu hình hiện tại vẫn dùng được.",
            technicalDetails: semanticDetails,
          });
        }
        // Persist a renderer-ready RAW_SPEC so downstream code never needs to
        // invoke the intent compiler for this block a second time.
        return toProviderRawDiagram(structurallySafe);
      } catch (error) {
        addIssue(blockPath, {
          code: "DIAGRAM_CANNOT_RENDER",
          path: `${blockPath}.diagramSpec`,
          message: "Hình vẽ thiếu dữ liệu cần thiết nên chưa thể hiển thị an toàn.",
          suggestion:
            "Bổ sung các điểm, cạnh hoặc nhãn còn thiếu trong dữ liệu hình vẽ rồi lưu lại; các khối nội dung khác vẫn có thể tiếp tục được duyệt.",
          technicalDetails: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    }

    const issuePath = `${blockPath}.diagramSpec`;
    const technicalDetails = formatZodIssues(accepted.error);

    try {
      const recoverableDiagram = removeRejectedProviderDiagramParts(
        diagram,
        accepted.error,
      );
      const mapped = mapLessonSummaryProviderDiagramInput(
        recoverableDiagram as LessonSummaryProviderDiagramInput,
      );
      const sanitized = sanitizeMappedDiagram(mapped);
      const structurallySafe =
        lessonSummaryDiagramSpecStructuralSchema.safeParse(sanitized);
      if (!structurallySafe.success) {
        addIssue(blockPath, {
          code: "DIAGRAM_CANNOT_RENDER",
          path: issuePath,
          message: "Hình vẽ không còn đủ dữ liệu an toàn để hiển thị.",
          suggestion:
            "Bổ sung ít nhất hai điểm và một nét vẽ nối đúng các điểm, hoặc thay bằng hình khác.",
          technicalDetails: formatZodIssues(structurallySafe.error),
        });
        return null;
      }
      if (!hasOnlyAutoRemovableDiagramLabelIssues(technicalDetails)) {
        const copy = describeLessonSummaryDiagramReviewIssue(technicalDetails);
        addIssue(blockPath, {
          code: "DIAGRAM_NEEDS_REVIEW",
          path: issuePath,
          message:
            copy?.message ??
            "Hình vẽ có một hoặc vài chi tiết chưa khớp quy tắc toán học; phần vẽ an toàn vẫn được giữ lại.",
          suggestion:
            copy?.suggestion ??
            "Kiểm tra các điểm, cạnh và ký hiệu được nêu trong chi tiết kỹ thuật; sửa dữ liệu hình vẽ hoặc chọn Chấp nhận hình này nếu hình hiện tại dùng được.",
          technicalDetails,
        });
      }
      return toProviderRawDiagram(structurallySafe.data);
    } catch (error) {
      addIssue(blockPath, {
        code: "DIAGRAM_CANNOT_RENDER",
        path: issuePath,
        message: "Hình vẽ không thể dựng an toàn từ dữ liệu hiện tại.",
        suggestion:
          "Kiểm tra tên các điểm và cạnh đang được sử dụng, hoặc thay hình vẽ rồi lưu lại.",
        technicalDetails: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  };

  const sections = input.output.theorySections.map((section, sectionIndex) => {
    const sectionPath = `theorySections.${sectionIndex}`;
    const sectionBlockPath = `${sectionPath}.section`;
    const units = section.units.map((unit, unitIndex) => {
      const unitPath = `${sectionPath}.units.${unitIndex}`;
      const theoryPath = `${unitPath}.theory`;
      const illustrationPath = `${unitPath}.illustration`;
      const theoryBase = {
        ...unit.theory,
        title: text(
          unit.theory.title,
          "[Cần bổ sung tiêu đề]",
          theoryPath,
          `${theoryPath}.title`,
          "tiêu đề",
        ),
        sourceChunkIds: safeChunkIds(unit.theory.sourceChunkIds, theoryPath),
        diagramSpec: recoverDiagram(unit.theory.diagramSpec, theoryPath),
      };
      const theory =
        unit.theory.type === "procedure"
          ? {
              ...theoryBase,
              type: "procedure" as const,
              purpose: unit.theory.purpose?.trim() || null,
              steps:
                unit.theory.steps.length > 0
                  ? unit.theory.steps.map((step, stepIndex) => ({
                      order: stepIndex + 1,
                      content: text(
                        step.content,
                        "[Cần bổ sung nội dung bước]",
                        theoryPath,
                        `${theoryPath}.steps.${stepIndex}.content`,
                        `nội dung bước ${stepIndex + 1}`,
                      ),
                    }))
                  : [
                      {
                        order: 1,
                        content: text(
                          "",
                          "[Cần bổ sung nội dung bước]",
                          theoryPath,
                          `${theoryPath}.steps`,
                          "các bước thực hiện",
                        ),
                      },
                    ],
            }
          : {
              ...theoryBase,
              type: unit.theory.type,
              content: text(
                unit.theory.content,
                "[Cần bổ sung nội dung]",
                theoryPath,
                `${theoryPath}.content`,
                "nội dung",
              ),
            };

      return {
        theory,
        illustration: recoverExample(
          unit.illustration,
          illustrationPath,
          recoverDiagram,
          text,
        ),
        notes: unit.notes.map((note, noteIndex) => {
          const notePath = `${unitPath}.notes.${noteIndex}`;
          return {
            type: "note" as const,
            content: text(
              note.content,
              "Ví dụ: [Cần bổ sung ghi chú]",
              notePath,
              `${notePath}.content`,
              "nội dung ghi chú",
            ),
            sourceChunkIds: safeChunkIds(note.sourceChunkIds, notePath),
          };
        }),
      };
    });

    if (units.length === 0) {
      addIssue(sectionBlockPath, {
        code: "MISSING_THEORY_UNIT",
        path: `${sectionPath}.units`,
        message: "Đề mục chưa có khối kiến thức.",
        suggestion: "Thêm ít nhất một khối kiến thức và một ví dụ minh họa.",
        technicalDetails: `Expected at least one unit at ${sectionPath}.units.`,
      });
      units.push(createFallbackUnit(safeChunkIds([], sectionBlockPath)));
    }

    return {
      sourceTopicId: text(
        section.sourceTopicId,
        `recovered-topic-${sectionIndex + 1}`,
        sectionBlockPath,
        `${sectionPath}.sourceTopicId`,
        "mã đề mục nguồn",
      ),
      displayHeading: text(
        section.displayHeading,
        "Nội dung cần bổ sung",
        sectionBlockPath,
        `${sectionPath}.displayHeading`,
        "tên đề mục",
      ),
      sourceChunkIds: safeChunkIds(section.sourceChunkIds, sectionBlockPath),
      units,
    };
  });

  if (sections.length === 0) {
    rootReviewIssues.push({
      code: "MISSING_THEORY_SECTION",
      path: "theorySections",
      message: "Bài chưa có đề mục kiến thức.",
      suggestion: "Thêm ít nhất một đề mục kiến thức trước khi phát hành.",
      technicalDetails: "Expected at least one theory section.",
    });
    const ids = fallbackChunkId ? [fallbackChunkId] : [];
    sections.push({
      sourceTopicId: "recovered-topic-1",
      displayHeading: "Nội dung cần bổ sung",
      sourceChunkIds: ids,
      units: [createFallbackUnit(ids)],
    });
  }

  const title = input.output.title.trim();
  if (!title) {
    rootReviewIssues.push({
      code: "MISSING_SUMMARY_TITLE",
      path: "title",
      message: "Bài tóm tắt đang thiếu tiêu đề.",
      suggestion: "Bổ sung tiêu đề bài tóm tắt rồi lưu lại.",
      technicalDetails: "Required field is empty: title.",
    });
  }

  const objectives = input.output.objectives
    ?.map((objective) => objective.trim())
    .filter(Boolean);
  if (input.output.objectives && objectives?.length === 0) {
    rootReviewIssues.push({
      code: "EMPTY_OBJECTIVES",
      path: "objectives",
      message: "Danh sách mục tiêu học tập đang trống.",
      suggestion:
        "Bổ sung ít nhất một mục tiêu học tập; nếu bài không cần mục tiêu riêng, hãy để trống toàn bộ danh sách.",
      technicalDetails: "objectives contains no non-empty item.",
    });
  }

  const standardPath = "applicationExercises.standardExercise";
  const realWorldPath = "applicationExercises.realWorldExercise";
  const output = {
    title: title || "Kiến thức buổi học",
    objectives: objectives?.length ? objectives : null,
    theorySections: sections,
    applicationExercises: {
      displayHeading: "Bài tập vận dụng" as const,
      standardExercise: recoverExample(
        input.output.applicationExercises.standardExercise,
        standardPath,
        recoverDiagram,
        text,
      ),
      realWorldExercise: recoverExample(
        input.output.applicationExercises.realWorldExercise,
        realWorldPath,
        recoverDiagram,
        text,
      ),
    },
  } as LessonSummaryProviderOutput;

  return { output, reviewIssuesByPath: issuesByPath, rootReviewIssues };
}

function removeRejectedProviderDiagramParts(
  diagram: LessonSummaryProviderDiagramTransport,
  error: z.ZodError,
): LessonSummaryProviderDiagramTransport {
  const raw =
    "kind" in diagram ? (diagram.kind === "RAW_SPEC" ? diagram.spec : null) : diagram;
  if (!raw) return diagram;
  const rejected = {
    rightAngles: new Set<number>(),
    equalLengths: new Set<number>(),
    parallels: new Set<number>(),
    angles: new Set<number>(),
    angleLabels: new Set<number>(),
    labels: new Set<number>(),
  };
  error.issues.forEach((issue) => {
    (
      ["rightAngles", "equalLengths", "parallels", "angles", "labels"] as const
    ).forEach((category) => {
      const categoryIndex = issue.path.indexOf(category);
      const markerIndex = issue.path[categoryIndex + 1];
      if (categoryIndex >= 0 && typeof markerIndex === "number") {
        if (category === "angles" && issue.path.includes("label")) {
          rejected.angleLabels.add(markerIndex);
          return;
        }
        if (category === "labels" && !shouldDiscardDiagramLabelIssue(issue)) {
          return;
        }
        rejected[category].add(markerIndex);
      }
    });
  });
  const sanitized = {
    ...raw,
    markers: {
      rightAngles: raw.markers.rightAngles.filter(
        (_, index) => !rejected.rightAngles.has(index),
      ),
      equalLengths: raw.markers.equalLengths.filter(
        (_, index) => !rejected.equalLengths.has(index),
      ),
      parallels: raw.markers.parallels.filter(
        (_, index) => !rejected.parallels.has(index),
      ),
      angles: raw.markers.angles
        .map((angle, index) =>
          rejected.angleLabels.has(index) ? { ...angle, label: null } : angle,
        )
        .filter((_, index) => !rejected.angles.has(index)),
    },
    labels: raw.labels.filter((_, index) => !rejected.labels.has(index)),
  };
  return "kind" in diagram
    ? ({ kind: "RAW_SPEC", spec: sanitized } as LessonSummaryProviderDiagramTransport)
    : (sanitized as LessonSummaryProviderDiagramTransport);
}

function recoverExample(
  example: LessonSummaryProviderTransportOutput["applicationExercises"]["standardExercise"],
  path: string,
  recoverDiagram: (
    diagram: LessonSummaryProviderDiagramTransport | null,
    blockPath: string,
  ) => LessonSummaryProviderDiagramInput | null,
  text: (
    value: string,
    fallback: string,
    blockPath: string,
    fieldPath: string,
    fieldLabel: string,
  ) => string,
) {
  return {
    ...example,
    problem: text(
      example.problem,
      "[Cần bổ sung đề bài]",
      path,
      `${path}.problem`,
      "đề bài",
    ),
    solution: example.solution?.trim() || null,
    answer: text(
      example.answer,
      "[Cần bổ sung đáp án]",
      path,
      `${path}.answer`,
      "đáp án",
    ),
    diagramSpec: recoverDiagram(example.diagramSpec, path),
  };
}

function createFallbackUnit(sourceChunkIds: string[]) {
  return {
    theory: {
      type: "knowledge" as const,
      title: "[Cần bổ sung tiêu đề]",
      content: "[Cần bổ sung nội dung]",
      sourceChunkIds,
      diagramSpec: null,
    },
    illustration: {
      type: "example" as const,
      exampleKind: "ILLUSTRATION" as const,
      problem: "[Cần bổ sung đề bài]",
      solution: null,
      answer: "[Cần bổ sung đáp án]",
      diagramSpec: null,
    },
    notes: [],
  };
}

function sanitizeMappedDiagram(spec: LessonSummaryDiagramSpec): LessonSummaryDiagramSpec {
  const pointIds = new Set(spec.points.map((point) => point.id));
  const hasAllPoints = (ids: string[]) => ids.every((id) => pointIds.has(id));
  let current: LessonSummaryDiagramSpec = {
    ...spec,
    primitives: spec.primitives.filter((primitive) => {
      if (
        primitive.type === "SEGMENT" ||
        primitive.type === "LINE" ||
        primitive.type === "RAY"
      ) {
        return (
          primitive.from !== primitive.to &&
          hasAllPoints([primitive.from, primitive.to])
        );
      }
      if (primitive.type === "POLYGON" || primitive.type === "POLYLINE") {
        return hasAllPoints(primitive.pointIds);
      }
      return pointIds.has(primitive.center);
    }),
    markers: spec.markers.map((marker) => {
      if (marker.type !== "ANGLE" || !marker.label) return marker;
      const vertexLabel = spec.points.find(
        (point) => point.id === marker.vertex,
      )?.label;
      return vertexLabel && marker.label.replaceAll(" ", "") === `∠${vertexLabel}`
        ? { ...marker, label: null }
        : marker;
    }),
  };
  for (let pass = 0; pass < 3; pass += 1) {
    const result = lessonSummaryDiagramSpecSchema.safeParse(current);
    if (result.success) return result.data;
    const markerIndices = indexedIssueTargets(result.error, "markers");
    const labelIndices = indexedIssueTargets(
      result.error,
      "labels",
      shouldDiscardDiagramLabelIssue,
    );
    if (markerIndices.size === 0 && labelIndices.size === 0) {
      return current;
    }
    current = {
      ...current,
      markers: current.markers.filter((_, index) => !markerIndices.has(index)),
      labels: current.labels.filter((_, index) => !labelIndices.has(index)),
    };
  }
  return current;
}

function indexedIssueTargets(
  error: z.ZodError,
  collection: string,
  matches: (issue: z.core.$ZodIssue) => boolean = () => true,
) {
  return new Set(
    error.issues.flatMap((issue) => {
      if (!matches(issue)) return [];
      const collectionIndex = issue.path.indexOf(collection);
      const index = issue.path[collectionIndex + 1];
      return collectionIndex >= 0 && typeof index === "number" ? [index] : [];
    }),
  );
}

function shouldDiscardDiagramLabelIssue(issue: z.core.$ZodIssue) {
  return [
    "Do not write segment names or equalities as diagram text",
    "Length values must anchor to their corresponding SEGMENT",
    "Label references unknown point",
    "Duplicate label:",
  ].some((message) => issue.message.includes(message));
}

function hasVisibleText(value: string) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 && code !== 127;
  });
}

function toProviderRawDiagram(
  spec: LessonSummaryDiagramSpec,
): LessonSummaryProviderDiagramInput {
  const segments: Array<Record<string, unknown>> = [];
  const lines: Array<Record<string, unknown>> = [];
  const rays: Array<Record<string, unknown>> = [];
  const polylines: Array<Record<string, unknown>> = [];
  const polygons: Array<Record<string, unknown>> = [];
  const circles: Array<Record<string, unknown>> = [];
  const ellipses: Array<Record<string, unknown>> = [];
  const arcs: Array<Record<string, unknown>> = [];
  spec.primitives.forEach(({ type, ...primitive }) => {
    const target = {
      SEGMENT: segments,
      LINE: lines,
      RAY: rays,
      POLYLINE: polylines,
      POLYGON: polygons,
      CIRCLE: circles,
      ELLIPSE: ellipses,
      ARC: arcs,
    }[type];
    target.push(primitive);
  });
  return {
    kind: "RAW_SPEC",
    spec: {
      version: 1,
      coordinateSystem: "CARTESIAN",
      viewBox: spec.viewBox,
      toScale: true,
      points: spec.points.map((point) => ({
        ...point,
        pointStyle: point.pointStyle ?? "NONE",
      })),
      primitives: {
        segments,
        lines,
        rays,
        polylines,
        polygons,
        circles,
        ellipses,
        arcs,
      },
      markers: {
        rightAngles: spec.markers.flatMap(({ type, ...marker }) =>
          type === "RIGHT_ANGLE" ? [marker] : [],
        ),
        equalLengths: spec.markers.flatMap(({ type, ...marker }) =>
          type === "EQUAL_LENGTH" ? [marker] : [],
        ),
        parallels: spec.markers.flatMap(({ type, ...marker }) =>
          type === "PARALLEL" ? [marker] : [],
        ),
        angles: spec.markers.flatMap(({ type, ...marker }) =>
          type === "ANGLE" ? [marker] : [],
        ),
      },
      labels: spec.labels.map((label) => ({
        ...label,
        anchorPrimitiveId: label.anchorPrimitiveId ?? null,
      })),
      caption: spec.caption,
    },
  } as LessonSummaryProviderDiagramInput;
}

function formatZodIssues(error: z.ZodError) {
  return error.issues
    .slice(0, 12)
    .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
    .join("\n");
}

function formatCompiledSemanticIssues(
  issues: Array<{ code: string; message: string }>,
) {
  if (issues.length === 0) return null;
  return issues
    .slice(0, 12)
    .map((issue) => `${issue.code}: ${issue.message}`)
    .join("\n");
}
