import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { lessonSummaryDiagramSpecStructuralSchema } from "@learning-path/shared";

import {
  lessonSummaryOutputSchema,
  lessonSummaryProviderOutputSchema,
  lessonSummaryProviderTransportOutputSchema,
} from "#api/modules/ai/types/lesson-summary.types";
import { mapLessonSummaryProviderOutput } from "#api/modules/ai/utils/lesson-summary-mapper";
import { recoverLessonSummaryProviderOutput } from "#api/modules/ai/utils/lesson-summary-recovery";
import {
  describeLessonSummaryDiagramReviewIssue,
  simplifyLessonSummaryReviewCopy,
} from "#api/modules/ai/utils/lesson-summary-review-copy";
import { buildLessonSummarySourceTopics } from "#api/modules/ai/utils/lesson-summary-source-candidates";
import {
  improveLessonSummaryReviewIssueCopy,
  listUnresolvedLessonSummaryReviewIssues,
  reconcileLessonSummaryReviewIssues,
} from "#api/modules/learning-paths/utils/lesson-summary-review";

const chunkId = "11111111-1111-4111-8111-111111111111";
const contextChunks = [
  {
    id: chunkId,
    content:
      "Cạnh huyền và một cạnh góc vuông. Hai tam giác vuông có cạnh huyền và một cạnh góc vuông tương ứng bằng nhau thì bằng nhau.",
  },
];
const sourceTopicId = buildLessonSummarySourceTopics(contextChunks)[0]!.id;

function point(id: string, x: number, y: number, label: string) {
  return {
    id,
    x,
    y,
    label,
    pointStyle: "NONE" as const,
    labelPosition: "TOP" as const,
  };
}

function invalidRelationDiagram() {
  return {
    kind: "RAW_SPEC" as const,
    spec: {
      version: 1 as const,
      coordinateSystem: "CARTESIAN" as const,
      viewBox: { minX: -1, minY: -1, width: 8, height: 6 },
      toScale: true as const,
      points: [
        point("A", 0, 4, "A"),
        point("B", 0, 0, "B"),
        point("C", 6, 0, "C"),
        point("D", 3, 2, "D"),
      ],
      primitives: {
        segments: [
          { id: "AB", from: "A", to: "B", style: "SOLID" as const },
          { id: "AC", from: "A", to: "C", style: "SOLID" as const },
          { id: "BC", from: "B", to: "C", style: "SOLID" as const },
          { id: "AD", from: "A", to: "D", style: "SOLID" as const },
          { id: "DC", from: "D", to: "C", style: "SOLID" as const },
        ],
        lines: [],
        rays: [],
        polylines: [],
        polygons: [],
        circles: [],
        ellipses: [],
        arcs: [],
      },
      markers: {
        rightAngles: [],
        equalLengths: [
          { segmentIds: ["AB", "AD"], markCount: 1 },
          { segmentIds: ["BC", "BC"], markCount: 2 },
        ],
        parallels: [],
        angles: [],
      },
      labels: [],
      caption: "Hai tam giác vuông dùng để minh họa định lí.",
    },
  };
}

function incompleteRightTriangleCongruenceIntent() {
  return {
    kind: "INTENT" as const,
    intent: {
      intentVersion: 1 as const,
      grade: 7,
      difficulty: "MEDIUM" as const,
      caption: "Hai tam giác vuông có cạnh huyền và một cạnh góc vuông bằng nhau.",
      family: "PLANE_GEOMETRY" as const,
      archetype: "RIGHT_TRIANGLE_CONGRUENCE" as const,
      variant: "HYPOTENUSE_LEG" as const,
      pointLabels: ["A", "B", "C", "A′", "B′"],
      measures: [],
    },
  };
}

function semanticallyIncompleteRightTriangleCongruenceIntent() {
  const diagram = incompleteRightTriangleCongruenceIntent();
  return {
    ...diagram,
    intent: {
      ...diagram.intent,
      pointLabels: ["A", "B", "C", "A′", "B′", "C′", "D"],
    },
  };
}

