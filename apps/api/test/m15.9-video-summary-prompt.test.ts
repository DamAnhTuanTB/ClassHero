import { describe, expect, it } from "vitest";

import { buildAiStructuredTextFormat } from "#api/modules/ai/utils/ai-structured-output-format";
import {
  hasValidVideoSummaryCueStartTimes,
  isVideoSummaryExampleSelfContained,
  normalizeVideoSummaryTextLayout,
  toVideoSummaryBlocksDocument,
  videoSummaryOutputSchema,
} from "#api/modules/learning-paths/utils/video-summary-output";
import {
  buildVideoSummaryPrompts,
  buildVideoSummarySystemPrompt,
  resolveVideoSummarySubject,
  VIDEO_SUMMARY_PROMPT_VERSION,
  type VideoSummarySubject,
} from "#api/modules/learning-paths/utils/video-summary-prompt";
import { serializeVideoSummarySourceText } from "#api/modules/learning-paths/utils/video-summary-source";

const mathSubject: VideoSummarySubject = {
  key: "MATH",
  name: "Toán",
  slug: "toan",
};

function configuration(
  overrides: Partial<
    Parameters<typeof buildVideoSummaryPrompts>[0]["configuration"]
  > = {},
) {
  return {
    style: "student_friendly" as const,
    styleInstructions: "Dễ hiểu, gần gũi và phù hợp với người học",
    length: "standard" as const,
    targetWordCount: null,
    extraInstructions: null,
    systemInstructions: null,
    userPrompt: null,
    ...overrides,
  };
}

