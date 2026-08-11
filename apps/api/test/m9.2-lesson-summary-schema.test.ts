import { describe, expect, it } from "vitest";
import { zodTextFormat } from "openai/helpers/zod";
import {
  LESSON_SUMMARY_MAX_SYSTEM_INSTRUCTIONS_CHARACTERS,
  lessonSummaryDiagramSpecSchema,
  normalizeLessonSummaryDiagramSpec,
  normalizeLessonSummaryDiagramText,
  normalizeLessonSummaryNoteContent,
} from "@learning-path/shared";

import {
  LESSON_SUMMARY_MIN_OUTPUT_TOKENS,
  LESSON_SUMMARY_PROMPT_VERSION,
  LESSON_SUMMARY_SCHEMA_VERSION,
  lessonSummaryJobInputSchema,
  lessonSummaryOutputSchema,
  lessonSummaryProviderOutputSchema,
  lessonSummaryProviderTransportOutputSchema,
} from "#api/modules/ai/types/lesson-summary.types";
import {
  lessonSummaryProviderDiagramSpecSchema,
  mapLessonSummaryProviderDiagramSpec,
} from "#api/modules/ai/types/lesson-summary-provider-diagram.types";
import { buildAiUserPrompt } from "#api/modules/ai/utils/ai-prompt";
import { buildAiStructuredTextFormat } from "#api/modules/ai/utils/ai-structured-output-format";
import { mapLessonSummaryProviderOutput } from "#api/modules/ai/utils/lesson-summary-mapper";
import { buildLessonSummaryStructuredInput } from "#api/modules/ai/utils/lesson-summary-prompt";
import {
  buildLessonSummarySourceCandidates,
  buildLessonSummarySourceTopics,
} from "#api/modules/ai/utils/lesson-summary-source-candidates";

const ids = {
  theory: "11111111-1111-4111-8111-111111111111",
  example: "22222222-2222-4222-8222-222222222222",
  exercise: "33333333-3333-4333-8333-333333333333",
};
const contextChunks = [
  {
    id: ids.theory,
    content:
      "\\section*{1 SỐ HỮU TỈ}\nSố hữu tỉ là số viết được dưới dạng a/b, trong đó a, b là số nguyên và b khác 0.",
  },
  {
    id: ids.example,
    content: "Ví dụ: Chứng minh số 1/2 là một số hữu tỉ.",
  },
  {
    id: ids.exercise,
    content:
      "Luyện tập 1. Viết số 0,25 dưới dạng phân số.\n\nVận dụng 1. Một cửa hàng giảm giá chiếc áo 200 000 đồng đi 25%. Tính giá chiếc áo sau khi giảm.",
  },
];
const sourceTopicId = buildLessonSummarySourceTopics(contextChunks)[0]!.id;

function normalizeExpandedJsonSchema(schema: Record<string, unknown>) {
  const root = structuredClone(schema);
  const expandedRoot = Object.fromEntries(
    Object.entries(root).filter(
      ([key]) => key !== "$schema" && key !== "$defs" && key !== "definitions",
    ),
  );

  const resolveRef = (ref: string): unknown => {
    if (!ref.startsWith("#/")) throw new Error(`Unsupported local ref: ${ref}`);
    return ref
      .slice(2)
      .split("/")
      .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
      .reduce<unknown>((value, key) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          throw new Error(`Cannot resolve local ref: ${ref}`);
        }
        return (value as Record<string, unknown>)[key];
      }, root);
  };

  const expand = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(expand);
    if (!value || typeof value !== "object") return value;

    const objectValue = value as Record<string, unknown>;
    const ref = objectValue.$ref;
    if (typeof ref === "string") {
      const resolved = resolveRef(ref);
      if (!resolved || typeof resolved !== "object" || Array.isArray(resolved)) {
        throw new Error(`Local ref does not resolve to an object: ${ref}`);
      }
      const overlay = Object.fromEntries(
        Object.entries(objectValue).filter(([key]) => key !== "$ref"),
      );
      return expand({ ...(resolved as Record<string, unknown>), ...overlay });
    }

    return Object.fromEntries(
      Object.entries(objectValue).map(([key, child]) => [key, expand(child)]),
    );
  };

  return expand(expandedRoot);
}

function diagramPoint(id: string, x: number, y: number) {
  return {
    id,
    x,
    y,
    label: null,
    pointStyle: "NONE" as const,
    labelPosition: "TOP" as const,
  };
}

function diagramLabel(text: string, anchorPointId: string) {
  return {
    text,
    anchorPointId,
    anchorPrimitiveId: null,
    position: "CENTER" as const,
  };
}

function createQuadraticConstructionDiagram() {
  const curvePoints = Array.from({ length: 25 }, (_, index) => {
    const x = -3 + index * 0.25;
    const visibleConstructionX = new Set([-2, -1, 0, 1, 2]);
    const constructionNames = new Map([
      [-2, "A"],
      [-1, "B"],
      [0, "C"],
      [1, "D"],
      [2, "E"],
    ]);
    return {
      ...diagramPoint(`curve_${index}`, x, x * x - 4),
      label: constructionNames.get(x) ?? null,
      pointStyle: visibleConstructionX.has(x) ? ("FILLED" as const) : ("NONE" as const),
    };
  });
  return {
    version: 1 as const,
    coordinateSystem: "CARTESIAN" as const,
    viewBox: { minX: -5, minY: -5, width: 10, height: 12 },
    toScale: true as const,
    points: [
      diagramPoint("axisXL", -4.5, 0),
      diagramPoint("axisXR", 4.5, 0),
      diagramPoint("axisYB", 0, -4.5),
      diagramPoint("axisYT", 0, 6.5),
      diagramPoint("tickXNeg2A", -2, -0.08),
      diagramPoint("tickXNeg2B", -2, 0.08),
      diagramPoint("tickX2A", 2, -0.08),
      diagramPoint("tickX2B", 2, 0.08),
      diagramPoint("tickYNeg4A", -0.08, -4),
      diagramPoint("tickYNeg4B", 0.08, -4),
      diagramPoint("tickY4A", -0.08, 4),
      diagramPoint("tickY4B", 0.08, 4),
      diagramPoint("equationAnchor", 2.6, 4.6),
      ...curvePoints,
    ],
    primitives: [
      {
        id: "axisX",
        type: "LINE" as const,
        from: "axisXL",
        to: "axisXR",
        style: "SOLID" as const,
      },
      {
        id: "axisY",
        type: "LINE" as const,
        from: "axisYB",
        to: "axisYT",
        style: "SOLID" as const,
      },
      {
        id: "tickXNeg2",
        type: "SEGMENT" as const,
        from: "tickXNeg2A",
        to: "tickXNeg2B",
        style: "SOLID" as const,
      },
      {
        id: "tickX2",
        type: "SEGMENT" as const,
        from: "tickX2A",
        to: "tickX2B",
        style: "SOLID" as const,
      },
      {
        id: "tickYNeg4",
        type: "SEGMENT" as const,
        from: "tickYNeg4A",
        to: "tickYNeg4B",
        style: "SOLID" as const,
      },
      {
        id: "tickY4",
        type: "SEGMENT" as const,
        from: "tickY4A",
        to: "tickY4B",
        style: "SOLID" as const,
      },
      {
        id: "quadratic",
        type: "POLYLINE" as const,
        pointIds: curvePoints.map((point) => point.id),
        style: "SOLID" as const,
      },
    ],
    markers: [],
    labels: [
      diagramLabel("-2", "tickXNeg2A"),
      diagramLabel("2", "tickX2A"),
      diagramLabel("-4", "tickYNeg4A"),
      diagramLabel("4", "tickY4A"),
      diagramLabel("y=x²-4", "equationAnchor"),
    ],
    caption: "Đồ thị parabol y=x²-4 trên hệ trục Oxy.",
  };
}

function createProviderOutput() {
  return {
    title: "Số hữu tỉ",
    objectives: ["Nhận biết số hữu tỉ"],
    theorySections: [
      {
        sourceTopicId,
        displayHeading: "SỐ HỮU TỈ",
        sourceChunkIds: [ids.theory],
        units: [
          {
            theory: {
              type: "knowledge" as const,
              title: "Khái niệm số hữu tỉ",
              content:
                "Số hữu tỉ là số viết được dưới dạng $a/b$, với $a, b$ là số nguyên và $b \\ne 0$.",
              sourceChunkIds: [ids.theory],
              diagramSpec: null,
            },
            illustration: {
              type: "example" as const,
              exampleKind: "ILLUSTRATION" as const,
              problem: "Chứng minh số $1/2$ là một số hữu tỉ.",
              solution: "Ta có $1/2$ là một phân số có mẫu khác 0.",
              answer: "$1/2$ là số hữu tỉ.",
              geometryStatement: null,
              diagramSpec: null,
            },
            notes: [
              {
                type: "note" as const,
                content: "Mẫu số phải khác 0. Ví dụ: phân số $1/2$ có mẫu bằng 2.",
                sourceChunkIds: [ids.theory, ids.example],
              },
            ],
          },
        ],
      },
    ],
    applicationExercises: {
      displayHeading: "Bài tập vận dụng" as const,
      standardExercise: {
        type: "example" as const,
        exampleKind: "STANDARD_EXERCISE" as const,
        problem: "Viết số $0,25$ dưới dạng phân số tối giản.",
        solution: "$0,25 = 25/100 = 1/4$.",
        answer: "$1/4$.",
        geometryStatement: null,
        diagramSpec: null,
      },
      realWorldExercise: {
        type: "example" as const,
        exampleKind: "REAL_WORLD_EXERCISE" as const,
        problem:
          "Một cửa hàng giảm giá chiếc áo $200\\,000$ đồng đi $25\\%$. Tính giá chiếc áo sau khi giảm.",
        solution: "Số tiền giảm là $200\\,000 \\times 25\\% = 50\\,000$ đồng.",
        answer: "$150\\,000$ đồng.",
        geometryStatement: null,
        diagramSpec: null,
      },
    },
  };
}