const compilerFailureDiagrams = [
  {
    name: "number line with a non-increasing domain",
    diagram: {
      kind: "INTENT" as const,
      intent: {
        intentVersion: 1 as const,
        grade: 7,
        difficulty: "SIMPLE" as const,
        caption: "Trục số có miền chưa hợp lệ.",
        family: "NUMBER_COORDINATE" as const,
        archetype: "NUMBER_LINE" as const,
        min: 2,
        max: 2,
        step: 1,
        points: [],
      },
    },
  },
  {
    name: "elementary scale with too many major ticks",
    diagram: {
      kind: "INTENT" as const,
      intent: {
        intentVersion: 1 as const,
        grade: 4,
        difficulty: "SIMPLE" as const,
        caption: "Thước đo có quá nhiều vạch chính.",
        family: "ELEMENTARY_MODEL" as const,
        archetype: "MEASUREMENT_SCALE" as const,
        variant: "RULER" as const,
        min: 0,
        max: 100,
        step: 1,
        value: 50,
        unit: "cm",
      },
    },
  },
  {
    name: "graph with a non-increasing x domain",
    diagram: {
      kind: "INTENT" as const,
      intent: {
        intentVersion: 1 as const,
        grade: 9,
        difficulty: "MEDIUM" as const,
        caption: "Đồ thị có miền chưa hợp lệ.",
        family: "ALGEBRA_GRAPH" as const,
        archetype: "LINEAR_FUNCTION" as const,
        xMin: 1,
        xMax: 1,
        yMin: -5,
        yMax: 5,
        xStep: 1,
        yStep: 1,
        functions: [
          {
            kind: "LINEAR" as const,
            id: "f",
            label: "y = x",
            slope: 1,
            intercept: 0,
            constructionXs: [-1, 1],
          },
        ],
      },
    },
  },
  {
    name: "data table with an inconsistent row",
    diagram: {
      kind: "INTENT" as const,
      intent: {
        intentVersion: 1 as const,
        grade: 6,
        difficulty: "SIMPLE" as const,
        caption: "Bảng giá trị chưa đủ ô.",
        family: "DATA_STATISTICS" as const,
        archetype: "VALUE_TABLE" as const,
        columns: ["x", "y"],
        rows: [["0"]],
      },
    },
  },
  {
    name: "advanced geometry with too few construction labels",
    diagram: {
      kind: "INTENT" as const,
      intent: {
        intentVersion: 1 as const,
        grade: 9,
        difficulty: "HARD" as const,
        caption: "Ba đường trung tuyến của tam giác.",
        family: "ADVANCED_GEOMETRY" as const,
        archetype: "TRIANGLE_CENTROID" as const,
        variant: "THREE_MEDIANS" as const,
        pointLabels: ["A", "B", "C", "G"],
        measures: [],
      },
    },
  },
  {
    name: "schematic with no set labels",
    diagram: {
      kind: "INTENT" as const,
      intent: {
        intentVersion: 1 as const,
        grade: 6,
        difficulty: "SIMPLE" as const,
        caption: "Sơ đồ Venn chưa có tên tập hợp.",
        family: "SET_SCHEMATIC" as const,
        archetype: "VENN" as const,
        nodes: [{ id: "n1", label: "1", group: null }],
        edges: [],
        setLabels: [],
      },
    },
  },
] as const;

function providerOutput() {
  return {
    title: "Ba trường hợp bằng nhau của tam giác vuông",
    objectives: ["Nhận biết trường hợp cạnh huyền và cạnh góc vuông."],
    theorySections: [
      {
        sourceTopicId,
        displayHeading: "Cạnh huyền và một cạnh góc vuông",
        sourceChunkIds: [chunkId],
        units: [
          {
            theory: {
              type: "theorem" as const,
              title: "Cạnh huyền và một cạnh góc vuông",
              content:
                "Nếu cạnh huyền và một cạnh góc vuông tương ứng bằng nhau thì hai tam giác vuông bằng nhau.",
              sourceChunkIds: [chunkId],
              diagramSpec: invalidRelationDiagram(),
            },
            illustration: {
              type: "example" as const,
              exampleKind: "ILLUSTRATION" as const,
              problem: "Chứng minh hai tam giác vuông bằng nhau.",
              solution: "Áp dụng trường hợp cạnh huyền - cạnh góc vuông.",
              answer: "Hai tam giác bằng nhau.",
              diagramSpec: invalidRelationDiagram(),
            },
            notes: [],
          },
        ],
      },
    ],
    applicationExercises: {
      displayHeading: "Bài tập vận dụng" as const,
      standardExercise: {
        type: "example" as const,
        exampleKind: "STANDARD_EXERCISE" as const,
        problem: "Nêu trường hợp bằng nhau đã dùng.",
        solution: "Đối chiếu cạnh huyền và cạnh góc vuông.",
        answer: "Cạnh huyền - cạnh góc vuông.",
        diagramSpec: null,
      },
      realWorldExercise: {
        type: "example" as const,
        exampleKind: "REAL_WORLD_EXERCISE" as const,
        problem: "Hai khung đỡ vuông có các cạnh tương ứng bằng nhau. So sánh chúng.",
        solution: "Mô hình hóa thành hai tam giác vuông.",
        answer: "Hai khung đỡ bằng nhau.",
        diagramSpec: null,
      },
    },
  };
}

function recoverAndMap(value = providerOutput()) {
  const transport = lessonSummaryProviderTransportOutputSchema.parse(value);
  const recovery = recoverLessonSummaryProviderOutput({
    output: transport,
    contextChunks,
  });
  return mapLessonSummaryProviderOutput({
    lessonId: "lesson-15",
    output: recovery.output,
    contextChunks,
    reviewIssuesByPath: recovery.reviewIssuesByPath,
    rootReviewIssues: recovery.rootReviewIssues,
  });
}

