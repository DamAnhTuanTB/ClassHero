import { describe, expect, it } from "vitest";

import type { AiStructuredInput } from "#api/modules/ai/types/ai-text.types";
import { buildOpenAiPromptCacheFields } from "#api/modules/ai/utils/ai-prompt-cache";
import { buildAiStructuredTextFormat } from "#api/modules/ai/utils/ai-structured-output-format";
import { buildVideoSummaryJobIdempotencyKey } from "#api/modules/learning-paths/services/video-summaries.service";
import {
  alignVideoSummaryOutputToChapters,
  buildVideoSummaryProviderOutputSchema,
  hasValidVideoSummaryCueStartTimes,
  hasMatchingVideoSummaryChapters,
  hasVideoSummaryBlock,
  isVideoSummaryExampleSelfContained,
  normalizeVideoSummaryTextLayout,
  normalizeVideoSummaryDocument,
  collectVideoSummaryOutputWarnings,
  toVideoSummaryBlocksDocument,
  videoSummarySectionsToChapters,
  VIDEO_SUMMARY_DOCUMENT_VERSION,
  videoSummaryProviderOutputSchema,
  videoSummaryOutputSchema,
} from "#api/modules/learning-paths/utils/video-summary-output";
import {
  buildVideoSummaryPrompts,
  buildVideoSummaryStructuredRequestPolicy,
  buildVideoSummarySystemPrompt,
  resolveVideoSummarySubject,
  VIDEO_SUMMARY_PROMPT_VERSION,
  type VideoSummarySubject,
} from "#api/modules/learning-paths/utils/video-summary-prompt";
import {
  buildVideoSummarySource,
  normalizeVideoSummaryChapterTitle,
  serializeVideoSummarySourceText,
} from "#api/modules/learning-paths/utils/video-summary-source";

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
  it("uses compact schema selection and a stable explicit prompt-cache prefix", () => {
    const policy = buildVideoSummaryStructuredRequestPolicy();
    const schema = buildVideoSummaryProviderOutputSchema([]);
    const format = buildAiStructuredTextFormat(
      schema,
      "video_summary_output",
      policy.schemaReferenceStrategy,
    );
    const createRequest = (
      userPrompt: string,
      sourceText: string,
    ): AiStructuredInput => ({
      ...policy,
      outputName: "video_summary_output",
      promptVersion: VIDEO_SUMMARY_PROMPT_VERSION,
      schemaVersion: "8",
      systemPrompt: "STABLE VIDEO SUMMARY CONTRACT",
      userPrompt,
      inputTextItems: [{ id: "source_packet_manifest", text: sourceText }],
    });
    const first = buildOpenAiPromptCacheFields({
      request: createRequest("YÊu cầu A", "Transcript A"),
      model: "gpt-5.6-luna",
      structuredTextFormat: format,
    });
    const second = buildOpenAiPromptCacheFields({
      request: createRequest("YÊu cầu B", "Transcript B"),
      model: "gpt-5.6-luna",
      structuredTextFormat: format,
    });

    expect(policy).toEqual({
      schemaReferenceStrategy: "auto",
      promptCache: {
        namespace: "video-summary",
        keyEnabled: true,
        retention: "in_memory",
      },
    });
    expect(first.prompt_cache_key).toBe(second.prompt_cache_key);
    expect(first.prompt_cache_options).toEqual({ mode: "explicit", ttl: "30m" });
  });

  it("creates a fresh idempotency key for each preview-authorized retry", () => {
    const shared = {
      lessonId: "lesson-1",
      sourceHash: "source-1",
      requestHash: "request-1",
    };

    expect(
      buildVideoSummaryJobIdempotencyKey({
        ...shared,
        requestDraftId: "draft-2",
      }),
    ).not.toBe(
      buildVideoSummaryJobIdempotencyKey({
        ...shared,
        requestDraftId: "draft-1",
      }),
    );
  });

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
    expect(prompts.systemPrompt).toContain("phải tạo đúng một section cho mỗi chapter");
    expect(prompts.systemPrompt).toContain(
      "Chỉ khi MỐC THỜI GIAN ghi rõ không có mốc chương",
    );
    expect(prompts.systemPrompt).toContain(
      "`section.startSeconds` phải giữ chính xác time của chapter tương ứng",
    );
    expect(prompts.systemPrompt).toContain("phụ thuộc vào hình");
    expect(prompts.systemPrompt).toContain("Khẳng định a) đúng.");
    expect(prompts.systemPrompt).toContain("`$\\widehat{ABC}$`");
    expect(prompts.systemPrompt).toContain("không viết `$m\\angle ABC$`");
    expect(prompts.systemPrompt).not.toContain("`summary`");
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
    const promptsBySubject = {
      MATH: buildVideoSummarySystemPrompt("MATH"),
      PHYSICS: buildVideoSummarySystemPrompt("PHYSICS"),
      CHEMISTRY: buildVideoSummarySystemPrompt("CHEMISTRY"),
      GENERAL: buildVideoSummarySystemPrompt("GENERAL"),
    };

    expect(promptsBySubject.MATH).toContain("giả thiết");
    expect(promptsBySubject.MATH).not.toContain("mhchem");
    expect(promptsBySubject.PHYSICS).toContain("chiều vector");
    expect(promptsBySubject.CHEMISTRY).toContain("$\\ce{H2O}$");
    expect(promptsBySubject.GENERAL).toContain("mốc sự kiện");
    for (const prompt of Object.values(promptsBySubject)) {
      expect(prompt).not.toContain("Sinh kiến thức");
      expect(prompt).toContain("UI hiển thị khối này dưới nhãn");
      expect(prompt).toContain("`title` ngắn và nêu đúng ý chính");
    }
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

  it("uses the whole original-video timeline and canonical chapter titles", () => {
    const source = buildVideoSummarySource({
      videoUrl: "https://youtu.be/example",
      customVideoSettings: {
        startTimeInSeconds: 5,
        endTimeCutInSeconds: 10,
        transcript: [
          { time: 5, endTime: 7, text: "Phần sau." },
          { time: 1, endTime: 3, text: "Phần đầu." },
        ],
        chapters: [
          { time: 926, title: "2. Hệ hai phương trình bậc nhất hai ẩn" },
          { time: 0, title: "Giới thiệu" },
          { time: 1560, title: "3. Vận dụng" },
          { time: 153, title: "1. Phương trình bậc nhất hai ẩn" },
        ],
      },
    });

    expect(source?.transcript).toEqual([
      { time: 1, endTime: 3, text: "Phần đầu." },
      { time: 5, endTime: 7, text: "Phần sau." },
    ]);
    expect(source?.chapters).toEqual([
      { time: 0, title: "Giới thiệu" },
      { time: 153, title: "Phương trình bậc nhất hai ẩn" },
      { time: 926, title: "Hệ hai phương trình bậc nhất hai ẩn" },
      { time: 1560, title: "Vận dụng" },
    ]);

    const sourceWithDifferentCuts = buildVideoSummarySource({
      videoUrl: "https://youtu.be/example",
      customVideoSettings: {
        startTimeInSeconds: 100,
        endTimeCutInSeconds: 200,
        transcript: [
          { time: 5, endTime: 7, text: "Phần sau." },
          { time: 1, endTime: 3, text: "Phần đầu." },
        ],
        chapters: [
          { time: 926, title: "2. Hệ hai phương trình bậc nhất hai ẩn" },
          { time: 0, title: "Giới thiệu" },
          { time: 1560, title: "3. Vận dụng" },
          { time: 153, title: "1. Phương trình bậc nhất hai ẩn" },
        ],
      },
    });
    expect(sourceWithDifferentCuts?.hashes.source).toBe(source?.hashes.source);
  });

  it("keeps numeric title content that is not a leading chapter ordinal", () => {
    expect(normalizeVideoSummaryChapterTitle("1.000 năm lịch sử")).toBe(
      "1.000 năm lịch sử",
    );
    expect(normalizeVideoSummaryChapterTitle("2. Phương trình")).toBe("Phương trình");
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
        objectives: { type: "array", minItems: 1, maxItems: 20 },
        sections: { type: "array", minItems: 1, maxItems: 20 },
      },
    });
    expect(JSON.stringify(format.schema)).not.toContain('"summary"');
  });

  it("uses exact section and objective counts when source chapters exist", () => {
    const chapters = [
      { time: 0, title: "Giới thiệu" },
      { time: 153, title: "Phương trình bậc nhất hai ẩn" },
      { time: 926, title: "Hệ hai phương trình" },
      { time: 1560, title: "Vận dụng" },
    ];
    const format = buildAiStructuredTextFormat(
      buildVideoSummaryProviderOutputSchema(chapters),
      "video_summary_output",
    );

    expect(format.schema).toMatchObject({
      properties: {
        objectives: { type: "array", minItems: 4, maxItems: 4 },
        sections: { type: "array", minItems: 4, maxItems: 4 },
      },
    });
  });

  it("keeps a flexible section count only when source chapters are absent", () => {
    const format = buildAiStructuredTextFormat(
      buildVideoSummaryProviderOutputSchema([]),
      "video_summary_output",
    );

    expect(format.schema).toMatchObject({
      properties: {
        objectives: { type: "array", minItems: 1, maxItems: 20 },
        sections: { type: "array", minItems: 1, maxItems: 20 },
      },
    });
    expect(JSON.stringify(format.schema)).not.toContain('"summary"');
  });

  it("rejects a missing solution and the removed summary block", () => {
    const missingSolution = structuredClone(validBlockOutput());
    delete (missingSolution.sections[0]!.blocks[1] as { solution?: string }).solution;
    const outputWithSummary = structuredClone(validBlockOutput());
    outputWithSummary.sections[0]!.blocks.push({
      type: "summary",
      content: "- Nội dung tổng kết cũ.",
    } as never);

    expect(videoSummaryOutputSchema.safeParse(missingSolution).success).toBe(false);
    expect(videoSummaryOutputSchema.safeParse(outputWithSummary).success).toBe(false);
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

  it("detects unresolved visual-dependent examples but keeps self-contained ones", () => {
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

  it("keeps an unresolved visual-dependent example and returns a review warning", () => {
    const providerOutput = structuredClone(validBlockOutput());
    providerOutput.sections[0]!.blocks[1] = {
      ...providerOutput.sections[0]!.blocks[1]!,
      problem: "Quan sát Hình 1.4 rồi xác định tọa độ điểm A.",
      solution: "Đọc tọa độ trực tiếp từ hình.",
    };

    expect(videoSummaryProviderOutputSchema.safeParse(providerOutput).success).toBe(true);
    expect(videoSummaryOutputSchema.safeParse(providerOutput).success).toBe(true);

    const warnings = collectVideoSummaryOutputWarnings(
      videoSummaryProviderOutputSchema.parse(providerOutput),
    );
    expect(warnings).toEqual([
      expect.objectContaining({
        code: "UNRESOLVED_VISUAL_REFERENCE",
        path: "sections.0.blocks.1.problem",
        severity: "WARNING",
      }),
    ]);
    const document = toVideoSummaryBlocksDocument(
      videoSummaryOutputSchema.parse(providerOutput),
      warnings,
    );
    expect(document.data.sections[0]?.blocks).toHaveLength(2);
    expect(document.data.sections[0]?.blocks[1]?.type).toBe("example");
    expect(document.data.warnings).toEqual(warnings);
  });

  it("keeps referenced subpart labels on the same sentence line", () => {
    expect(
      normalizeVideoSummaryTextLayout(
        "Vì $0,25 \\in \\mathbb{Q}$. Khẳng định\n\na) đúng.\n\nb) Ta có:",
      ),
    ).toBe("Vì $0,25 \\in \\mathbb{Q}$. Khẳng định a) đúng.\n\nb) Ta có:");
  });

  it("normalizes measured angles and terminal math delimiters in Video Summary text", () => {
    expect(
      normalizeVideoSummaryTextLayout(
        String.raw`Tứ giác nội tiếp đường tròn $(O). Ta có $m\angle DAB=m\widehat{BCD}$.`,
      ),
    ).toBe(
      String.raw`Tứ giác nội tiếp đường tròn $(O)$. Ta có $\widehat{DAB}=\widehat{BCD}$.`,
    );
  });

  it("normalizes every persisted Video Summary text field and warns without rejecting", () => {
    const providerOutput = structuredClone(validBlockOutput());
    providerOutput.title = String.raw`Bài $m\angle ABC$`;
    providerOutput.objectives[0] = String.raw`Hiểu $m\angle ABC$`;
    providerOutput.sections[0]!.displayHeading = String.raw`Góc $m\angle ABC$`;
    providerOutput.sections[0]!.blocks[0] = {
      ...providerOutput.sections[0]!.blocks[0]!,
      title: String.raw`Số đo $m\angle ABC$`,
      content: String.raw`Công thức $x_{1$ chưa cân bằng.`,
    };

    const parsed = videoSummaryProviderOutputSchema.parse(providerOutput);
    const warnings = collectVideoSummaryOutputWarnings(parsed);
    expect(warnings).toEqual([
      expect.objectContaining({
        code: "MALFORMED_LATEX",
        path: "sections.0.blocks.0.content",
        severity: "WARNING",
      }),
    ]);
    const document = toVideoSummaryBlocksDocument(
      videoSummaryOutputSchema.parse(providerOutput),
      warnings,
    );
    expect(document.data.title).toBe(String.raw`Bài $\widehat{ABC}$`);
    expect(document.data.objectives[0]).toBe(String.raw`Hiểu $\widehat{ABC}$`);
    expect(document.data.sections[0]?.displayHeading).toBe(
      String.raw`Góc $\widehat{ABC}$`,
    );
    expect(document.data.sections[0]?.blocks[0]).toMatchObject({
      title: String.raw`Số đo $\widehat{ABC}$`,
    });
  });

  it("accepts only start times that match real transcript cues", () => {
    const output = videoSummaryOutputSchema.parse(validBlockOutput());

    expect(hasValidVideoSummaryCueStartTimes(output, [12, 44])).toBe(true);
    expect(hasValidVideoSummaryCueStartTimes(output, [12, 43])).toBe(false);
  });

  it("aligns existing chapters exactly and constrains blocks to each chapter range", () => {
    const output = videoSummaryOutputSchema.parse(twoSectionOutput());
    const chapters = [
      { time: 0, title: "Giới thiệu" },
      { time: 60, title: "Vận dụng" },
    ];
    output.sections[0]!.order = 2;
    output.sections[0]!.displayHeading = "AI tự đổi tên";
    output.sections[0]!.startSeconds = 12;
    output.sections[0]!.blocks[1]!.startSeconds = 60;

    const aligned = alignVideoSummaryOutputToChapters(output, chapters);

    expect(
      aligned.sections.map(({ order, displayHeading, startSeconds }) => ({
        order,
        displayHeading,
        startSeconds,
      })),
    ).toEqual([
      { order: 1, displayHeading: "Giới thiệu", startSeconds: 0 },
      { order: 2, displayHeading: "Vận dụng", startSeconds: 60 },
    ]);
    expect(aligned.sections[0]!.blocks).toHaveLength(1);
    expect(aligned.sections[1]!.blocks).toHaveLength(2);
    expect(hasMatchingVideoSummaryChapters(aligned, chapters)).toBe(true);
    expect(hasValidVideoSummaryCueStartTimes(aligned, [12, 44, 60], chapters)).toBe(true);

    aligned.sections[0]!.blocks[0]!.startSeconds = 60;
    expect(hasMatchingVideoSummaryChapters(aligned, chapters)).toBe(false);
  });

  it("maps AI-created sections back to video chapters when source has none", () => {
    const output = videoSummaryOutputSchema.parse(twoSectionOutput());

    expect(videoSummarySectionsToChapters(output)).toEqual([
      { time: 12, title: "Khái niệm và ví dụ mở đầu" },
      { time: 60, title: "Vận dụng" },
    ]);
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
    expect(document.version).toBe(VIDEO_SUMMARY_DOCUMENT_VERSION);
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
    ]);
    expect(hasVideoSummaryBlock(document)).toBe(false);
  });

  it("removes legacy summary blocks without mutating the stored value", () => {
    const legacyDocument = {
      type: "lesson_summary_blocks",
      version: 5,
      data: {
        title: "Video cũ",
        objectives: ["Phần một", "Tổng kết cũ"],
        summary: { type: "summary", content: "- Field tổng kết cũ." },
        sections: [
          {
            order: 1,
            displayHeading: "1. Phần một",
            blocks: [
              { type: "knowledge", title: "Kiến thức", content: "Nội dung" },
              { type: "summary", content: "- Block tổng kết cũ." },
            ],
          },
          {
            order: 2,
            displayHeading: "Tổng kết cũ",
            blocks: [{ type: "summary", content: "- Chỉ có tổng kết." }],
          },
        ],
      },
    };

    const normalized = normalizeVideoSummaryDocument(legacyDocument);

    expect(normalized).toMatchObject({
      version: VIDEO_SUMMARY_DOCUMENT_VERSION,
      data: {
        objectives: ["Phần một"],
        sections: [
          {
            order: 1,
            displayHeading: "Phần một",
            blocks: [{ type: "knowledge" }],
          },
        ],
      },
    });
    expect(hasVideoSummaryBlock(normalized)).toBe(false);
    expect(hasVideoSummaryBlock(legacyDocument)).toBe(true);
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
        ],
      },
    ],
  };
}

function twoSectionOutput() {
  const output = structuredClone(validBlockOutput());
  output.objectives.push("Vận dụng kiến thức");
  output.sections.push({
    order: 2,
    displayHeading: "Vận dụng",
    startSeconds: 60,
    blocks: [
      {
        type: "knowledge" as const,
        title: "Áp dụng",
        startSeconds: 60,
        content: "Áp dụng kiến thức vào bài toán.",
      },
    ],
  });
  return output;
}