function parseAndMapProviderOutput(output: unknown) {
  return mapLessonSummaryProviderOutput({
    lessonId: "lesson-1",
    output: lessonSummaryProviderOutputSchema.parse(output),
    contextChunks,
  });
}

describe("M9.2 lesson summary provider contract", () => {
  it("removes only duplicated note labels and preserves the note body", () => {
    expect(
      normalizeLessonSummaryNoteContent(
        "**Nhận xét:** Mẫu số phải khác $0$. Ví dụ: $1/2$ có mẫu bằng $2$.",
      ),
    ).toBe("Mẫu số phải khác $0$. Ví dụ: $1/2$ có mẫu bằng $2$.");
    expect(
      normalizeLessonSummaryNoteContent(
        "Chú ý rằng hai góc đối của tứ giác nội tiếp là bù nhau.",
      ),
    ).toBe("hai góc đối của tứ giác nội tiếp là bù nhau.");
    expect(normalizeLessonSummaryNoteContent("**Lưu ý**: Không chia cho $0$.")).toBe(
      "Không chia cho $0$.",
    );
    expect(normalizeLessonSummaryNoteContent("Nhận xét:")).toBe("");
    expect(normalizeLessonSummaryNoteContent("Trong chú ý này có một ví dụ.")).toBe(
      "Trong chú ý này có một ví dụ.",
    );
  });

  it("normalizes flattened fraction commands in plain diagram captions", () => {
    expect(
      normalizeLessonSummaryDiagramText("Biểu diễn frac54 và -frac54; so sánh dfrac52."),
    ).toBe("Biểu diễn 5/4 và -5/4; so sánh 5/2.");
  });

  it("repairs visible number-line ticks from correctly scaled numeric label anchors", () => {
    const rawSpec = {
      version: 1 as const,
      coordinateSystem: "CARTESIAN" as const,
      viewBox: { minX: -2, minY: -1, width: 4, height: 2 },
      toScale: true as const,
      points: [
        diagramPoint("axisL", -2, 0),
        diagramPoint("axisR", 2, 0),
        diagramPoint("labelNeg1", -1, -0.35),
        diagramPoint("label0", 0, -0.35),
        diagramPoint("labelHalf", 0.5, -0.35),
        diagramPoint("label1", 1, -0.35),
      ],
      primitives: {
        segments: [],
        lines: [{ id: "axis", from: "axisL", to: "axisR", style: "SOLID" as const }],
        rays: [],
        polylines: [],
        polygons: [],
        circles: [],
        ellipses: [],
        arcs: [],
      },
      markers: { rightAngles: [], equalLengths: [], parallels: [], angles: [] },
      labels: [
        diagramLabel("-1", "labelNeg1"),
        diagramLabel("0", "label0"),
        diagramLabel("1/2", "labelHalf"),
        diagramLabel("1", "label1"),
      ],
      caption: "Biểu diễn các số trên trục số.",
    };

    expect(lessonSummaryProviderDiagramSpecSchema.safeParse(rawSpec).success).toBe(true);
    const mapped = mapLessonSummaryProviderDiagramSpec(rawSpec);
    expect(
      mapped.primitives.filter((primitive) => primitive.type === "SEGMENT"),
    ).toHaveLength(5);
  });

  it("maps mandatory theory-example pairs and exactly two final exercises", () => {
    const providerOutput =
      lessonSummaryProviderOutputSchema.parse(createProviderOutput());
    const summary = mapLessonSummaryProviderOutput({
      lessonId: "lesson-canonical",
      output: providerOutput,
      contextChunks,
    });

    expect(summary.lessonId).toBe("lesson-canonical");
    expect(summary.sections).toHaveLength(2);
    expect(summary.sections[0]?.blocks.map((block) => block.type)).toEqual([
      "knowledge",
      "example",
      "note",
    ]);
    const baseOutput = createProviderOutput();
    const legacyPlacement = {
      ...baseOutput,
      theorySections: [
        {
          ...baseOutput.theorySections[0],
          units: [
            {
              ...baseOutput.theorySections[0]!.units[0],
              illustrationPlacement: "BEFORE_THEORY",
            },
          ],
        },
      ],
    };
    expect(() => lessonSummaryProviderOutputSchema.parse(legacyPlacement)).toThrow();
    expect(summary.sections[1]).toMatchObject({
      order: 2,
      displayHeading: "Bài tập vận dụng",
    });
    expect(summary.sections[1]?.blocks).toHaveLength(2);
    expect(summary.sections[1]?.blocks.map((block) => block.type)).toEqual([
      "example",
      "example",
    ]);
  });

  it("does not persist a repeated label at the start of note content", () => {
    const output = createProviderOutput();
    output.theorySections[0]!.units[0]!.notes[0]!.content =
      "Lưu ý: Mẫu số phải khác $0$. Ví dụ: $1/2$ có mẫu bằng $2$.";

    const summary = parseAndMapProviderOutput(output);
    const note = summary.sections[0]?.blocks.find((block) => block.type === "note");

    expect(note).toMatchObject({
      type: "note",
      content: "Mẫu số phải khác $0$. Ví dụ: $1/2$ có mẫu bằng $2$.",
    });
  });

  it("accepts editable semantic issues without exposing technical warning metadata", () => {
    const output = createProviderOutput();
    output.theorySections[0]!.units[0]!.theory.content += "\nVí dụ: 2/3 là số hữu tỉ.";

    const embeddedExample = mapLessonSummaryProviderOutput({
      lessonId: "lesson-1",
      output: lessonSummaryProviderOutputSchema.parse(output),
      contextChunks,
    });
    expect(() => lessonSummaryOutputSchema.parse(embeddedExample)).not.toThrow();
    expect(embeddedExample).not.toHaveProperty("warnings");
    expect(embeddedExample).not.toHaveProperty("warningDetails");

    const embeddedNote = createProviderOutput();
    embeddedNote.theorySections[0]!.units[0]!.theory.content +=
      "\nChú ý: mẫu số phải khác 0.";
    expect(() =>
      lessonSummaryOutputSchema.parse(
        mapLessonSummaryProviderOutput({
          lessonId: "lesson-1",
          output: lessonSummaryProviderOutputSchema.parse(embeddedNote),
          contextChunks,
        }),
      ),
    ).not.toThrow();

    const missingNoteExample = createProviderOutput();
    missingNoteExample.theorySections[0]!.units[0]!.notes[0]!.content =
      "Mẫu số phải khác 0.";
    expect(() =>
      lessonSummaryOutputSchema.parse(
        mapLessonSummaryProviderOutput({
          lessonId: "lesson-1",
          output: lessonSummaryProviderOutputSchema.parse(missingNoteExample),
          contextChunks,
        }),
      ),
    ).not.toThrow();
  });

  it("allows ordinary pedagogical wording while still rejecting exercise labels", () => {
    const validOutput = createProviderOutput();
    validOutput.theorySections[0]!.units[0]!.theory.content =
      "Có thể vận dụng các tính chất của phép toán để nhóm các số thuận tiện.\n\nKhi giải bài tập, học sinh nên kiểm tra lại dấu của kết quả.";

    const validSummary = mapLessonSummaryProviderOutput({
      lessonId: "lesson-1",
      output: lessonSummaryProviderOutputSchema.parse(validOutput),
      contextChunks,
    });
    expect(() => lessonSummaryOutputSchema.parse(validSummary)).not.toThrow();

    const invalidOutput = createProviderOutput();
    invalidOutput.theorySections[0]!.units[0]!.theory.content +=
      "\n\nVận dụng 1. Tính giá trị của biểu thức đã cho.";

    expect(() =>
      lessonSummaryOutputSchema.parse(
        mapLessonSummaryProviderOutput({
          lessonId: "lesson-1",
          output: lessonSummaryProviderOutputSchema.parse(invalidOutput),
          contextChunks,
        }),
      ),
    ).not.toThrow();
  });

  it("warns about a long theory paragraph that should be split into lines or bullets", () => {
    const output = createProviderOutput();
    output.theorySections[0]!.units[0]!.theory.content =
      "Để cộng hoặc trừ hai số hữu tỉ, ta viết chúng dưới dạng phân số rồi áp dụng quy tắc cộng, trừ phân số. Mỗi số hữu tỉ đều có thể viết dưới dạng phân số với mẫu dương. Phép cộng có tính chất giao hoán và kết hợp giống như với số nguyên. Nếu các số được cho dưới dạng số thập phân thì áp dụng quy tắc của số thập phân.";

    expect(() =>
      lessonSummaryOutputSchema.parse(
        mapLessonSummaryProviderOutput({
          lessonId: "lesson-1",
          output: lessonSummaryProviderOutputSchema.parse(output),
          contextChunks,
        }),
      ),
    ).not.toThrow();

    output.theorySections[0]!.units[0]!.theory.content =
      output.theorySections[0]!.units[0]!.theory.content.replaceAll(". ", ".\n- ");
    const splitSummary = mapLessonSummaryProviderOutput({
      lessonId: "lesson-1",
      output: lessonSummaryProviderOutputSchema.parse(output),
      contextChunks,
    });
    expect(() => lessonSummaryOutputSchema.parse(splitSummary)).not.toThrow();
  });

  it("preserves unknown source topic data as an editable draft", () => {
    for (const mutate of [
      (output: ReturnType<typeof createProviderOutput>) => {
        output.theorySections[0]!.sourceChunkIds = [
          "99999999-9999-4999-8999-999999999999",
        ];
      },
      (output: ReturnType<typeof createProviderOutput>) => {
        output.theorySections[0]!.sourceTopicId = `${ids.theory}#topic-does-not-exist`;
      },
    ]) {
      const output = createProviderOutput();
      mutate(output);
      const summary = mapLessonSummaryProviderOutput({
        lessonId: "lesson-1",
        output: lessonSummaryProviderOutputSchema.parse(output),
        contextChunks,
      });
      expect(() => lessonSummaryOutputSchema.parse(summary)).not.toThrow();
    }
  });

  it("uses the spelling-corrected heading returned by AI", () => {
    const brokenHeadingChunks = [
      {
        id: ids.theory,
        content: "\\section*{1 CỌNG HAI SỐ HỮU TỈ}\nQuy tắc cộng hai số hữu tỉ.",
      },
      ...contextChunks.slice(1),
    ];
    const repaired = createProviderOutput();
    repaired.theorySections[0]!.sourceTopicId =
      buildLessonSummarySourceTopics(brokenHeadingChunks)[0]!.id;
    repaired.theorySections[0]!.displayHeading = "CỘNG HAI SỐ HỮU TỈ";
    const repairedSummary = mapLessonSummaryProviderOutput({
      lessonId: "lesson-1",
      output: lessonSummaryProviderOutputSchema.parse(repaired),
      contextChunks: brokenHeadingChunks,
    });
    expect(repairedSummary.sections[0]).toMatchObject({
      sourceHeading: "1 CỌNG HAI SỐ HỮU TỈ",
      displayHeading: "CỘNG HAI SỐ HỮU TỈ",
    });
  });

  it("keeps only the first duplicated source topic without rejecting the draft", () => {
    const output = createProviderOutput();
    output.theorySections.push(structuredClone(output.theorySections[0]!));
    const summary = mapLessonSummaryProviderOutput({
      lessonId: "lesson-1",
      output: lessonSummaryProviderOutputSchema.parse(output),
      contextChunks,
    });

    expect(summary.sections).toHaveLength(2);
    expect(summary.sections[0]?.blocks).toHaveLength(3);
  });

  it("stores simple examples without origin or source assessment metadata", () => {
    const baseOutput = createProviderOutput();
    const output = {
      ...baseOutput,
      theorySections: [
        {
          ...baseOutput.theorySections[0],
          units: [
            {
              ...baseOutput.theorySections[0]!.units[0],
              theory: {
                ...baseOutput.theorySections[0]!.units[0]!.theory,
              },
              illustration: {
                ...baseOutput.theorySections[0]!.units[0]!.illustration,
                problem:
                  "Cho angle ABC có số đo $60^\\circ$ và hat{xOz}=65^\u001b0. Hãy đọc tên góc.",
              },
            },
          ],
        },
      ],
      applicationExercises: {
        ...baseOutput.applicationExercises,
        standardExercise: {
          ...baseOutput.applicationExercises.standardExercise,
          problem:
            "Bài 1.10. ![Ảnh OCR](https://source.invalid/blur.png) a) Viết $0,5$ dưới dạng phân số tối giản (xem hình bên). b) Viết $0,75$ dưới dạng phân số tối giản.",
        },
      },
    };

    const summary = mapLessonSummaryProviderOutput({
      lessonId: "lesson-1",
      output: lessonSummaryProviderOutputSchema.parse(output),
      contextChunks,
    });
    const examples = summary.sections.flatMap((section) =>
      section.blocks.filter((block) => block.type === "example"),
    );
    expect(examples.every((example) => !("origin" in example))).toBe(true);
    expect(examples.every((example) => !("sourceAssessment" in example))).toBe(true);
    expect(examples.every((example) => !("visual" in example))).toBe(true);
    expect(examples[1]?.problem).not.toContain("source.invalid");
    expect(examples[1]?.problem).not.toMatch(/^Bài\s+1\.10/iu);
    expect(examples[1]?.problem).not.toMatch(/xem hình/iu);
    expect(examples[1]?.problem).not.toContain("Hình nguồn");
    expect(examples[0]?.problem).toContain("\\widehat{ABC}");
    expect(examples[0]?.problem).not.toContain("\\angle ABC");
    expect(examples[0]?.problem).toContain("\\widehat{xOz}=65^\\circ");
  });

  it("accepts compact safe diagram specs and rejects broken references", () => {
    const baseOutput = createProviderOutput();
    const diagramSpec = {
      version: 1,
      coordinateSystem: "CARTESIAN",
      viewBox: { minX: 0, minY: 0, width: 10, height: 8 },
      toScale: true,
      points: [
        {
          id: "A",
          x: 1,
          y: 1,
          label: "A",
          pointStyle: "NONE",
          labelPosition: "BOTTOM_LEFT",
        },
        {
          id: "B",
          x: 1,
          y: 6,
          label: "B",
          pointStyle: "NONE",
          labelPosition: "TOP_LEFT",
        },
        {
          id: "C",
          x: 12,
          y: 1,
          label: "C",
          pointStyle: "NONE",
          labelPosition: "TOP_RIGHT",
        },
      ],
      primitives: {
        segments: [{ id: "AB", from: "A", to: "B", style: "SOLID" }],
        lines: [],
        rays: [],
        polylines: [
          { id: "AC", pointIds: ["A", "C"], style: "SOLID" },
          { id: "curve", pointIds: ["A", "C", "B"], style: "DASHED" },
        ],
        polygons: [],
        circles: [{ id: "dot", center: "A", radius: 0.001, style: "SOLID" }],
        ellipses: [],
        arcs: [],
      },
      markers: {
        rightAngles: [{ vertex: "A", armPointIds: ["B", "C"] }],
        equalLengths: [],
        parallels: [],
        angles: [
          {
            vertex: "B",
            armPointIds: ["A", "C"],
            label: null,
          },
        ],
      },
      labels: [
        {
          text: "3 cm",
          anchorPointId: "A",
          anchorPrimitiveId: "AB",
          position: "LEFT",
        },
      ],
      caption: "Sơ đồ dựng đúng tỉ lệ.",
    };
    const output = {
      ...baseOutput,
      theorySections: [
        {
          ...baseOutput.theorySections[0],
          units: [
            {
              ...baseOutput.theorySections[0]!.units[0],
              theory: {
                ...baseOutput.theorySections[0]!.units[0]!.theory,
                diagramSpec,
              },
              illustration: {
                ...baseOutput.theorySections[0]!.units[0]!.illustration,
                problem:
                  "Cho $\\angle A=90^\\circ$ và $\\angle B=35^\\circ$. Tính góc còn lại.",
                solution:
                  "$\\angle A=90^\\circ$ và $\\angle B=35^\\circ$ nên góc còn lại bằng $55^\\circ$.",
                answer: "$55^\\circ$.",
                diagramSpec,
              },
            },
          ],
        },
      ],
    };
    const parsed = lessonSummaryProviderOutputSchema.parse(output);
    const summary = mapLessonSummaryProviderOutput({
      lessonId: "lesson-1",
      output: parsed,
      contextChunks,
    });
    expect(
      summary.sections[0]?.blocks.find((block) => block.type === "example"),
    ).toHaveProperty("visual.kind", "DIAGRAM_SPEC");
    expect(
      summary.sections[0]?.blocks.find((block) => block.type === "knowledge"),
    ).toHaveProperty("visual.kind", "DIAGRAM_SPEC");
    expect(() => lessonSummaryOutputSchema.parse(summary)).not.toThrow();
    const mappedExample = summary.sections[0]?.blocks.find(
      (block) => block.type === "example",
    );
    if (
      mappedExample?.type !== "example" ||
      mappedExample.visual?.kind !== "DIAGRAM_SPEC"
    ) {
      throw new Error("Expected the mapped example to contain a diagram spec.");
    }
    expect(
      mappedExample.visual.spec.viewBox.minX + mappedExample.visual.spec.viewBox.width,
    ).toBeGreaterThan(12);
    expect(mappedExample.visual.spec.markers[1]).toMatchObject({ label: null });
    expect(mappedExample.problem).toContain("$\\widehat{BAC}=90^\\circ$");
    expect(mappedExample.problem).toContain("$\\widehat{ABC}=35^\\circ$");
    expect(mappedExample.problem).not.toContain("\\angle A");
    expect(mappedExample.problem).not.toContain("\\angle B");
    expect(mappedExample.solution).toContain("$\\widehat{BAC}=90^\\circ$");
    expect(mappedExample.solution).toContain("$\\widehat{ABC}=35^\\circ$");
    expect(mappedExample.visual.spec.labels[0]).toMatchObject({ text: "3 cm" });
    expect(mappedExample.visual.spec.primitives).toContainEqual({
      id: "AC",
      type: "SEGMENT",
      from: "A",
      to: "C",
      style: "SOLID",
    });
    expect(mappedExample.visual.spec.primitives).not.toContainEqual(
      expect.objectContaining({ id: "dot" }),
    );

    const unsafeOutput = structuredClone(output);
    unsafeOutput.theorySections[0]!.units[0]!.illustration.diagramSpec!.caption =
      "https://khong-duoc-phep.example";
    expect(() => parseAndMapProviderOutput(unsafeOutput)).toThrow();

    const notToScaleOutput = structuredClone(output);
    // @ts-expect-error Deliberately violate the provider contract.
    notToScaleOutput.theorySections[0]!.units[0]!.illustration.diagramSpec!.toScale = false;
    expect(() => lessonSummaryProviderOutputSchema.parse(notToScaleOutput)).toThrow();

    const combinedPointLabelOutput = structuredClone(output);
    combinedPointLabelOutput.theorySections[0]!.units[0]!.illustration.diagramSpec!.points[0]!.label =
      "A′C";
    expect(() =>
      lessonSummaryProviderOutputSchema.parse(combinedPointLabelOutput),
    ).toThrow();

    const duplicatePointOutput = structuredClone(output);
    duplicatePointOutput.theorySections[0]!.units[0]!.illustration.diagramSpec!.points[1]!.id =
      "A";
    expect(() => parseAndMapProviderOutput(duplicatePointOutput)).toThrow();

    const duplicatePrimitiveOutput = structuredClone(output);
    duplicatePrimitiveOutput.theorySections[0]!.units[0]!.illustration.diagramSpec!.primitives.polylines[0]!.id =
      "AB";
    expect(() => parseAndMapProviderOutput(duplicatePrimitiveOutput)).toThrow();

    const unknownReferenceOutput = structuredClone(output);
    const firstPrimitive =
      unknownReferenceOutput.theorySections[0]!.units[0]!.illustration.diagramSpec!
        .primitives.segments[0]!;
    firstPrimitive.to = "Z";
    expect(() => parseAndMapProviderOutput(unknownReferenceOutput)).toThrow();

    const repeatedPrimitiveOutput = structuredClone(output);
    repeatedPrimitiveOutput.theorySections[0]!.units[0]!.illustration.diagramSpec!.primitives.segments =
      Array.from({ length: 17 }, (_, index) => ({
        id: `edge_${index}`,
        from: "A",
        to: "B",
        style: "SOLID" as const,
      }));
    expect(() =>
      lessonSummaryProviderOutputSchema.parse(repeatedPrimitiveOutput),
    ).toThrow();

    const legacyPointLatexOutput = structuredClone(output);
    legacyPointLatexOutput.theorySections[0]!.units[0]!.illustration.diagramSpec!.points[0]!.label =
      "$A$";
    const legacySummary = mapLessonSummaryProviderOutput({
      lessonId: "lesson-1",
      output: lessonSummaryProviderOutputSchema.parse(legacyPointLatexOutput),
      contextChunks,
    });
    expect(
      legacySummary.sections[0]?.blocks.find((block) => block.type === "example"),
    ).toHaveProperty("visual.spec.points.0.label", "A");
  });

  it("exposes compact diagram limits and point-label patterns to the provider", () => {
    const serializedFormat = JSON.stringify(
      buildAiStructuredTextFormat(
        lessonSummaryProviderDiagramSpecSchema,
        "lesson_summary_diagram_contract",
      ),
    );

    expect(serializedFormat).toMatch(/"segments":\{[^}]*"maxItems":16/su);
    expect(serializedFormat).toContain('"circles"');
    expect(serializedFormat).toContain('"rightAngles"');
    expect(serializedFormat).toContain('"equalLengths"');
    expect(serializedFormat).toContain('"pattern":"^(?:[A-Z]');
    expect(serializedFormat).toContain("ID duy nhất của primitive");
    expect(serializedFormat).toContain("Một tam giác dùng đúng 3 segment");
    expect(serializedFormat).toContain("anchorPrimitiveId");
    expect(serializedFormat).toContain("0° hướng sang phải, 90° hướng lên");
    expect(serializedFormat).toContain('"pointStyle"');
    expect(serializedFormat).toContain("neo text và điểm lấy mẫu làm mượt");
    expect(serializedFormat).toContain('"ellipses"');
  });

  it("compacts repeated provider schemas without changing the expanded contract", () => {
    const outputName = "lesson_summary_provider_contract";
    const sdkInlineFormat = zodTextFormat(
      lessonSummaryProviderTransportOutputSchema,
      outputName,
    );
    const inlineFormat = buildAiStructuredTextFormat(
      lessonSummaryProviderTransportOutputSchema,
      outputName,
    );
    const referenceFormat = buildAiStructuredTextFormat(
      lessonSummaryProviderTransportOutputSchema,
      outputName,
      "ref",
    );
    const referenceV2Format = buildAiStructuredTextFormat(
      lessonSummaryProviderTransportOutputSchema,
      outputName,
      "ref_v2",
    );
    const referenceV2FormatAgain = buildAiStructuredTextFormat(
      lessonSummaryProviderTransportOutputSchema,
      outputName,
      "ref_v2",
    );

    expect(JSON.stringify(inlineFormat)).toBe(JSON.stringify(sdkInlineFormat));
    expect(JSON.stringify(referenceFormat)).toHaveLength(33_320);
    expect(referenceFormat.schema).toHaveProperty("$defs");
    expect(JSON.stringify(referenceFormat)).toContain('"$ref"');
    expect(JSON.stringify(referenceFormat).length).toBeLessThan(
      JSON.stringify(inlineFormat).length / 5,
    );
    expect(
      normalizeExpandedJsonSchema(referenceFormat.schema),
    ).toEqual(normalizeExpandedJsonSchema(inlineFormat.schema));
    expect(referenceV2Format.schema).toHaveProperty("$defs");
    expect(JSON.stringify(referenceV2Format)).toContain('"$ref"');
    expect(JSON.stringify(referenceV2Format).length).toBeLessThanOrEqual(30_600);
    expect(JSON.stringify(referenceV2Format).length).toBeLessThan(
      JSON.stringify(referenceFormat).length,
    );
    expect(JSON.stringify(referenceV2FormatAgain)).toBe(
      JSON.stringify(referenceV2Format),
    );
    expect(
      normalizeExpandedJsonSchema(referenceV2Format.schema),
    ).toEqual(normalizeExpandedJsonSchema(inlineFormat.schema));

    const providerOutput = createProviderOutput();
    expect(referenceFormat.$parseRaw(JSON.stringify(providerOutput))).toEqual(
      lessonSummaryProviderTransportOutputSchema.parse(providerOutput),
    );
    expect(referenceV2Format.$parseRaw(JSON.stringify(providerOutput))).toEqual(
      lessonSummaryProviderTransportOutputSchema.parse(providerOutput),
    );
  });

  it("requires geometryStatement in strict provider JSON while accepting omission for local recovery", () => {
    const serializedFormat = JSON.stringify(
      buildAiStructuredTextFormat(
        lessonSummaryProviderTransportOutputSchema,
        "lesson_summary_provider_contract",
      ),
    );
    expect(serializedFormat).toContain('"geometryStatement"');
    expect(serializedFormat).toMatch(
      /"required":\[[^\]]*"geometryStatement"[^\]]*"diagramSpec"/su,
    );

    const omitted = createProviderOutput();
    delete (
      omitted.theorySections[0]!.units[0]!.illustration as {
        geometryStatement?: unknown;
      }
    ).geometryStatement;
    expect(() => lessonSummaryProviderTransportOutputSchema.parse(omitted)).not.toThrow();
  });

  it("rejects right-angle and equal-length markers that contradict diagram coordinates", () => {
    const invalidSharedHypotenuseDiagram = {
      version: 1 as const,
      coordinateSystem: "CARTESIAN" as const,
      viewBox: { minX: -1, minY: -1, width: 8, height: 8 },
      toScale: true as const,
      points: [
        diagramPoint("A", 0, 4),
        diagramPoint("B", 0, 0),
        diagramPoint("C", 6, 0),
        diagramPoint("D", 2.7692, 2.1538),
      ],
      primitives: {
        segments: [
          { id: "AB", from: "A", to: "B", style: "SOLID" as const },
          { id: "BC", from: "B", to: "C", style: "SOLID" as const },
          { id: "AC", from: "A", to: "C", style: "SOLID" as const },
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
        rightAngles: [
          { vertex: "B", armPointIds: ["A", "C"] },
          { vertex: "D", armPointIds: ["A", "C"] },
        ],
        equalLengths: [{ segmentIds: ["AB", "AD"], markCount: 1 }],
        parallels: [],
        angles: [],
      },
      labels: [],
      caption: "Hai tam giác vuông chung cạnh huyền AC.",
    };

    const invalidResult = lessonSummaryProviderDiagramSpecSchema.safeParse(
      invalidSharedHypotenuseDiagram,
    );
    expect(invalidResult.success).toBe(false);
    if (invalidResult.success) throw new Error("Expected invalid diagram geometry.");
    expect(invalidResult.error.issues.map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("RIGHT_ANGLE at D"),
        expect.stringContaining("EQUAL_LENGTH segments"),
      ]),
    );

    const validSharedHypotenuseDiagram = structuredClone(invalidSharedHypotenuseDiagram);
    validSharedHypotenuseDiagram.points[3] = diagramPoint("D", 48 / 13, 72 / 13);
    expect(
      lessonSummaryProviderDiagramSpecSchema.safeParse(validSharedHypotenuseDiagram)
        .success,
    ).toBe(true);
  });

  it("fits the viewBox to the visible arc instead of its unused full circle", () => {
    const normalized = normalizeLessonSummaryDiagramSpec(
      lessonSummaryDiagramSpecSchema.parse({
        version: 1,
        coordinateSystem: "CARTESIAN",
        viewBox: { minX: 0, minY: 0, width: 2, height: 2 },
        toScale: true,
        points: [
          { id: "O", x: 0, y: 0, label: "O", labelPosition: "BOTTOM_LEFT" },
          { id: "A", x: 2, y: 0, label: "A", labelPosition: "BOTTOM_RIGHT" },
        ],
        primitives: [
          {
            id: "arc_OA",
            type: "ARC",
            center: "O",
            radius: 2,
            startAngle: 0,
            endAngle: 90,
            style: "DASHED",
          },
        ],
        markers: [],
        labels: [],
        caption: null,
      }),
    );

    expect(normalized.viewBox.minX).toBeGreaterThan(-1);
    expect(normalized.viewBox.minY).toBeGreaterThan(-1);
    expect(normalized.viewBox.minX + normalized.viewBox.width).toBeGreaterThan(2);
    expect(normalized.viewBox.minY + normalized.viewBox.height).toBeGreaterThan(2);
  });

  it("repairs JSON-damaged LaTeX and preserves linked geometry reasoning without auto-bullets", () => {
    const output = createProviderOutput();
    output.theorySections[0]!.units[0]!.illustration.problem =
      "Chứng minh rằng $\u0009riangle ABC=\u0009riangle A'B'C'$ và $\\\\angle ABC=\\\\angle A'B'C'$.";
    output.theorySections[0]!.units[0]!.illustration.solution =
      "Hai tam giác đã cho đều vuông. Ta có hai cạnh góc vuông tương ứng bằng nhau. Do đó hai tam giác bằng nhau.";
    output.theorySections[0]!.units[0]!.illustration.geometryStatement = {
      hypotheses: [
        "$\\triangle ABC$ và $\\triangle A'B'C'$ đều vuông.",
        "Hai cạnh góc vuông tương ứng bằng nhau.",
      ],
      conclusions: ["$\\triangle ABC=\\triangle A'B'C'$."],
    };

    const summary = mapLessonSummaryProviderOutput({
      lessonId: "lesson-1",
      output: lessonSummaryProviderOutputSchema.parse(output),
      contextChunks,
      targetGrade: 7,
    });
    const example = summary.sections[0]?.blocks.find((block) => block.type === "example");
    if (example?.type !== "example") throw new Error("Expected an example block.");

    expect(example.problem).toContain("$\\triangle ABC=\\triangle A'B'C'$");
    expect(example.problem).toContain("$\\widehat{ABC}=\\widehat{A'B'C'}$");
    expect(example.problem).not.toContain("\u0009");
    expect(example.problem).not.toContain("\\\\angle");
    expect(example.solution).toBe(
      "Hai tam giác đã cho đều vuông. Ta có hai cạnh góc vuông tương ứng bằng nhau. Do đó hai tam giác bằng nhau.",
    );
    expect(example.geometryStatement).toEqual({
      hypotheses: [
        "$\\triangle ABC$ và $\\triangle A'B'C'$ đều vuông.",
        "Hai cạnh góc vuông tương ứng bằng nhau.",
      ],
      conclusions: ["$\\triangle ABC=\\triangle A'B'C'$."],
    });
    expect(example.reviewIssues).toBeUndefined();
  });

  it("requires GT-KL only for formal geometry proofs in grades 7-9", () => {
    const geometryOutput = createProviderOutput();
    geometryOutput.theorySections[0]!.units[0]!.illustration.problem =
      "Chứng minh $\\triangle ABC=\\triangle DEF$.";
    geometryOutput.theorySections[0]!.units[0]!.illustration.solution =
      "Xét $\\triangle ABC$ và $\\triangle DEF$. Ta có các cạnh tương ứng bằng nhau. Do đó hai tam giác bằng nhau.";

    const geometrySummary = mapLessonSummaryProviderOutput({
      lessonId: "lesson-geometry",
      output: lessonSummaryProviderOutputSchema.parse(geometryOutput),
      contextChunks,
      targetGrade: 7,
    });
    const geometryExample = geometrySummary.sections[0]?.blocks.find(
      (block) => block.type === "example",
    );
    expect(geometryExample?.reviewIssues).toEqual([
      expect.objectContaining({
        code: "MISSING_GEOMETRY_STATEMENT",
        resolution: "ACCEPT_OR_FIX",
      }),
    ]);
    expect(geometryExample).toMatchObject({
      type: "example",
      problem: "Chứng minh $\\triangle ABC=\\triangle DEF$.",
      solution:
        "Xét $\\triangle ABC$ và $\\triangle DEF$. Ta có các cạnh tương ứng bằng nhau. Do đó hai tam giác bằng nhau.",
      answer: "$1/2$ là số hữu tỉ.",
    });

    const algebraOutput = createProviderOutput();
    algebraOutput.theorySections[0]!.units[0]!.illustration.problem =
      "Chứng minh số $1/2$ là số hữu tỉ. a) Viết dưới dạng phân số. b) Nêu điều kiện của mẫu.";
    algebraOutput.theorySections[0]!.units[0]!.illustration.solution =
      "a) Ta có $1/2$ đã là phân số. b) Mẫu số $2\\ne0$.";
    algebraOutput.theorySections[0]!.units[0]!.illustration.answer =
      "a) $1/2$ là phân số. b) Mẫu số khác $0$.";
    const algebraSummary = mapLessonSummaryProviderOutput({
      lessonId: "lesson-algebra",
      output: lessonSummaryProviderOutputSchema.parse(algebraOutput),
      contextChunks,
      targetGrade: 7,
    });
    const algebraExample = algebraSummary.sections[0]?.blocks.find(
      (block) => block.type === "example",
    );
    expect(algebraExample?.reviewIssues).toBeUndefined();
    expect(algebraExample?.solution).toBe(
      "a) Ta có $1/2$ đã là phân số.\nb) Mẫu số $2\\ne0$.",
    );
    expect(algebraExample?.problem).toContain(
      "số hữu tỉ.\na) Viết dưới dạng phân số.\nb) Nêu điều kiện của mẫu.",
    );
    expect(algebraExample?.answer).toBe("a) $1/2$ là phân số.\nb) Mẫu số khác $0$.");
  });

  it("keeps provider bullets editable but flags a disconnected geometry checklist", () => {
    const output = createProviderOutput();
    const illustration = output.theorySections[0]!.units[0]!.illustration;
    illustration.problem = "Chứng minh $\\triangle ABC=\\triangle DEF$.";
    illustration.solution =
      "- $\\triangle ABC$ và $\\triangle DEF$ đều vuông.\n- Hai cạnh tương ứng bằng nhau.\n- Hai tam giác bằng nhau.";
    illustration.geometryStatement = {
      hypotheses: ["Hai tam giác vuông có các cạnh tương ứng bằng nhau."],
      conclusions: ["$\\triangle ABC=\\triangle DEF$."],
    };

    const summary = mapLessonSummaryProviderOutput({
      lessonId: "lesson-geometry",
      output: lessonSummaryProviderOutputSchema.parse(output),
      contextChunks,
      targetGrade: 7,
    });
    const example = summary.sections[0]?.blocks.find((block) => block.type === "example");
    expect(example?.solution).toBe(illustration.solution);
    expect(example?.reviewIssues).toEqual([
      expect.objectContaining({ code: "GEOMETRY_SOLUTION_BULLET_CHECKLIST" }),
    ]);
  });

  it("uses the default prompts and serializes context as JSON when admin prompts are empty", () => {
    const request = buildLessonSummaryStructuredInput({
      lessonId: "lesson-1",
      lessonTitle: "Số hữu tỉ",
      targetGrade: 7,
      documentIds: ["document-1"],
      sourceHash: "source-hash",
      chunks: [
        {
          id: ids.theory,
          content: "Nội dung </chunk> không được phá delimiter.",
        },
      ],
      configuration: {
        style: "academic",
        styleInstructions: "",
        length: "detailed",
        targetWordCount: 350,
        extraInstructions: "Dùng tiêu đề ngắn",
      },
    });
    const fullInput = buildAiUserPrompt(request);

    expect(request.systemPrompt).toContain("CẤU TRÚC BẮT BUỘC");
    expect(request.systemPrompt).toContain("tên điểm phải giữ đúng vai trò trong đề");
    expect(request.systemPrompt).toContain(
      "Tạo primitives trước rồi mới tạo markers/labels",
    );
    expect(request.systemPrompt).toContain(
      "Vạch chia trên trục số, hệ trục tọa độ và biểu đồ chỉ là nét phân độ",
    );
    expect(request.systemPrompt).toContain(
      "tổng chiều dài khoảng 2% cạnh ngắn của viewBox, không quá 3%",
    );
    expect(request.systemPrompt).toContain(
      "Điểm dựng nhìn thấy và điểm lấy mẫu làm mượt là hai lớp khác nhau",
    );
    expect(request.systemPrompt).toContain("hiện tối thiểu hai điểm dựng có ý nghĩa");
    expect(request.systemPrompt).toContain(
      "hiện đỉnh cùng ít nhất hai cặp điểm đối xứng",
    );
    expect(request.systemPrompt).toContain(
      "MỌI điểm dựng đang hiển thị bằng FILLED đều BẮT BUỘC có point.label duy nhất",
    );
    expect(request.systemPrompt).toContain(
      "Mọi điểm FILLED nằm trên Ox/Oy phải có nhãn số",
    );
    expect(request.systemPrompt).toContain("Không tự thêm marker PARALLEL hình mũi tên");
    expect(request.systemPrompt).toContain(
      "Sơ đồ thanh so sánh hai số phải có chiều dài đúng tỉ lệ",
    );
    expect(request.systemPrompt).toContain("Lục giác đều có sáu trục đối xứng");
    expect(request.systemPrompt).toContain("hai góc đối là bù nhau");
    expect(request.systemPrompt).toContain(
      "vạch chia ngắn và nhãn số ở mọi đơn vị nguyên cần để đọc",
    );
    expect(request.systemPrompt).toContain("Tâm đồng hồ phải có một chấm nhỏ");
    expect(request.systemPrompt).toContain("Tâm của CIRCLE được gọi tên như O hoặc I");
    expect(request.systemPrompt).toContain("node gốc là hành động/thực nghiệm");
    expect(request.systemPrompt).toContain(
      "không dùng VENN/VENN_UNIVERSE nếu nguồn không mô tả tập hợp",
    );
    expect(request.systemPrompt).toContain("kí hiệu góc bắt buộc dùng `\\widehat{BAC}`");
    expect(request.systemPrompt).toContain(
      "không tạo một labels[] rời cho cùng số đo góc",
    );
    expect(request.systemPrompt).toContain(
      "KHÔNG biến toàn bộ lời giải thành danh sách bullet/checklist",
    );
    expect(request.systemPrompt).toContain(
      "bắt đầu trực tiếp bằng phép tính hoặc biểu thức cần biến đổi",
    );
    expect(request.systemPrompt).toContain(
      "mỗi chặng phải nêu rõ dữ kiện hoặc căn cứ và kết quả suy ra",
    );
    expect(request.systemPrompt).toContain("`geometryStatement` bắt buộc khác null");
    expect(request.systemPrompt).toContain(
      "mọi ý a), b), c) bắt buộc bắt đầu ở dòng riêng",
    );
    expect(request.userPrompt).toContain("NHIỆM VỤ SINH KIẾN THỨC");
    expect(request.userPrompt).toContain(
      "Văn phong và cách trình bày cho học sinh lớp 7",
    );
    expect(request.userPrompt).toContain(
      "chặt chẽ, có cấu trúc học thuật và dùng thuật ngữ chính xác",
    );
    expect(request.userPrompt).toContain(
      "Với bài Số học/Đại số, trình bày trực tiếp từng phép tính và bước biến đổi",
    );
    expect(request.userPrompt).toContain(
      "trình bày mạch suy luận liên kết theo chuẩn SGK lớp 7",
    );
    expect(request.userPrompt).not.toContain("- Phong cách:");
    expect(request.userPrompt).not.toContain("như cũ");
    expect(request.userPrompt).toContain(
      "Độ dài: chi tiết, giải thích đầy đủ các ý quan trọng trong context; mục tiêu khoảng 350 từ và có thể dao động hợp lý",
    );
    expect(request.userPrompt).not.toContain("- Mục tiêu khoảng");
    expect(request.maxTokens).toBe(LESSON_SUMMARY_MIN_OUTPUT_TOKENS);
    expect(request.outputName).toBe("lesson_summary_provider_contract");
    expect(request.promptVersion).toBe(LESSON_SUMMARY_PROMPT_VERSION);
    expect(request.schemaVersion).toBe(LESSON_SUMMARY_SCHEMA_VERSION);
    expect(request.schemaReferenceStrategy).toBe("inline");
    expect(fullInput).toContain("CONTEXT_CHUNKS_JSON_BEGIN");
    expect(fullInput).toContain('"content":"Nội dung </chunk>');
    expect(fullInput).not.toContain("<context_chunks>");
  });

  it("uses the admin-edited system and user prompts verbatim", () => {
    const systemInstructions = [
      "### QUY TẮC HỆ THỐNG DO ADMIN CHỈNH",
      "Chỉ sử dụng kiến thức trong tài liệu nguồn.",
    ].join("\n");
    const userPrompt = [
      "### YÊU CẦU DO ADMIN CHỈNH",
      "Tạo nội dung ngắn gọn cho học sinh lớp 7.",
    ].join("\n");
    const request = buildLessonSummaryStructuredInput({
      lessonId: "lesson-1",
      lessonTitle: "Số hữu tỉ",
      targetGrade: 7,
      documentIds: ["document-1"],
      sourceHash: "source-hash",
      chunks: [{ id: ids.theory, content: "Số hữu tỉ viết được dưới dạng phân số." }],
      configuration: {
        style: "academic",
        styleInstructions: "Học thuật, chặt chẽ",
        length: "detailed",
        targetWordCount: 350,
        extraInstructions: "Nhấn mạnh lỗi thường gặp",
      },
      systemInstructions,
      userPrompt,
    });

    expect(request.systemPrompt).toBe(systemInstructions);
    expect(request.userPrompt).toBe(userPrompt);
    expect(request.systemPrompt).not.toContain("CẤU TRÚC BẮT BUỘC");
    expect(request.userPrompt).not.toContain("NHIỆM VỤ SINH KIẾN THỨC");
    expect(buildAiUserPrompt(request)).toMatch(
      /^### YÊU CẦU DO ADMIN CHỈNH[\s\S]*CONTEXT_CHUNKS_JSON_BEGIN/u,
    );
  });

  it("reuses effective prompts from preview without nesting the base prompts again", () => {
    const input = {
      lessonId: "lesson-1",
      lessonTitle: "Số hữu tỉ",
      targetGrade: 7,
      documentIds: ["document-1"],
      sourceHash: "source-hash",
      chunks: [{ id: ids.theory, content: "Số hữu tỉ viết được dưới dạng phân số." }],
      configuration: {
        style: "student_friendly" as const,
        styleInstructions: "Dễ hiểu cho học sinh khối 7",
        length: "standard" as const,
        targetWordCount: null,
        extraInstructions: "",
      },
    };
    const previewRequest = buildLessonSummaryStructuredInput({
      ...input,
      systemInstructions: "Dùng câu ngắn.",
      userPrompt: "Ưu tiên công thức trọng tâm.",
    });
    const generationRequest = buildLessonSummaryStructuredInput({
      ...input,
      systemInstructions: previewRequest.systemPrompt,
      userPrompt: previewRequest.userPrompt,
    });

    expect(previewRequest.systemPrompt).toBe("Dùng câu ngắn.");
    expect(previewRequest.userPrompt).toBe("Ưu tiên công thức trọng tâm.");
    expect(generationRequest.systemPrompt).toBe(previewRequest.systemPrompt);
    expect(generationRequest.userPrompt).toBe(previewRequest.userPrompt);
    expect(
      generationRequest.systemPrompt.match(/### I\. VAI TRÒ VÀ NGUYÊN TẮC CƠ BẢN/g),
    ).toBeNull();
    expect(
      generationRequest.userPrompt.match(/### NHIỆM VỤ SINH KIẾN THỨC/g),
    ).toBeNull();
  });

  it("changes only the structured schema when switching summary reference strategies", () => {
    const chunks = [
      {
        id: ids.theory,
        content: "Nội dung nguồn giữ nguyên từng byte.",
        score: 0.875,
        metadata: {
          pageNumber: 7,
          source: "SGK",
          nullableValue: null,
          nested: { order: 1, label: "Bài 15" },
        },
      },
    ];
    const buildRequest = (
      schemaReferenceStrategy: "inline" | "ref" | "ref_v2",
    ) =>
      buildLessonSummaryStructuredInput({
        lessonId: "lesson-1",
        lessonTitle: "Bài 15",
        targetGrade: 7,
        documentIds: ["document-1"],
        sourceHash: "source-hash",
        chunks,
        configuration: {
          style: "academic",
          styleInstructions: "Chặt chẽ",
          length: "standard",
          targetWordCount: null,
          extraInstructions: "Giữ đủ hai tam giác",
          schemaReferenceStrategy,
        },
      });
    const inline = buildRequest("inline");
    const ref = buildRequest("ref");
    const refV2 = buildRequest("ref_v2");

    for (const candidate of [ref, refV2]) {
      expect(candidate.systemPrompt).toBe(inline.systemPrompt);
      expect(candidate.userPrompt).toBe(inline.userPrompt);
      expect(candidate.contextChunks).toEqual(inline.contextChunks);
      expect(candidate.metadata).toEqual(inline.metadata);
      expect(buildAiUserPrompt(candidate)).toBe(buildAiUserPrompt(inline));
      expect({ ...candidate, schemaReferenceStrategy: "inline" }).toEqual(inline);
    }
  });

  it("accepts a resolved system prompt beyond the legacy 12,000-character limit", () => {
    const resolvedSystemPrompt = "S".repeat(15_501);
    const parsed = lessonSummaryJobInputSchema.parse({
      documentIds: [ids.theory],
      sourceHash: "a".repeat(64),
      style: "student_friendly",
      systemInstructions: resolvedSystemPrompt,
    });

    expect(parsed.systemInstructions).toHaveLength(15_501);
    expect(parsed.schemaReferenceStrategy).toBe("inline");
    expect(
      lessonSummaryJobInputSchema.parse({
        documentIds: [ids.theory],
        sourceHash: "a".repeat(64),
        style: "student_friendly",
        schemaReferenceStrategy: "ref",
      }).schemaReferenceStrategy,
    ).toBe("ref");
    expect(
      lessonSummaryJobInputSchema.parse({
        documentIds: [ids.theory],
        sourceHash: "a".repeat(64),
        style: "student_friendly",
        schemaReferenceStrategy: "ref_v2",
      }),
    ).toMatchObject({
      schemaReferenceStrategy: "ref_v2",
      promptCacheKeyEnabled: false,
      promptCacheRetention: "in_memory",
    });
    expect(() =>
      lessonSummaryJobInputSchema.parse({
        documentIds: [ids.theory],
        sourceHash: "a".repeat(64),
        style: "student_friendly",
        systemInstructions: "S".repeat(
          LESSON_SUMMARY_MAX_SYSTEM_INSTRUCTIONS_CHARACTERS + 1,
        ),
      }),
    ).toThrow();
  });

  it("requires deterministic visible construction points and complete axis scales for parabolas", () => {
    const validDiagram = createQuadraticConstructionDiagram();
    expect(() => lessonSummaryDiagramSpecSchema.parse(validDiagram)).not.toThrow();

    const missingSymmetricPair = structuredClone(validDiagram);
    const leftConstructionPoint = missingSymmetricPair.points.find(
      (point) => point.id === "curve_8",
    );
    if (!leftConstructionPoint) throw new Error("Expected curve_8 construction point.");
    leftConstructionPoint.pointStyle = "NONE";
    missingSymmetricPair.labels = missingSymmetricPair.labels.filter(
      (label) => label.anchorPointId !== "curve_8",
    );
    expect(() => lessonSummaryDiagramSpecSchema.parse(missingSymmetricPair)).toThrow(
      /visible vertex and at least two visible symmetric point pairs/u,
    );

    const missingNegativeTwoScaleLabel = structuredClone(validDiagram);
    missingNegativeTwoScaleLabel.labels = missingNegativeTwoScaleLabel.labels.filter(
      (label) => label.text !== "-2",
    );
    expect(() =>
      lessonSummaryDiagramSpecSchema.parse(missingNegativeTwoScaleLabel),
    ).toThrow(/requires numeric scale label -2/u);

    const missingConstructionName = structuredClone(validDiagram);
    const unnamedConstructionPoint = missingConstructionName.points.find(
      (point) => point.id === "curve_8",
    );
    if (!unnamedConstructionPoint)
      throw new Error("Expected curve_8 construction point.");
    unnamedConstructionPoint.label = null;
    expect(() => lessonSummaryDiagramSpecSchema.parse(missingConstructionName)).toThrow(
      /requires a unique short point name/u,
    );

    const unnamedConstructionPointOnAnotherGraph = structuredClone(validDiagram);
    const equationLabel = unnamedConstructionPointOnAnotherGraph.labels.find(
      (label) => label.text === "y=x²-4",
    );
    if (!equationLabel) throw new Error("Expected the function equation label.");
    equationLabel.text = "y=x+1";
    const unnamedLinearConstructionPoint =
      unnamedConstructionPointOnAnotherGraph.points.find(
        (point) => point.id === "curve_8",
      );
    if (!unnamedLinearConstructionPoint)
      throw new Error("Expected a visible construction point.");
    unnamedLinearConstructionPoint.label = null;
    expect(() =>
      lessonSummaryDiagramSpecSchema.parse(unnamedConstructionPointOnAnotherGraph),
    ).toThrow(/requires a unique short point name/u);
  });

  it("classifies OCR label variants and real-world source candidates deterministically", () => {
    const candidates = buildLessonSummarySourceCandidates([
      {
        id: ids.exercise,
        content: [
          "\\item[-] Tính giá trị gần đúng bằng máy tính cầm tay.",
          "",
          "Ví dụ 1. Tính độ dài đoạn thẳng 5 cm.",
          "",
          "Ví dụ 2. Tính góc xOy. Giải (H.3.11) Ta có góc xOy bằng 60°.",
          "",
          "Vän dung. Quả cân ở đĩa bên trái nặng bao nhiêu kilôgam?\n![](https://example.test/balance.jpg)",
          "",
          "Thưchânh",
          "",
          "Vẽ tia phân giác Oz của góc xOy có số đo bằng 68° bằng thước đo góc.",
          "",
          "HD2. Em hãy",
          "",
          "\\item[2.11.] Một hình chữ nhật dài 8 dm và rộng 5 dm. Tính đường chéo.",
          "",
          "\\begin{figure}https://example.test/image?height=200\\end{figure}",
        ].join("\n"),
      },
    ]);

    expect(
      candidates.some((candidate) => candidate.problem.startsWith("\\item[-]")),
    ).toBe(false);
    expect(
      candidates.find((candidate) => candidate.problem.startsWith("Ví dụ"))?.kindHint,
    ).toBe("ILLUSTRATION");
    expect(
      candidates.find((candidate) => candidate.problem.startsWith("Vận dụng"))?.kindHint,
    ).toBe("REAL_WORLD_EXERCISE");
    expect(
      candidates.find((candidate) => candidate.problem.startsWith("Bài 2.11."))?.kindHint,
    ).toBe("STANDARD_EXERCISE");
    expect(
      candidates.find((candidate) => candidate.problem.startsWith("Thực hành")),
    ).toMatchObject({
      kindHint: "ILLUSTRATION",
      pedagogyHint: "PRACTICE",
    });
    expect(candidates.some((candidate) => candidate.problem.startsWith("HD2"))).toBe(
      false,
    );
    expect(
      candidates.some((candidate) => candidate.problem.includes("example.test")),
    ).toBe(false);
    expect(candidates.some((candidate) => candidate.problem.includes("Ta có"))).toBe(
      false,
    );
    expect(
      candidates.some((candidate) => candidate.visualDependencyHint === "SOURCE_IMAGE"),
    ).toBe(true);
  });

  it("extracts numbered source topics and binds candidates to the nearest topic", () => {
    const chunks = [
      {
        id: ids.theory,
        content:
          "\\section*{1 KHÁI NIỆM SỐ HỮU TỈ}\nVí dụ 1. Chứng minh 1/2 là số hữu tỉ.",
      },
      {
        id: ids.exercise,
        content: "2 CỘNG HAI SỐ HỮU TỈ\n\nLuyện tập 1. Tính 1/2 + 1/3.",
      },
    ];
    const topics = buildLessonSummarySourceTopics(chunks);
    const candidates = buildLessonSummarySourceCandidates(chunks);

    expect(topics.map((topic) => topic.sourceHeadingRaw)).toEqual([
      "1 KHÁI NIỆM SỐ HỮU TỈ",
      "2 CỘNG HAI SỐ HỮU TỈ",
    ]);
    expect(
      candidates.find((candidate) => candidate.problem.includes("1/2 + 1/3"))
        ?.relatedTopicIdHint,
    ).toBe(topics[1]?.id);
  });

  it("rejects visually incomplete function, fraction-area and solid diagrams", () => {
    const common = {
      version: 1 as const,
      coordinateSystem: "CARTESIAN" as const,
      viewBox: { minX: -5, minY: -5, width: 10, height: 10 },
      toScale: true as const,
      markers: [],
    };
    const graphWithoutAxes = {
      ...common,
      points: [
        { id: "P1", x: -2, y: -2, label: null, labelPosition: null },
        { id: "P2", x: 2, y: 2, label: null, labelPosition: null },
      ],
      primitives: [
        {
          id: "graph",
          type: "POLYLINE" as const,
          pointIds: ["P1", "P2"],
          style: "SOLID" as const,
        },
      ],
      labels: [{ text: "y=x", anchorPointId: "P2", position: "RIGHT" as const }],
      caption: "Đồ thị hàm số",
    };
    expect(() => lessonSummaryDiagramSpecSchema.parse(graphWithoutAxes)).toThrow(
      /horizontal and vertical axes/u,
    );

    const fractionNumberLine = {
      ...common,
      points: [
        { id: "start", x: -2, y: 0, label: null, labelPosition: null },
        { id: "end", x: 2, y: 0, label: null, labelPosition: null },
        { id: "P", x: 1.25, y: 0, label: "P", labelPosition: "TOP" as const },
      ],
      primitives: [
        {
          id: "axis",
          type: "LINE" as const,
          from: "start",
          to: "end",
          style: "SOLID" as const,
        },
      ],
      labels: [{ text: "5/4", anchorPointId: "P", position: "BOTTOM" as const }],
      caption: "Phân số trên trục số",
    };
    const fractionNumberLineResult =
      lessonSummaryDiagramSpecSchema.safeParse(fractionNumberLine);
    expect(
      fractionNumberLineResult.success
        ? []
        : fractionNumberLineResult.error.issues.map((issue) => issue.message),
    ).not.toContain("Fraction area model 5/4 requires at least 5 filled polygons.");

    const fractionWithoutFill = {
      ...common,
      points: [
        { id: "A", x: 0, y: 0, label: null, labelPosition: null },
        { id: "B", x: 2, y: 0, label: null, labelPosition: null },
        { id: "C", x: 2, y: 1, label: null, labelPosition: null },
        { id: "D", x: 0, y: 1, label: null, labelPosition: null },
      ],
      primitives: [
        {
          id: "cell",
          type: "POLYGON" as const,
          pointIds: ["A", "B", "C", "D"],
          fill: "NONE" as const,
          style: "SOLID" as const,
        },
      ],
      labels: [{ text: "3/8", anchorPointId: "A", position: "TOP" as const }],
      caption: "Phân số 3/8",
    };
    expect(() => lessonSummaryDiagramSpecSchema.parse(fractionWithoutFill)).toThrow(
      /filled polygons/u,
    );

    const cylinderWithoutRadius = {
      ...common,
      points: [
        { id: "O1", x: 0, y: 2, label: null, labelPosition: null },
        { id: "O2", x: 0, y: -2, label: null, labelPosition: null },
      ],
      primitives: [
        {
          id: "top",
          type: "ELLIPSE" as const,
          center: "O1",
          radiusX: 2,
          radiusY: 0.5,
          rotation: 0,
          style: "SOLID" as const,
        },
        {
          id: "bottom",
          type: "ELLIPSE" as const,
          center: "O2",
          radiusX: 2,
          radiusY: 0.5,
          rotation: 0,
          style: "SOLID" as const,
        },
      ],
      labels: [{ text: "r", anchorPointId: "O1", position: "RIGHT" as const }],
      caption: "Hình trụ",
    };
    expect(() => lessonSummaryDiagramSpecSchema.parse(cylinderWithoutRadius)).toThrow(
      /segment from an ellipse center/u,
    );

    const fractionNumberLineWithoutTicks = {
      ...common,
      points: [
        { id: "L", x: -2, y: 0, label: null, labelPosition: null },
        { id: "R", x: 2, y: 0, label: null, labelPosition: null },
        { id: "A", x: 1.25, y: 0, label: null, labelPosition: null },
        { id: "B", x: -1.25, y: 0, label: null, labelPosition: null },
      ],
      primitives: [
        {
          id: "axis",
          type: "LINE" as const,
          from: "L",
          to: "R",
          style: "SOLID" as const,
        },
      ],
      labels: [
        { text: "5/4", anchorPointId: "A", position: "BOTTOM" as const },
        { text: "-5/4", anchorPointId: "B", position: "BOTTOM" as const },
      ],
      caption: "Biểu diễn trên trục số",
    };
    expect(() =>
      lessonSummaryDiagramSpecSchema.parse(fractionNumberLineWithoutTicks),
    ).toThrow(/visible tick segments/u);
  });

  it("rejects detached labels, duplicated geometry text and underspecified markers", () => {
    const triangle = {
      version: 1 as const,
      coordinateSystem: "CARTESIAN" as const,
      viewBox: { minX: -1, minY: -1, width: 6, height: 6 },
      toScale: true as const,
      points: [
        {
          id: "A",
          x: 0,
          y: 0,
          label: "A",
          pointStyle: "NONE" as const,
          labelPosition: "BOTTOM_LEFT" as const,
        },
        {
          id: "B",
          x: 0,
          y: 3,
          label: "B",
          pointStyle: "NONE" as const,
          labelPosition: "TOP_LEFT" as const,
        },
        {
          id: "C",
          x: 4,
          y: 0,
          label: "C",
          pointStyle: "NONE" as const,
          labelPosition: "BOTTOM_RIGHT" as const,
        },
      ],
      primitives: [
        {
          id: "AB",
          type: "SEGMENT" as const,
          from: "A",
          to: "B",
          style: "SOLID" as const,
        },
        {
          id: "AC",
          type: "SEGMENT" as const,
          from: "A",
          to: "C",
          style: "SOLID" as const,
        },
        {
          id: "BC",
          type: "SEGMENT" as const,
          from: "B",
          to: "C",
          style: "SOLID" as const,
        },
      ],
      markers: [
        {
          type: "ANGLE" as const,
          vertex: "B",
          armPointIds: ["A", "C"],
          label: "∠B",
        },
      ],
      labels: [
        {
          text: "AB = 3 cm",
          anchorPointId: "A",
          anchorPrimitiveId: "AB",
          position: "LEFT" as const,
        },
      ],
      caption: "Tam giác ABC",
    };
    expect(() => lessonSummaryDiagramSpecSchema.parse(triangle)).toThrow(
      /must not repeat the vertex name|Do not write segment names/u,
    );

    const detachedCoordinate = {
      ...triangle,
      points: [
        ...triangle.points,
        {
          id: "P",
          x: 2,
          y: 2,
          label: null,
          pointStyle: "NONE" as const,
          labelPosition: null,
        },
      ],
      markers: [],
      labels: [
        {
          text: "(0; 3)",
          anchorPointId: "P",
          position: "TOP" as const,
        },
      ],
      caption: "Ba điểm trong mặt phẳng tọa độ",
    };
    expect(() => lessonSummaryDiagramSpecSchema.parse(detachedCoordinate)).toThrow(
      /anchor directly/u,
    );

    const singleEqualLengthMarker = {
      ...triangle,
      markers: [{ type: "EQUAL_LENGTH" as const, segmentIds: ["AB"], markCount: 1 }],
      labels: [],
    };
    expect(() => lessonSummaryDiagramSpecSchema.parse(singleEqualLengthMarker)).toThrow();
  });

  it("allows the same textbook label on different segments but rejects a true duplicate", () => {
    const trapezoid = {
      version: 1 as const,
      coordinateSystem: "CARTESIAN" as const,
      viewBox: { minX: -1, minY: -1, width: 8, height: 6 },
      toScale: true as const,
      points: [
        {
          id: "A",
          x: 0,
          y: 0,
          label: "A",
          pointStyle: "NONE" as const,
          labelPosition: "BOTTOM_LEFT" as const,
        },
        {
          id: "B",
          x: 6,
          y: 0,
          label: "B",
          pointStyle: "NONE" as const,
          labelPosition: "BOTTOM_RIGHT" as const,
        },
        {
          id: "C",
          x: 5,
          y: 3,
          label: "C",
          pointStyle: "NONE" as const,
          labelPosition: "TOP_RIGHT" as const,
        },
        {
          id: "D",
          x: 1,
          y: 3,
          label: "D",
          pointStyle: "NONE" as const,
          labelPosition: "TOP_LEFT" as const,
        },
      ],
      primitives: [
        {
          id: "AB",
          type: "SEGMENT" as const,
          from: "A",
          to: "B",
          style: "SOLID" as const,
        },
        {
          id: "BC",
          type: "SEGMENT" as const,
          from: "B",
          to: "C",
          style: "SOLID" as const,
        },
        {
          id: "CD",
          type: "SEGMENT" as const,
          from: "C",
          to: "D",
          style: "SOLID" as const,
        },
        {
          id: "DA",
          type: "SEGMENT" as const,
          from: "D",
          to: "A",
          style: "SOLID" as const,
        },
      ],
      markers: [],
      labels: [
        {
          text: "đáy",
          anchorPointId: "A",
          anchorPrimitiveId: "AB",
          position: "TOP" as const,
        },
        {
          text: "đáy",
          anchorPointId: "A",
          anchorPrimitiveId: "CD",
          position: "TOP" as const,
        },
      ],
      caption: "Hình thang ABCD",
    };

    expect(() => lessonSummaryDiagramSpecSchema.parse(trapezoid)).not.toThrow();
    expect(() =>
      lessonSummaryDiagramSpecSchema.parse({
        ...trapezoid,
        labels: [...trapezoid.labels, trapezoid.labels[0]],
      }),
    ).toThrow(/Duplicate label/u);
  });

  it("enforces textbook clock marks and the numeric zero convention on number lines", () => {
    const clock = {
      version: 1 as const,
      coordinateSystem: "CARTESIAN" as const,
      viewBox: { minX: -6, minY: -6, width: 12, height: 12 },
      toScale: true as const,
      points: [
        {
          id: "C",
          x: 0,
          y: 0,
          label: null,
          pointStyle: "FILLED" as const,
          labelPosition: null,
        },
        {
          id: "N1",
          x: 0,
          y: 4.2,
          label: null,
          pointStyle: "NONE" as const,
          labelPosition: null,
        },
        {
          id: "N2",
          x: 0,
          y: 5,
          label: null,
          pointStyle: "NONE" as const,
          labelPosition: null,
        },
        {
          id: "E1",
          x: 4.2,
          y: 0,
          label: null,
          pointStyle: "NONE" as const,
          labelPosition: null,
        },
        {
          id: "E2",
          x: 5,
          y: 0,
          label: null,
          pointStyle: "NONE" as const,
          labelPosition: null,
        },
        {
          id: "S1",
          x: 0,
          y: -4.2,
          label: null,
          pointStyle: "NONE" as const,
          labelPosition: null,
        },
        {
          id: "S2",
          x: 0,
          y: -5,
          label: null,
          pointStyle: "NONE" as const,
          labelPosition: null,
        },
        {
          id: "W1",
          x: -4.2,
          y: 0,
          label: null,
          pointStyle: "NONE" as const,
          labelPosition: null,
        },
        {
          id: "W2",
          x: -5,
          y: 0,
          label: null,
          pointStyle: "NONE" as const,
          labelPosition: null,
        },
        {
          id: "Minute",
          x: 0,
          y: -3.6,
          label: null,
          pointStyle: "NONE" as const,
          labelPosition: null,
        },
        {
          id: "Hour",
          x: 3,
          y: -0.8,
          label: null,
          pointStyle: "NONE" as const,
          labelPosition: null,
        },
      ],
      primitives: [
        {
          id: "face",
          type: "CIRCLE" as const,
          center: "C",
          radius: 5,
          style: "SOLID" as const,
        },
        {
          id: "tick12",
          type: "SEGMENT" as const,
          from: "N1",
          to: "N2",
          style: "SOLID" as const,
        },
        {
          id: "tick3",
          type: "SEGMENT" as const,
          from: "E1",
          to: "E2",
          style: "SOLID" as const,
        },
        {
          id: "tick6",
          type: "SEGMENT" as const,
          from: "S1",
          to: "S2",
          style: "SOLID" as const,
        },
        {
          id: "tick9",
          type: "SEGMENT" as const,
          from: "W1",
          to: "W2",
          style: "SOLID" as const,
        },
        {
          id: "minuteHand",
          type: "SEGMENT" as const,
          from: "C",
          to: "Minute",
          style: "SOLID" as const,
        },
        {
          id: "hourHand",
          type: "SEGMENT" as const,
          from: "C",
          to: "Hour",
          style: "SOLID" as const,
        },
      ],
      markers: [],
      labels: [
        {
          text: "12",
          anchorPointId: "N1",
          anchorPrimitiveId: null,
          position: "BOTTOM" as const,
        },
        {
          text: "3",
          anchorPointId: "E1",
          anchorPrimitiveId: null,
          position: "LEFT" as const,
        },
        {
          text: "6",
          anchorPointId: "S1",
          anchorPrimitiveId: null,
          position: "TOP" as const,
        },
        {
          text: "9",
          anchorPointId: "W1",
          anchorPrimitiveId: null,
          position: "RIGHT" as const,
        },
      ],
      caption: "Đồng hồ chỉ 3 giờ 30 phút",
    };
    expect(() => lessonSummaryDiagramSpecSchema.parse(clock)).not.toThrow();
    expect(() =>
      lessonSummaryDiagramSpecSchema.parse({
        ...clock,
        primitives: clock.primitives.filter(
          (primitive) => !primitive.id.startsWith("tick"),
        ),
      }),
    ).toThrow(/hour tick segments/u);

    const numberLine = {
      version: 1 as const,
      coordinateSystem: "CARTESIAN" as const,
      viewBox: { minX: -2, minY: -1, width: 4, height: 2 },
      toScale: true as const,
      points: [
        {
          id: "L",
          x: -2,
          y: 0,
          label: null,
          pointStyle: "NONE" as const,
          labelPosition: null,
        },
        {
          id: "R",
          x: 2,
          y: 0,
          label: null,
          pointStyle: "NONE" as const,
          labelPosition: null,
        },
        {
          id: "Zero",
          x: 0,
          y: 0,
          label: null,
          pointStyle: "NONE" as const,
          labelPosition: null,
        },
        {
          id: "ZeroLow",
          x: 0,
          y: -0.1,
          label: null,
          pointStyle: "NONE" as const,
          labelPosition: null,
        },
        {
          id: "ZeroHigh",
          x: 0,
          y: 0.1,
          label: null,
          pointStyle: "NONE" as const,
          labelPosition: null,
        },
        {
          id: "One",
          x: 1,
          y: 0,
          label: null,
          pointStyle: "NONE" as const,
          labelPosition: null,
        },
        {
          id: "OneLow",
          x: 1,
          y: -0.1,
          label: null,
          pointStyle: "NONE" as const,
          labelPosition: null,
        },
        {
          id: "OneHigh",
          x: 1,
          y: 0.1,
          label: null,
          pointStyle: "NONE" as const,
          labelPosition: null,
        },
      ],
      primitives: [
        {
          id: "axis",
          type: "LINE" as const,
          from: "L",
          to: "R",
          style: "SOLID" as const,
        },
        {
          id: "tick0",
          type: "SEGMENT" as const,
          from: "ZeroLow",
          to: "ZeroHigh",
          style: "SOLID" as const,
        },
        {
          id: "tick1",
          type: "SEGMENT" as const,
          from: "OneLow",
          to: "OneHigh",
          style: "SOLID" as const,
        },
      ],
      markers: [],
      labels: [
        {
          text: "0",
          anchorPointId: "Zero",
          anchorPrimitiveId: null,
          position: "BOTTOM" as const,
        },
        {
          text: "1",
          anchorPointId: "One",
          anchorPrimitiveId: null,
          position: "BOTTOM" as const,
        },
      ],
      caption: "Biểu diễn số 1 trên trục số",
    };
    expect(() => lessonSummaryDiagramSpecSchema.parse(numberLine)).not.toThrow();
    expect(() =>
      lessonSummaryDiagramSpecSchema.parse({
        ...numberLine,
        labels: [
          ...numberLine.labels,
          {
            text: "O",
            anchorPointId: "Zero",
            anchorPrimitiveId: null,
            position: "TOP" as const,
          },
        ],
      }),
    ).toThrow(/not the coordinate-origin name O/u);
  });
});