describe("M9.2 partial lesson-summary recovery", () => {
  it("names the exact equal-length relation that needs review", () => {
    expect(
      describeLessonSummaryDiagramReviewIssue(
        "spec.markers.equalLengths.1.segmentIds: EQUAL_LENGTH segments must have coordinate lengths within 2%: AC, A_primeC_prime.",
      ),
    ).toEqual({
      message:
        "Các đoạn AC và A′C′ được đánh dấu bằng nhau nhưng độ dài theo tọa độ chưa khớp.",
      suggestion:
        "Điều chỉnh tọa độ để AC và A′C′ có cùng độ dài, hoặc bỏ ký hiệu bằng nhau nếu đề không có giả thiết này.",
    });
  });

  it.each([
    {
      detail:
        "spec.primitives: Cartesian axes require at least two visible unit tick segments on each axis.",
      message: "Mỗi trục tọa độ chưa có đủ các vạch chia đơn vị nhìn thấy được.",
    },
    {
      detail:
        "spec.points.3.label: Every visible graph construction point requires a unique short point name: P_aux.",
      message: "Điểm dựng Paux đang hiển thị nhưng chưa có tên ngắn duy nhất.",
    },
    {
      detail:
        "spec.markers.0.segmentIds.1: PARALLEL references missing or non-segment primitive MN.",
      message: "Ký hiệu song song đang tham chiếu các đoạn MN chưa được khai báo hợp lệ.",
    },
    {
      detail:
        "spec.markers.3.segmentIds.0: EQUAL_LENGTH references missing or non-segment primitive BM_part.\nspec.markers.3.segmentIds.1: EQUAL_LENGTH references missing or non-segment primitive CM_part.",
      message:
        "Ký hiệu bằng nhau đang tham chiếu các đoạn BM và CM chưa được khai báo hợp lệ.",
    },
    {
      detail:
        "spec.labels: A clock face requires the four cardinal labels 12, 3, 6 and 9.",
      message: "Mặt đồng hồ đang thiếu một hoặc nhiều số 12, 3, 6, 9.",
    },
    {
      detail: "spec.viewBox.width: Too small: expected number to be >0",
      message: "Dữ liệu khung hiển thị chưa hợp lệ theo quy tắc vẽ.",
    },
  ])("provides actionable copy for diagram validator family: $message", (fixture) => {
    expect(describeLessonSummaryDiagramReviewIssue(fixture.detail)?.message).toBe(
      fixture.message,
    );
  });

  it("keeps difficult internal terms out of the admin-facing problem and suggestion", () => {
    const copy = simplifyLessonSummaryReviewCopy({
      message:
        "DiagramSpec invalid tại viewBox; marker dùng primitive ID và field answer trong JSON context.",
      suggestion:
        "Sửa diagramSpec.primitives.segments và segmentIds, đặt label là null rồi kiểm tra backend.",
    });

    expect(`${copy.message} ${copy.suggestion}`).not.toMatch(
      /\b(?:diagramSpec|viewBox|marker|primitive|ID|field|answer|JSON|context|segmentIds|label|null|backend)\b/iu,
    );
    expect(copy.message).toContain("khung hiển thị");
    expect(copy.suggestion).toContain("danh sách đoạn thẳng");
  });

  it("also cleans difficult copy from persisted non-diagram review issues on read", () => {
    const content = {
      type: "lesson_summary_blocks",
      data: {
        reviewIssues: [
          {
            id: "issue-legacy-block",
            code: "BLOCK_SCHEMA_INVALID",
            path: "sections.0.blocks.0.answer",
            message: "Field answer invalid trong JSON context.",
            suggestion: "Sửa field answer, không để null, rồi kiểm tra backend.",
            technicalDetails: "sections.0.blocks.0.answer: Required field is empty.",
            fingerprint: "b".repeat(64),
            accepted: false,
          },
        ],
        sections: [],
      },
    };

    const improved = improveLessonSummaryReviewIssueCopy(content) as typeof content;
    const issue = improved.data.reviewIssues[0]!;
    expect(`${issue.message} ${issue.suggestion}`).not.toMatch(
      /\b(?:field|answer|invalid|JSON|context|null|backend)\b/iu,
    );
    expect(issue.technicalDetails).toContain("Required field");
  });

  it("upgrades generic copy in an existing persisted review issue on read", () => {
    const technicalDetails =
      "spec.markers.equalLengths.1.segmentIds: EQUAL_LENGTH segments must have coordinate lengths within 2%: AC, A_primeC_prime.";
    const content = {
      type: "lesson_summary_blocks",
      data: {
        sections: [
          {
            blocks: [
              {
                reviewIssues: [
                  {
                    id: "issue-1",
                    code: "DIAGRAM_NEEDS_REVIEW",
                    path: "sections.0.blocks.0.visual.spec",
                    message: "Hình vẽ còn chi tiết chưa khớp quy tắc toán học.",
                    suggestion: "Kiểm tra hình vẽ.",
                    technicalDetails,
                    fingerprint: "a".repeat(64),
                    accepted: false,
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const improved = improveLessonSummaryReviewIssueCopy(content) as typeof content;
    expect(improved.data.sections[0]!.blocks[0]!.reviewIssues[0]).toEqual(
      expect.objectContaining({
        message:
          "Các đoạn AC và A′C′ được đánh dấu bằng nhau nhưng độ dài theo tọa độ chưa khớp.",
      }),
    );
  });

  it("keeps accepted blocks on the existing mapper path without metadata changes", () => {
    const value = providerOutput();
    value.theorySections[0]!.units[0]!.theory.diagramSpec = null;
    value.theorySections[0]!.units[0]!.illustration.diagramSpec = null;
    const accepted = lessonSummaryProviderOutputSchema.parse(value);
    const direct = mapLessonSummaryProviderOutput({
      lessonId: "lesson-15",
      output: accepted,
      contextChunks,
    });
    expect(recoverAndMap(value)).toEqual(direct);
  });

  it("keeps a render-safe diagram and marks only its block for review", () => {
    const value = providerOutput();
    expect(() => lessonSummaryProviderOutputSchema.parse(value)).toThrow();
    expect(() => lessonSummaryProviderTransportOutputSchema.parse(value)).not.toThrow();

    const summary = recoverAndMap(value);
    expect(() => lessonSummaryOutputSchema.parse(summary)).not.toThrow();
    const theorem = summary.sections[0]!.blocks[0]!;
    expect(theorem.visual?.kind).toBe("DIAGRAM_SPEC");
    expect(theorem.reviewIssues).toEqual([
      expect.objectContaining({
        code: "DIAGRAM_NEEDS_REVIEW",
        accepted: false,
        message:
          "Các đoạn AB và AD được đánh dấu bằng nhau nhưng độ dài theo tọa độ chưa khớp.",
        suggestion:
          "Điều chỉnh tọa độ để AB và AD có cùng độ dài, hoặc bỏ ký hiệu bằng nhau nếu đề không có giả thiết này.",
      }),
    ]);
    if (theorem.visual?.kind === "DIAGRAM_SPEC") {
      expect(theorem.visual.spec.markers).toHaveLength(0);
      expect(theorem.visual.spec.primitives.length).toBeGreaterThan(0);
    }
    expect(summary.sections.at(-1)?.blocks).toHaveLength(2);
  });

  it("drops redundant equality text without leaving a review badge when markers are valid", () => {
    const value = providerOutput();
    const diagram = value.theorySections[0]!.units[0]!.theory.diagramSpec;
    if (!diagram || diagram.kind !== "RAW_SPEC") {
      throw new Error("Expected RAW_SPEC fixture.");
    }
    const pointD = diagram.spec.points.find((candidate) => candidate.id === "D");
    if (!pointD) throw new Error("Expected point D in fixture.");
    pointD.x = 4;
    pointD.y = 4;
    diagram.spec.markers.equalLengths = [{ segmentIds: ["AB", "AD"], markCount: 1 }];
    diagram.spec.labels = [
      {
        text: "AB = AB",
        anchorPointId: "A",
        anchorPrimitiveId: "AB",
        position: "TOP",
      },
    ];
    value.theorySections[0]!.units[0]!.illustration.diagramSpec = null;

    const summary = recoverAndMap(value);
    const theorem = summary.sections[0]!.blocks[0]!;
    expect(theorem.reviewIssues).toBeUndefined();
    if (theorem.visual?.kind === "DIAGRAM_SPEC") {
      expect(theorem.visual.spec.labels).toHaveLength(0);
      expect(theorem.visual.spec.markers).toHaveLength(1);
    }
  });

  it("drops an unanchored optional length label without treating the diagram as an error", () => {
    const value = providerOutput();
    const diagram = value.theorySections[0]!.units[0]!.theory.diagramSpec;
    if (!diagram || diagram.kind !== "RAW_SPEC") {
      throw new Error("Expected RAW_SPEC fixture.");
    }
    diagram.spec.markers = {
      rightAngles: [],
      equalLengths: [],
      parallels: [],
      angles: [],
    };
    diagram.spec.labels = [
      {
        text: "3 cm",
        anchorPointId: "A",
        anchorPrimitiveId: null,
        position: "TOP",
      },
    ];
    value.theorySections[0]!.units[0]!.illustration.diagramSpec = null;

    const summary = recoverAndMap(value);
    const theorem = summary.sections[0]!.blocks[0]!;
    expect(theorem.reviewIssues).toBeUndefined();
    expect(theorem.visual?.kind).toBe("DIAGRAM_SPEC");
    if (theorem.visual?.kind === "DIAGRAM_SPEC") {
      expect(theorem.visual.spec.labels).toEqual([]);
      expect(theorem.visual.spec.primitives.length).toBeGreaterThan(0);
    }
  });

  it("normalizes deleted or blank optional diagram text instead of rejecting the diagram", () => {
    const parsed = lessonSummaryDiagramSpecStructuralSchema.parse({
      version: 1,
      coordinateSystem: "CARTESIAN",
      viewBox: { minX: -1, minY: -1, width: 4, height: 4 },
      toScale: true,
      points: [
        { id: "A", x: 0, y: 0, pointStyle: "NONE" },
        {
          id: "B",
          x: 2,
          y: 0,
          label: "",
          pointStyle: "NONE",
          labelPosition: null,
        },
        {
          id: "C",
          x: 0,
          y: 2,
          label: "C",
          pointStyle: "NONE",
          labelPosition: "TOP",
        },
      ],
      primitives: [
        { id: "AB", type: "SEGMENT", from: "A", to: "B", style: "SOLID" },
        { id: "AC", type: "SEGMENT", from: "A", to: "C", style: "SOLID" },
      ],
      markers: [
        {
          type: "ANGLE",
          vertex: "A",
          armPointIds: ["B", "C"],
          label: "",
        },
      ],
      labels: [
        {
          text: "",
          anchorPointId: "A",
          anchorPrimitiveId: "AB",
          position: "TOP",
        },
      ],
      caption: "",
    });

    expect(parsed.points[0]).toEqual(expect.objectContaining({ label: null }));
    expect(parsed.points[0]!.labelPosition).toBeNull();
    expect(parsed.points[1]!.label).toBeNull();
    expect(parsed.markers[0]).toEqual(expect.objectContaining({ label: null }));
    expect(parsed.labels).toEqual([]);
    expect(parsed.caption).toBeNull();
  });

  it("accepts blank provider decorations and keeps the underlying geometry", () => {
    const value = providerOutput();
    const diagram = value.theorySections[0]!.units[0]!.theory.diagramSpec;
    if (!diagram || diagram.kind !== "RAW_SPEC") {
      throw new Error("Expected RAW_SPEC fixture.");
    }
    diagram.spec.points[0]!.label = "";
    diagram.spec.caption = "";
    diagram.spec.markers = {
      rightAngles: [],
      equalLengths: [],
      parallels: [],
      angles: [
        {
          vertex: "B",
          armPointIds: ["A", "C"],
          label: "",
        },
      ],
    };
    diagram.spec.labels = [
      {
        text: "",
        anchorPointId: "A",
        anchorPrimitiveId: "AB",
        position: "TOP",
      },
    ];
    value.theorySections[0]!.units[0]!.illustration.diagramSpec = null;

    const theorem = recoverAndMap(value).sections[0]!.blocks[0]!;
    expect(theorem.reviewIssues).toBeUndefined();
    expect(theorem.visual?.kind).toBe("DIAGRAM_SPEC");
    if (theorem.visual?.kind === "DIAGRAM_SPEC") {
      expect(theorem.visual.spec.points[0]!.label).toBeNull();
      expect(theorem.visual.spec.labels).toEqual([]);
      expect(theorem.visual.spec.caption).toBeNull();
      expect(theorem.visual.spec.markers).toEqual([
        expect.objectContaining({ type: "ANGLE", label: null }),
      ]);
    }
  });

  it("removes a repeated angle name but keeps the angle marker without a review", () => {
    const value = providerOutput();
    const diagram = value.theorySections[0]!.units[0]!.theory.diagramSpec;
    if (!diagram || diagram.kind !== "RAW_SPEC") {
      throw new Error("Expected RAW_SPEC fixture.");
    }
    diagram.spec.markers = {
      rightAngles: [],
      equalLengths: [],
      parallels: [],
      angles: [
        {
          vertex: "B",
          armPointIds: ["A", "C"],
          label: "∠B",
        },
      ],
    };
    diagram.spec.labels = [];
    value.theorySections[0]!.units[0]!.illustration.diagramSpec = null;

    const theorem = recoverAndMap(value).sections[0]!.blocks[0]!;
    expect(theorem.reviewIssues).toBeUndefined();
    expect(theorem.visual?.kind).toBe("DIAGRAM_SPEC");
    if (theorem.visual?.kind === "DIAGRAM_SPEC") {
      expect(theorem.visual.spec.markers).toEqual([
        expect.objectContaining({ type: "ANGLE", label: null }),
      ]);
    }
  });

  it("keeps an important but misplaced label visible and requests review", () => {
    const value = providerOutput();
    const diagram = value.theorySections[0]!.units[0]!.theory.diagramSpec;
    if (!diagram || diagram.kind !== "RAW_SPEC") {
      throw new Error("Expected RAW_SPEC fixture.");
    }
    diagram.spec.caption = "Bảng số liệu";
    diagram.spec.markers = {
      rightAngles: [],
      equalLengths: [],
      parallels: [],
      angles: [],
    };
    diagram.spec.labels = [
      {
        text: "7",
        anchorPointId: "A",
        anchorPrimitiveId: null,
        position: "TOP",
      },
    ];
    value.theorySections[0]!.units[0]!.illustration.diagramSpec = null;

    const theorem = recoverAndMap(value).sections[0]!.blocks[0]!;
    expect(theorem.reviewIssues).toEqual([
      expect.objectContaining({
        code: "DIAGRAM_NEEDS_REVIEW",
        message: "Một hoặc nhiều giá trị trong bảng chưa được căn giữa ô.",
      }),
    ]);
    expect(theorem.visual?.kind).toBe("DIAGRAM_SPEC");
    if (theorem.visual?.kind === "DIAGRAM_SPEC") {
      expect(theorem.visual.spec.labels).toEqual([
        expect.objectContaining({ text: "7", position: "TOP" }),
      ]);
    }
  });

  it("keeps graph geometry when a visible construction point only lacks its name", () => {
    const value = providerOutput();
    const diagram = value.theorySections[0]!.units[0]!.theory.diagramSpec;
    if (!diagram || diagram.kind !== "RAW_SPEC") {
      throw new Error("Expected RAW_SPEC fixture.");
    }
    diagram.spec.points[0]!.label = null;
    diagram.spec.points[0]!.pointStyle = "FILLED";
    diagram.spec.caption = "Mặt phẳng tọa độ Oxy";
    diagram.spec.markers = {
      rightAngles: [],
      equalLengths: [],
      parallels: [],
      angles: [],
    };
    value.theorySections[0]!.units[0]!.illustration.diagramSpec = null;

    const theorem = recoverAndMap(value).sections[0]!.blocks[0]!;
    expect(theorem.visual?.kind).toBe("DIAGRAM_SPEC");
    expect(theorem.reviewIssues).toEqual([
      expect.objectContaining({ code: "DIAGRAM_NEEDS_REVIEW" }),
    ]);
    if (theorem.visual?.kind === "DIAGRAM_SPEC") {
      expect(theorem.visual.spec.points.some((candidate) => candidate.id === "A")).toBe(
        true,
      );
      expect(theorem.visual.spec.primitives.length).toBeGreaterThan(0);
    }
  });

  it("still rejects a diagram when none of its primitives can be drawn", () => {
    const value = providerOutput();
    const diagram = value.theorySections[0]!.units[0]!.theory.diagramSpec;
    if (!diagram || diagram.kind !== "RAW_SPEC") {
      throw new Error("Expected RAW_SPEC fixture.");
    }
    diagram.spec.primitives = {
      segments: [{ id: "AZ", from: "A", to: "Z", style: "SOLID" }],
      lines: [],
      rays: [],
      polylines: [],
      polygons: [],
      circles: [],
      ellipses: [],
      arcs: [],
    };
    diagram.spec.markers = {
      rightAngles: [],
      equalLengths: [],
      parallels: [],
      angles: [],
    };
    diagram.spec.labels = [];
    value.theorySections[0]!.units[0]!.illustration.diagramSpec = null;

    const theorem = recoverAndMap(value).sections[0]!.blocks[0]!;
    expect(theorem.visual).toBeUndefined();
    expect(theorem.reviewIssues).toEqual([
      expect.objectContaining({
        code: "DIAGRAM_CANNOT_RENDER",
        resolution: "FIX_ONLY",
      }),
    ]);
  });

  it("keeps a structurally drawable intent visible when only semantic point declarations are incomplete", () => {
    const value = providerOutput();
    value.theorySections[0]!.units[0]!.theory.diagramSpec =
      semanticallyIncompleteRightTriangleCongruenceIntent();
    value.theorySections[0]!.units[0]!.illustration.diagramSpec = null;

    expect(() => lessonSummaryProviderTransportOutputSchema.parse(value)).not.toThrow();
    expect(() => recoverAndMap(value)).not.toThrow();

    const summary = recoverAndMap(value);
    const theorem = summary.sections[0]!.blocks[0]!;
    expect(theorem.visual?.kind).toBe("DIAGRAM_SPEC");
    if (theorem.visual?.kind === "DIAGRAM_SPEC") {
      expect(theorem.visual.spec.points.length).toBeGreaterThanOrEqual(3);
      expect(theorem.visual.spec.primitives.length).toBeGreaterThan(0);
    }
    expect(theorem.reviewIssues).toEqual([
      expect.objectContaining({
        code: "DIAGRAM_NEEDS_REVIEW",
        resolution: "ACCEPT_OR_FIX",
        accepted: false,
        technicalDetails: expect.stringContaining("DECLARED_POINT_LABEL_MISSING"),
      }),
    ]);
    expect(summary.sections[0]!.blocks[1]!.type).toBe("example");
    expect(summary.sections.at(-1)?.blocks).toHaveLength(2);
    expect(() => lessonSummaryOutputSchema.parse(summary)).not.toThrow();
  });

  it.each(compilerFailureDiagrams)("isolates compiler failure: $name", ({ diagram }) => {
    const value = providerOutput();
    value.theorySections[0]!.units[0]!.theory.diagramSpec = diagram;
    value.theorySections[0]!.units[0]!.illustration.diagramSpec = null;

    const summary = recoverAndMap(value);
    const theorem = summary.sections[0]!.blocks[0]!;
    expect(theorem.visual).toBeUndefined();
    expect(theorem.reviewIssues).toEqual([
      expect.objectContaining({
        code: "DIAGRAM_CANNOT_RENDER",
        resolution: "FIX_ONLY",
        accepted: false,
      }),
    ]);
    expect(summary.sections[0]!.blocks[1]!.type).toBe("example");
    expect(summary.sections.at(-1)?.blocks).toHaveLength(2);
    expect(() => lessonSummaryOutputSchema.parse(summary)).not.toThrow();
  });

  it("keeps the mapper itself block-safe even when a caller skips recovery", () => {
    const value = providerOutput();
    value.theorySections[0]!.units[0]!.theory.diagramSpec =
      incompleteRightTriangleCongruenceIntent();
    value.theorySections[0]!.units[0]!.illustration.diagramSpec = null;
    const accepted = lessonSummaryProviderOutputSchema.parse(value);

    expect(() =>
      mapLessonSummaryProviderOutput({
        lessonId: "lesson-15",
        output: accepted,
        contextChunks,
      }),
    ).not.toThrow();

    const summary = mapLessonSummaryProviderOutput({
      lessonId: "lesson-15",
      output: accepted,
      contextChunks,
    });
    expect(summary.sections[0]!.blocks[0]!.visual).toBeUndefined();
    expect(summary.sections[0]!.blocks[0]!.reviewIssues).toEqual([
      expect.objectContaining({ code: "DIAGRAM_CANNOT_RENDER" }),
    ]);
    expect(() => lessonSummaryOutputSchema.parse(summary)).not.toThrow();
  });

  it("keeps sibling blocks when an unexpected mapper error happens inside multiple blocks", () => {
    const value = providerOutput();
    value.theorySections[0]!.units[0]!.theory.diagramSpec = null;
    value.theorySections[0]!.units[0]!.illustration.diagramSpec = null;
    const accepted = lessonSummaryProviderOutputSchema.parse(value);
    (
      accepted.theorySections[0]!.units[0]!.theory as unknown as {
        content: unknown;
        title: unknown;
      }
    ).content = { invalid: true };
    (
      accepted.theorySections[0]!.units[0]!.theory as unknown as {
        title: unknown;
      }
    ).title = { invalid: true };
    (
      accepted.applicationExercises.standardExercise as unknown as {
        answer: unknown;
      }
    ).answer = { invalid: true };

    const summary = mapLessonSummaryProviderOutput({
      lessonId: "lesson-15",
      output: accepted,
      contextChunks,
    });

    expect(summary.sections[0]!.blocks[0]).toEqual(
      expect.objectContaining({
        type: "theorem",
        content: "[Cần bổ sung nội dung]",
        reviewIssues: [expect.objectContaining({ code: "BLOCK_CANNOT_PROCESS" })],
      }),
    );
    expect(summary.sections[0]!.blocks[1]!.type).toBe("example");
    expect(summary.sections.at(-1)!.blocks[0]).toEqual(
      expect.objectContaining({
        type: "example",
        answer: "[Cần bổ sung đáp án]",
        reviewIssues: [expect.objectContaining({ code: "BLOCK_CANNOT_PROCESS" })],
      }),
    );
    expect(summary.sections.at(-1)!.blocks[1]!.type).toBe("example");
    expect(() => lessonSummaryOutputSchema.parse(summary)).not.toThrow();
  });

  it("recovers required text that would normalize to an empty value", () => {
    const value = providerOutput();
    value.theorySections[0]!.units[0]!.theory.diagramSpec = null;
    value.theorySections[0]!.units[0]!.illustration.diagramSpec = null;
    value.applicationExercises.standardExercise.answer = String.fromCharCode(7);

    const summary = recoverAndMap(value);
    const standardExercise = summary.sections.at(-1)!.blocks[0]!;
    expect(standardExercise.type).toBe("example");
    if (standardExercise.type === "example") {
      expect(standardExercise.answer).toBe("[Cần bổ sung đáp án]");
    }
    expect(standardExercise.reviewIssues).toEqual([
      expect.objectContaining({
        code: "MISSING_REQUIRED_FIELD",
        resolution: "FIX_ONLY",
        path: "applicationExercises.standardExercise.answer",
      }),
    ]);
    expect(() => lessonSummaryOutputSchema.parse(summary)).not.toThrow();
  });

  it("recovers an empty required field without hiding sibling blocks", () => {
    const value = providerOutput();
    value.applicationExercises.standardExercise.answer = "";
    const summary = recoverAndMap(value);
    const standardExercise = summary.sections.at(-1)!.blocks[0]!;
    expect(standardExercise.type).toBe("example");
    if (standardExercise.type === "example") {
      expect(standardExercise.answer).toBe("[Cần bổ sung đáp án]");
    }
    expect(standardExercise.reviewIssues).toEqual([
      expect.objectContaining({
        code: "MISSING_REQUIRED_FIELD",
        path: "applicationExercises.standardExercise.answer",
      }),
    ]);
    expect(summary.sections.at(-1)!.blocks[1]!.type).toBe("example");
  });

  it("treats a deleted or blank diagram label text as deleting that label", () => {
    const summary = recoverAndMap();
    const block = summary.sections[0]!.blocks[1]!;
    if (block.type !== "example" || block.visual?.kind !== "DIAGRAM_SPEC") {
      throw new Error("Expected an example with a diagram.");
    }
    block.visual.spec.markers = [];
    block.visual.spec.labels = [
      {
        text: "4 cm",
        anchorPointId: "A",
        anchorPrimitiveId: "AB",
        position: "CENTER",
      },
      {
        text: "4 cm",
        anchorPointId: "A",
        anchorPrimitiveId: "AD",
        position: "CENTER",
      },
    ];
    const originalFingerprint = createHash("sha256")
      .update(JSON.stringify(block.visual.spec))
      .digest("hex");
    block.reviewIssues = [
      {
        id: "DIAGRAM_NEEDS_REVIEW-label-edit",
        code: "DIAGRAM_NEEDS_REVIEW",
        path: "sections.0.blocks.1.visual.spec",
        message: "Hình vẽ cần được kiểm tra.",
        suggestion: "Sửa hoặc xóa nhãn chưa đúng.",
        fingerprint: originalFingerprint,
        accepted: false,
      },
    ];
    block.visual.spec.labels = [
      {
        text: "   ",
        anchorPointId: "A",
        anchorPrimitiveId: "AB",
        position: "CENTER",
      },
      {
        anchorPointId: "A",
        anchorPrimitiveId: "AD",
        position: "CENTER",
      },
    ] as typeof block.visual.spec.labels;

    const content = { type: "lesson_summary_blocks", version: 2, data: summary };
    const reconciled = reconcileLessonSummaryReviewIssues(content);
    const reconciledBlock = (reconciled.data as typeof summary).sections[0]!.blocks[1]!;

    expect(reconciledBlock.visual?.kind).toBe("DIAGRAM_SPEC");
    if (reconciledBlock.visual?.kind === "DIAGRAM_SPEC") {
      expect(reconciledBlock.visual.spec.labels).toEqual([]);
    }
    expect(reconciledBlock.reviewIssues).toBeUndefined();
  });

  it("preserves warnings until the block changes or the admin accepts them", () => {
    const summary = recoverAndMap();
    const content = { type: "lesson_summary_blocks", version: 2, data: summary };
    const firstPass = reconcileLessonSummaryReviewIssues(content);
    expect(listUnresolvedLessonSummaryReviewIssues(firstPass)).not.toHaveLength(0);

    const accepted = structuredClone(firstPass);
    const acceptedBlock = (accepted.data as typeof summary).sections[0]!.blocks[0]!;
    acceptedBlock.reviewIssues = acceptedBlock.reviewIssues?.map((issue) => ({
      ...issue,
      accepted: true,
    }));
    expect(listUnresolvedLessonSummaryReviewIssues(accepted)).toHaveLength(1);

    const edited = structuredClone(firstPass);
    const editedBlock = (edited.data as typeof summary).sections[0]!.blocks[0]!;
    if (editedBlock.visual?.kind === "DIAGRAM_SPEC") {
      editedBlock.visual.spec.caption = "Hai tam giác vuông sau khi admin đối chiếu lại.";
    }
    const reconciled = reconcileLessonSummaryReviewIssues(edited);
    const reconciledBlock = (reconciled.data as typeof summary).sections[0]!.blocks[0]!;
    expect(reconciledBlock.reviewIssues).toBeUndefined();
  });

  it("never resolves a fix-only issue from a forged accepted flag", () => {
    const value = providerOutput();
    value.theorySections[0]!.units[0]!.theory.diagramSpec =
      compilerFailureDiagrams[0]!.diagram;
    value.theorySections[0]!.units[0]!.illustration.diagramSpec = null;
    const summary = recoverAndMap(value);
    const content = { type: "lesson_summary_blocks", version: 2, data: summary };
    const hardIssue = summary.sections[0]!.blocks[0]!.reviewIssues?.[0];
    expect(hardIssue).toEqual(
      expect.objectContaining({
        code: "DIAGRAM_CANNOT_RENDER",
        resolution: "FIX_ONLY",
      }),
    );
    if (!hardIssue) throw new Error("Expected a hard diagram issue.");
    hardIssue.accepted = true;

    const reconciled = reconcileLessonSummaryReviewIssues(content);
    const reconciledBlock = (reconciled.data as typeof summary).sections[0]!.blocks[0]!;
    expect(reconciledBlock.reviewIssues?.[0]).toEqual(
      expect.objectContaining({
        resolution: "FIX_ONLY",
        accepted: false,
      }),
    );
    expect(listUnresolvedLessonSummaryReviewIssues(reconciled)).toContainEqual(
      expect.objectContaining({ code: "DIAGRAM_CANNOT_RENDER" }),
    );
  });
});