describe("M15.9 video summary prompts", () => {
  it("maps all supported course subjects", () => {
    expect(
      resolveVideoSummarySubject({ domainName: "Toán học", domainSlug: "toan-hoc" }).key,
    ).toBe("MATH");
    expect(
      resolveVideoSummarySubject({ domainName: "Vật lý", domainSlug: "vat-ly" }).key,
    ).toBe("PHYSICS");
    expect(
      resolveVideoSummarySubject({ domainName: "Hóa học", domainSlug: "hoa-hoc" }).key,
    ).toBe("CHEMISTRY");
    expect(
      resolveVideoSummarySubject({ domainName: "Lịch sử", domainSlug: "lich-su" }).key,
    ).toBe("GENERAL");
  });

  it("uses Knowledge block prose, example fields, solution rules and video timing", () => {
    const prompts = buildVideoSummaryPrompts({
      lessonTitle: "Tập hợp các số hữu tỉ",
      targetGrade: 7,
      subject: mathSubject,
      configuration: configuration({
        style: "concise",
        styleInstructions: "Cô đọng, đi thẳng vào trọng tâm.",
        length: "short",
        targetWordCount: 220,
        extraInstructions: "Nhấn mạnh cách biểu diễn trên trục số.",
      }),
    });

    expect(prompts.promptVersion).toBe(VIDEO_SUMMARY_PROMPT_VERSION);
    expect(prompts.systemPrompt).toContain("`objectives`");
    expect(prompts.systemPrompt).toContain("`problem`, `solution`, `answer`");
    expect(prompts.systemPrompt).toContain("`startSeconds`");
    expect(prompts.systemPrompt).toContain("Lời giải phải đầy đủ");
    expect(prompts.systemPrompt).toContain("knowledge → example → example → knowledge");
    expect(prompts.systemPrompt).toContain("không tạo khối `example`");
    expect(prompts.systemPrompt).toContain("mỗi section chính đúng một bullet");
    expect(prompts.systemPrompt).toContain("phụ thuộc vào hình");
    expect(prompts.systemPrompt).toContain("Khẳng định a) đúng.");
    expect(prompts.systemPrompt).toContain("chỉ gồm các bullet Markdown");
    expect(prompts.userPrompt).toContain("- Cách trình bày: Cô đọng");
    expect(prompts.userPrompt).toContain("mục tiêu khoảng 220 từ");
    expect(prompts.systemPrompt).not.toContain("220 từ");
  });

  it("keeps the stable prompt identical while dynamic settings change", () => {
    const first = buildVideoSummaryPrompts({
      lessonTitle: "Số hữu tỉ",
      targetGrade: 7,
      subject: mathSubject,
      configuration: configuration({ targetWordCount: 220 }),
    });
    const second = buildVideoSummaryPrompts({
      lessonTitle: "Tam giác đồng dạng",
      targetGrade: 8,
      subject: mathSubject,
      configuration: configuration({
        length: "detailed",
        targetWordCount: 500,
        extraInstructions: "Giữ rõ các giả thiết hình học.",
      }),
    });

    expect(first.systemPrompt).toBe(second.systemPrompt);
    expect(first.userPrompt).not.toBe(second.userPrompt);
  });

  it("keeps subject conventions isolated", () => {
    expect(buildVideoSummarySystemPrompt("MATH")).toContain("giả thiết");
    expect(buildVideoSummarySystemPrompt("MATH")).not.toContain("mhchem");
    expect(buildVideoSummarySystemPrompt("PHYSICS")).toContain("chiều vector");
    expect(buildVideoSummarySystemPrompt("CHEMISTRY")).toContain("$\\ce{H2O}$");
    expect(buildVideoSummarySystemPrompt("GENERAL")).toContain("mốc sự kiện");
  });

  it("preserves full custom prompt overrides", () => {
    const prompts = buildVideoSummaryPrompts({
      lessonTitle: "Bài 29",
      targetGrade: 9,
      subject: mathSubject,
      configuration: configuration({
        systemInstructions: "CUSTOM SYSTEM",
        userPrompt: "CUSTOM USER",
      }),
    });

    expect(prompts.systemPrompt).toBe("CUSTOM SYSTEM");
    expect(prompts.userPrompt).toBe("CUSTOM USER");
  });

  it("serializes a continuous cue stream with exact start mapping", () => {
    const sourceText = serializeVideoSummarySourceText({
      videoUrl: "https://youtu.be/example",
      transcript: [
        { time: 1, text: "Mở đầu bài học" },
        { time: 4, text: "và giải thích nội dung chính." },
      ],
      chapters: [{ time: 60, title: "Phần một" }],
      language: "vi",
      hashes: {
        videoUrl: "video",
        transcript: "transcript",
        chapters: "chapters",
        playerSettings: "settings",
        source: "source",
      },
    });

    expect(sourceText).toContain("[1:00] Phần một");
    expect(sourceText).toContain(
      '<cue startSeconds="1">Mở đầu bài học</cue> <cue startSeconds="4">và giải thích nội dung chính.</cue>',
    );
    expect(sourceText).not.toContain("[0:01]");
  });

  it("accepts the Knowledge-compatible chronological output", () => {
    expect(videoSummaryOutputSchema.safeParse(validBlockOutput()).success).toBe(true);
  });

  it("builds the strict provider schema for objectives, sections and blocks", () => {
    const format = buildAiStructuredTextFormat(
      videoSummaryOutputSchema,
      "video_summary_output",
    );

    expect(format.schema).toMatchObject({
      type: "object",
      required: ["title", "objectives", "sections"],
      properties: {
        objectives: { type: "array", minItems: 1, maxItems: 10 },
        sections: { type: "array", minItems: 1, maxItems: 20 },
      },
    });
  });

  it("rejects a missing solution or a summary outside the final position", () => {
    const missingSolution = structuredClone(validBlockOutput());
    delete (missingSolution.sections[0]!.blocks[1] as { solution?: string }).solution;
    const misplacedSummary = structuredClone(validBlockOutput());
    misplacedSummary.sections[0]!.blocks = [
      misplacedSummary.sections[0]!.blocks[2]!,
      misplacedSummary.sections[0]!.blocks[0]!,
      misplacedSummary.sections[0]!.blocks[1]!,
    ];

    expect(videoSummaryOutputSchema.safeParse(missingSolution).success).toBe(false);
    expect(videoSummaryOutputSchema.safeParse(misplacedSummary).success).toBe(false);
  });

  it("allows a theory-only video without inventing an example", () => {
    const theoryOnly = structuredClone(validBlockOutput());
    theoryOnly.sections[0]!.blocks.splice(1, 1);

    expect(videoSummaryOutputSchema.safeParse(theoryOnly).success).toBe(true);
  });

  it("rejects blocks that move backwards in video time", () => {
    const output = structuredClone(validBlockOutput());
    output.sections[0]!.blocks[1]!.startSeconds = 0;

    expect(videoSummaryOutputSchema.safeParse(output).success).toBe(false);
  });

  it("requires one main learning item per main section", () => {
    const output = structuredClone(validBlockOutput());
    output.objectives.push("Một vi mục tiêu thừa");

    expect(videoSummaryOutputSchema.safeParse(output).success).toBe(false);
  });

  it("requires section start times to match the chronological content", () => {
    const output = structuredClone(validBlockOutput());
    output.sections[0]!.startSeconds = 44;

    expect(videoSummaryOutputSchema.safeParse(output).success).toBe(false);
  });

  it("rejects unresolved visual-dependent examples but keeps self-contained ones", () => {
    expect(
      isVideoSummaryExampleSelfContained({
        problem: "Mỗi điểm A, B, C trên trục số ở Hình 1.4 biểu diễn số nào?",
        solution: "Quan sát hình rồi đọc tọa độ.",
      }),
    ).toBe(false);
    expect(
      isVideoSummaryExampleSelfContained({
        problem: "Trên trục số, điểm A nằm bên phải O và cách O 5 đơn vị.",
        solution: "Vì A nằm bên phải O nên A biểu diễn số 5.",
      }),
    ).toBe(true);
    expect(
      isVideoSummaryExampleSelfContained({
        problem: "Vẽ hình chữ nhật ABCD có chiều dài 5 cm và chiều rộng 3 cm.",
        solution: "Dùng thước dựng bốn cạnh theo số đo đã cho.",
      }),
    ).toBe(true);
  });

  it("requires the final summary to be a bullet list of solvable task types", () => {
    const output = structuredClone(validBlockOutput());
    output.sections[0]!.blocks[2]!.content =
      "Người học có thể nhận biết và biểu diễn số hữu tỉ.";

    expect(videoSummaryOutputSchema.safeParse(output).success).toBe(false);
  });

  it("keeps referenced subpart labels on the same sentence line", () => {
    expect(
      normalizeVideoSummaryTextLayout(
        "Vì $0,25 \\in \\mathbb{Q}$. Khẳng định\n\na) đúng.\n\nb) Ta có:",
      ),
    ).toBe("Vì $0,25 \\in \\mathbb{Q}$. Khẳng định a) đúng.\n\nb) Ta có:");
  });

  it("accepts only start times that match real transcript cues", () => {
    const output = videoSummaryOutputSchema.parse(validBlockOutput());

    expect(hasValidVideoSummaryCueStartTimes(output, [12, 44])).toBe(true);
    expect(hasValidVideoSummaryCueStartTimes(output, [12, 43])).toBe(false);
  });

  it.each([
    ["số học", 2],
    ["đại số", 14],
    ["hình học", 35],
    ["thống kê", 58],
    ["mô hình hóa", 89],
  ])("keeps the block contract valid for the %s domain", (_domain, startSeconds) => {
    const output = structuredClone(validBlockOutput());
    output.sections[0]!.startSeconds = startSeconds;
    output.sections[0]!.blocks[0]!.startSeconds = startSeconds;
    output.sections[0]!.blocks[1]!.startSeconds = startSeconds + 10;
    expect(videoSummaryOutputSchema.safeParse(output).success).toBe(true);
  });

  it("maps output to the lesson_summary_blocks document used by Knowledge UI", () => {
    const document = toVideoSummaryBlocksDocument(
      videoSummaryOutputSchema.parse(validBlockOutput()),
    );

    expect(document.type).toBe("lesson_summary_blocks");
    expect(document.version).toBe(5);
    expect(document.data.objectives).toEqual(["Nhận biết và vận dụng số hữu tỉ"]);
    expect(document.data.sections[0]?.startSeconds).toBe(12);
    expect(document.data.sections[0]?.blocks).toMatchObject([
      { type: "knowledge", startSeconds: 12, figures: [] },
      {
        type: "example",
        startSeconds: 44,
        problem: "Viết $0,25$ dưới dạng phân số.",
        solution: "$0,25=\\frac{1}{4}$.",
        answer: "$\\frac{1}{4}$.",
        figures: [],
        origin: "SOURCE_EXACT",
      },
      { type: "summary", figures: [] },
    ]);
  });
});

function validBlockOutput() {
  return {
    title: "Số hữu tỉ và bài tập vận dụng",
    objectives: ["Nhận biết và vận dụng số hữu tỉ"],
    sections: [
      {
        order: 1,
        displayHeading: "Khái niệm và ví dụ mở đầu",
        startSeconds: 12,
        blocks: [
          {
            type: "knowledge" as const,
            title: "Khái niệm số hữu tỉ",
            startSeconds: 12,
            content: "Số hữu tỉ được biểu diễn dưới dạng phân số.",
          },
          {
            type: "example" as const,
            startSeconds: 44,
            problem: "Viết $0,25$ dưới dạng phân số.",
            solution: "$0,25=\\frac{1}{4}$.",
            answer: "$\\frac{1}{4}$.",
          },
          {
            type: "summary" as const,
            content:
              "- Nhận biết và biểu diễn số hữu tỉ.\n- Viết số thập phân hữu hạn dưới dạng phân số.",
          },
        ],
      },
    ],
  };
}
