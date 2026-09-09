import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Difficulty } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  FLASHCARD_PROMPT_VERSIONS,
  FLASHCARD_SCHEMA_VERSION,
  generatedFlashcardOutputSchema,
  type FlashcardGenerationJobInput,
} from "#api/modules/flashcards/types/flashcard-generation.types";
import { resolveAiStructuredTextFormat } from "#api/modules/ai/utils/ai-structured-output-format";
import {
  buildOpenAiResponseInput,
  buildOpenAiStructuredResponseRequest,
} from "#api/modules/ai/utils/openai-response-request";
import {
  toFlashcardSolutionTiptap,
  validateGeneratedFlashcards,
} from "#api/modules/flashcards/utils/flashcard-generation-mapper";
import {
  buildFlashcardStructuredInput,
  buildFlashcardSystemPrompt,
  buildFlashcardUserPrompt,
} from "#api/modules/flashcards/utils/flashcard-generation-prompt";
import {
  FLASHCARD_FIGURE_SCHEMA_VERSION,
  buildFlashcardFigureStructuredInput,
} from "#api/modules/flashcards/types/flashcard-figure-generation.types";
import { buildSolutionFigureInput } from "#api/modules/quiz-figures/types/quiz-figure-generation.types";

function configuration(): FlashcardGenerationJobInput {
  return {
    requestDraftId: "00000000-0000-4000-8000-000000000002",
    requestHash: "a".repeat(64),
    packetHash: "c".repeat(64),
    manifestHash: "d".repeat(64),
    documentIds: ["00000000-0000-4000-8000-000000000003"],
    sourceHash: "b".repeat(64),
    targetGrade: 10,
    subjectKey: "MATH",
    subjectName: "Toán",
    subjectSlug: "toan",
    targetFlashcardSetId: "00000000-0000-4000-8000-000000000004",
    cardCount: 1,
    difficulty: Difficulty.EASY,
    difficultyCounts: null,
    style: "student_friendly",
    styleInstructions: "Dễ hiểu và ngắn gọn.",
    extraInstructions: "",
    systemInstructions: "",
    userPrompt: "",
    maxOutputTokens: 1_000,
    schemaReferenceStrategy: "ref_v2",
    promptCacheKeyEnabled: true,
    promptCacheRetention: "in_memory",
  };
}

function validOutput() {
  return {
    title: "Mệnh đề",
    cards: [
      {
        difficulty: Difficulty.EASY,
        front: "Mệnh đề là gì?",
        back: "Mệnh đề là một khẳng định có thể xác định là đúng hoặc sai.",
        solution:
          "Theo định nghĩa trong tài liệu, mệnh đề phải là một khẳng định và có đúng một giá trị chân lý: đúng hoặc sai. Vì vậy câu hỏi hay câu cảm thán không phải là mệnh đề.",
        sourcePacketPageNumbers: [1],
        requiresSolutionFigure: false,
      },
    ],
  };
}

describe("M9.28 Flashcard-owned generation core", () => {
  it("owns a front/back/solution contract and returns one solution-figure decision", () => {
    const output = generatedFlashcardOutputSchema.parse(validOutput());

    expect(output.cards[0]).toMatchObject({
      requiresSolutionFigure: false,
    });
    expect(() =>
      generatedFlashcardOutputSchema.parse({
        ...validOutput(),
        cards: [
          {
            ...validOutput().cards[0],
            requiresSolutionFigure: true,
          },
        ],
      }),
    ).not.toThrow();
  });

  it("builds Flashcard prompts independently without Quiz question-type configuration", () => {
    const subject = { key: "MATH" as const, name: "Toán", slug: "toan" };
    const systemPrompt = buildFlashcardSystemPrompt({ subject });
    const userPrompt = buildFlashcardUserPrompt({
      lessonTitle: "Mệnh đề - Tập hợp",
      subject,
      targetGrade: 10,
      configuration: configuration(),
      existingFronts: ["Tập hợp là gì?"],
    });

    expect(systemPrompt).toContain("### II. NỘI DUNG CỦA MỖI THẺ");
    expect(systemPrompt).toContain("Tình huống thực tế chỉ hợp lệ");
    expect(systemPrompt).toContain("`back` là câu trả lời trực tiếp");
    expect(systemPrompt).toContain("`solution` là lời giải đầy đủ");
    expect(systemPrompt).toContain("không lấy `back` làm tiền đề");
    expect(systemPrompt).toContain("Mỗi đơn vị lập luận nằm trong một đoạn");
    expect(systemPrompt).toContain("viết công thức gốc trước");
    expect(systemPrompt).toContain("`aligned`");
    expect(userPrompt).toContain("### NHIỆM VỤ TẠO FLASHCARD");
    expect(userPrompt).toContain("Môn học của khóa: Toán (MATH)");
    expect(userPrompt).toContain("học sinh lớp 10");
    expect(userPrompt).toContain("EXISTING_FLASHCARD_FRONTS_JSONL_BEGIN");
    expect(userPrompt).not.toContain("không lấy `back` làm tiền đề");
    expect(userPrompt).not.toContain("Mỗi thẻ chỉ kiểm tra một đơn vị kiến thức");
    expect(userPrompt).not.toContain("MULTIPLE_CHOICE");
    expect(userPrompt).not.toContain("Loại câu hỏi");
  });

  it("keeps every subject prompt complete, ordered and independently owned", () => {
    const subjects = [
      { key: "MATH" as const, name: "Toán", slug: "toan", marker: "KIỂM CHỨNG TOÁN HỌC" },
      {
        key: "PHYSICS" as const,
        name: "Vật lý",
        slug: "vat-ly",
        marker: "KIỂM CHỨNG VẬT LÝ",
      },
      {
        key: "CHEMISTRY" as const,
        name: "Hóa học",
        slug: "hoa-hoc",
        marker: "KIỂM CHỨNG HÓA HỌC",
      },
      {
        key: "GENERAL" as const,
        name: "Ngữ văn",
        slug: "ngu-van",
        marker: "KIỂM CHỨNG NỘI DUNG",
      },
    ];
    const headings = [
      "### I. VAI TRÒ VÀ PHẠM VI MÔN HỌC",
      "### II. NỘI DUNG CỦA MỖI THẺ",
      "### III. VAI TRÒ CỦA CÁC FIELD",
      "### IV. NỘI DUNG VÀ TRÌNH BÀY `solution`",
      "### V.",
      "### VI. LỰA CHỌN HÌNH MINH HỌA",
      "### VII. NGUỒN THAM CHIẾU VÀ STRUCTURED OUTPUT",
    ];

    for (const subject of subjects) {
      const prompt = buildFlashcardSystemPrompt({ subject });
      let previousIndex = -1;
      for (const heading of headings) {
        const nextIndex = prompt.indexOf(heading, previousIndex + 1);
        expect(nextIndex).toBeGreaterThan(previousIndex);
        previousIndex = nextIndex;
      }
      expect(prompt).toContain(subject.marker);
      expect(prompt).toContain("`front`");
      expect(prompt).toContain("`back`");
      expect(prompt).toContain("`solution`");
      expect(prompt).toContain("`sourcePacketPageNumbers`");
      expect(prompt).toContain("`requiresSolutionFigure`");
      expect(prompt).not.toContain("`requiresFrontFigure`");
      expect(prompt).not.toContain("`requiresBackFigure`");
      expect(prompt).not.toContain("FLASHCARD_SOLUTION_STYLE_POLICY");
      expect(prompt).not.toMatch(/phase\s*[12]/iu);
    }

    expect(FLASHCARD_PROMPT_VERSIONS).toEqual({
      MATH: "flashcard_math_v7_solution_figure_only",
      PHYSICS: "flashcard_physics_v7_solution_figure_only",
      CHEMISTRY: "flashcard_chemistry_v7_solution_figure_only",
      GENERAL: "flashcard_general_v7_solution_figure_only",
    });
  });

  it("keeps field descriptions concise and consistent with real-world cards", () => {
    const format = resolveAiStructuredTextFormat(
      generatedFlashcardOutputSchema,
      "generated_flashcards",
      "ref_v2",
    );
    const schemaText = JSON.stringify(format.format.schema);

    expect(FLASHCARD_SCHEMA_VERSION).toBe("flashcard_v6_solution_figure_only");
    expect(schemaText).toContain("tình huống thực tế phù hợp");
    expect(schemaText).toContain(
      "tuân thủ quy tắc nội dung, lập luận, định dạng trong system prompt",
    );
    expect(schemaText).not.toContain("Một câu hỏi lý thuyết ngắn");
    expect(schemaText).not.toContain("Tách các đơn vị lập luận bằng một dòng trống");
  });

  it("keeps a custom user prompt while appending existing fronts as reference data", () => {
    const subject = { key: "MATH" as const, name: "Toán", slug: "toan" };
    const userPrompt = buildFlashcardUserPrompt({
      lessonTitle: "Mệnh đề - Tập hợp",
      subject,
      targetGrade: 10,
      configuration: configuration(),
      existingFronts: ["  Tập hợp   là gì?  "],
      override: "Chỉ ưu tiên các nội dung trọng tâm của buổi học.",
    });

    expect(userPrompt).toContain("Chỉ ưu tiên các nội dung trọng tâm của buổi học.");
    expect(userPrompt).toContain('"Tập hợp là gì?"');
    expect(userPrompt).toContain("Đây là dữ liệu tham chiếu");
    expect(userPrompt).not.toContain("### NHIỆM VỤ TẠO FLASHCARD");
    expect(
      buildFlashcardSystemPrompt({ subject, override: "  System tùy chỉnh.  " }),
    ).toBe("System tùy chỉnh.");
  });

  it("attaches the canonical PDF packet directly with detail high", () => {
    const request = buildFlashcardStructuredInput({
      lessonId: "00000000-0000-4000-8000-000000000005",
      lessonTitle: "Mệnh đề - Tập hợp",
      sourceHash: "b".repeat(64),
      documentIds: ["00000000-0000-4000-8000-000000000003"],
      packet: {
        filename: "flashcard-source.pdf",
        bytes: Buffer.from("pdf fixture"),
        modelManifest: {
          version: 1,
          pages: [
            {
              packetPageNumber: 1,
              sourceKey: "D01",
              documentTitle: "Toán 10",
              sourcePdfPageNumber: 16,
              printedPageLabel: "16",
            },
          ],
        },
      },
      configuration: configuration(),
      existingFronts: [],
    });

    expect(request.inputFiles).toEqual([
      expect.objectContaining({
        filename: "flashcard-source.pdf",
        mimeType: "application/pdf",
        detail: "high",
      }),
    ]);
    expect(request.inputFiles?.[0]?.fileData).toBe(
      Buffer.from("pdf fixture").toString("base64"),
    );
    expect(request.contextChunks).toBeUndefined();
    expect(request.inputTextItems?.[0]?.text).toContain("packetPageNumber");
  });

  it("keeps the serialized system prefix stable while lesson data stays after the cache breakpoint", () => {
    const buildRequest = (lessonTitle: string, front: string) =>
      buildFlashcardStructuredInput({
        lessonId: "00000000-0000-4000-8000-000000000005",
        lessonTitle,
        sourceHash: "b".repeat(64),
        documentIds: ["00000000-0000-4000-8000-000000000003"],
        packet: {
          filename: "flashcard-source.pdf",
          bytes: Buffer.from(`pdf fixture ${lessonTitle}`),
          modelManifest: {
            version: 1,
            pages: [
              {
                packetPageNumber: 1,
                sourceKey: "D01",
                documentTitle: lessonTitle,
                sourcePdfPageNumber: 1,
                printedPageLabel: "1",
              },
            ],
          },
        },
        configuration: configuration(),
        existingFronts: [front],
      });
    const format = resolveAiStructuredTextFormat(
      generatedFlashcardOutputSchema,
      "generated_flashcards",
      "ref_v2",
    ).format;
    const render = (request: ReturnType<typeof buildRequest>) =>
      buildOpenAiStructuredResponseRequest({
        request,
        model: "gpt-5.6-luna",
        structuredTextFormat: format,
        responseInput: buildOpenAiResponseInput(request, [
          { type: "input_file", file_id: "file-runtime", detail: "high" },
        ]),
      });
    const first = render(buildRequest("Mệnh đề", "Mệnh đề là gì?"));
    const second = render(buildRequest("Tập hợp", "Tập hợp là gì?"));
    const firstInput = Array.isArray(first.input) ? first.input : [];
    const secondInput = Array.isArray(second.input) ? second.input : [];

    expect(JSON.stringify(firstInput[0])).toBe(JSON.stringify(secondInput[0]));
    expect(JSON.stringify(firstInput[0])).toContain("prompt_cache_breakpoint");
    expect(JSON.stringify(firstInput.slice(1))).not.toBe(
      JSON.stringify(secondInput.slice(1)),
    );
    expect(first.prompt_cache_key).toBe(second.prompt_cache_key);
  });

  it("rejects a non-question front, duplicate pair and wrong difficulty", () => {
    const base = validOutput();
    const validate = (output: typeof base) =>
      validateGeneratedFlashcards({
        output,
        requestedCount: 1,
        packetPageCount: 2,
        difficulty: Difficulty.EASY,
        difficultyCounts: null,
      });

    expect(() =>
      validate({
        ...base,
        cards: [{ ...base.cards[0], front: "Khái niệm mệnh đề" }],
      }),
    ).toThrow("AI_OUTPUT_FLASHCARD_FRONT_INVALID");
    expect(() =>
      validate({
        ...base,
        cards: [{ ...base.cards[0], front: "Mệnh đề là gì?", back: "Mệnh đề là gì" }],
      }),
    ).toThrow("AI_OUTPUT_FLASHCARD_PAIR_INVALID");
    expect(() =>
      validate({
        ...base,
        cards: [{ ...base.cards[0], difficulty: Difficulty.HARD }],
      }),
    ).toThrow("AI_OUTPUT_DIFFICULTY_MISMATCH");
  });

  it("rejects page references outside the attached Flashcard PDF packet", () => {
    expect(() =>
      validateGeneratedFlashcards({
        output: {
          ...validOutput(),
          cards: [{ ...validOutput().cards[0], sourcePacketPageNumbers: [3] }],
        },
        requestedCount: 1,
        packetPageCount: 2,
        difficulty: Difficulty.EASY,
        difficultyCounts: null,
      }),
    ).toThrow("AI_OUTPUT_SOURCE_INVALID");
  });

  it("rejects duplicate fronts inside one generated batch", () => {
    const first = validOutput().cards[0];
    expect(() =>
      validateGeneratedFlashcards({
        output: {
          title: "Mệnh đề",
          cards: [first, { ...first, front: "Mệnh đề là gì?" }],
        },
        requestedCount: 2,
        packetPageCount: 2,
        difficulty: Difficulty.EASY,
        difficultyCounts: null,
      }),
    ).toThrow("AI_OUTPUT_FLASHCARD_DUPLICATE");
  });

  it("renders Flashcard solution with the same paragraph and math structure as Quiz", () => {
    const document = toFlashcardSolutionTiptap(
      [
        "Theo định lý, ta có:",
        "",
        "$$\\begin{aligned}a+b&=c\\\\b&=c-a.\\end{aligned}$$",
        "",
        "**Vậy** đại lượng cần tìm là $b$.",
      ].join("\n"),
    );

    expect(document.content).toEqual([
      expect.objectContaining({ type: "paragraph" }),
      expect.objectContaining({
        type: "blockMath",
        attrs: expect.objectContaining({ latex: expect.stringContaining("aligned") }),
      }),
      expect.objectContaining({
        type: "paragraph",
        content: expect.arrayContaining([
          expect.objectContaining({ marks: [{ type: "bold" }], text: "Vậy" }),
          expect.objectContaining({ type: "inlineMath", attrs: { latex: "b" } }),
        ]),
      }),
    ]);
  });

  it("keeps Flashcard out of the shared Test generation implementation", () => {
    const sharedWorker = readFileSync(
      resolve(process.cwd(), "src/workers/services/lesson-content-generation.service.ts"),
      "utf8",
    );
    const sharedTypes = readFileSync(
      resolve(process.cwd(), "src/modules/ai/types/lesson-content-generation.types.ts"),
      "utf8",
    );
    const flashcardWorker = readFileSync(
      resolve(process.cwd(), "src/workers/services/flashcard-generation.service.ts"),
      "utf8",
    );

    expect(sharedWorker).not.toContain("generateFlashcards");
    expect(sharedWorker).not.toContain("persistFlashcards");
    expect(sharedTypes).not.toContain("generatedFlashcardOutputSchema");
    expect(flashcardWorker).toContain("class FlashcardGenerationService");
  });

  it("uses one solution-only figure builder for regenerate and edit-current", () => {
    const context = {
      flashcardId: "00000000-0000-4000-8000-000000000006",
      front: "Định lý Viète phát biểu thế nào?",
      solution: "SOLUTION_SECRET: Áp dụng cho phương trình bậc hai có hai nghiệm.",
      currentSolutionLatexSource:
        "\\begin{tikzpicture}\\draw (0,0)--(1,1);\\end{tikzpicture}",
      sourcePacketPageNumbers: [2],
      targetGrade: 9,
      subject: { key: "MATH" as const, name: "Toán", slug: "toan" },
    };
    const regenerated = buildFlashcardFigureStructuredInput({
      context,
    });
    const edited = buildFlashcardFigureStructuredInput({
      context,
      mode: "EDIT_CURRENT",
    });

    expect(regenerated.userPrompt).toContain('"role":"SOLUTION"');
    expect(regenerated.userPrompt).toContain("SOLUTION_SECRET");
    expect(regenerated.userPrompt).not.toContain("currentSolutionLatexSource");
    expect(edited.userPrompt).toContain("currentSolutionLatexSource");
    expect(edited.systemPrompt).toContain("aiMode=EDIT_CURRENT");
    expect(edited.systemPrompt).toContain("currentSolutionLatexSource");
    expect(regenerated.outputName).toBe("solution_figure");
    expect(regenerated.promptCache?.namespace).toBe("solution-figure");
    expect(FLASHCARD_FIGURE_SCHEMA_VERSION).toBe("solution-figure-schema-v1");

    const processor = readFileSync(
      resolve(
        process.cwd(),
        "src/workers/processors/flashcard-figure-rendering.processor.ts",
      ),
      "utf8",
    );
    expect(processor).toContain("buildFlashcardFigureStructuredInput");
    expect(processor).toContain("FLASHCARD_SOLUTION_FIGURE_GENERATION");
    expect(processor).not.toContain("FLASHCARD_FRONT_FIGURE_GENERATION");
    expect(processor).not.toContain("FLASHCARD_BACK_FIGURE_GENERATION");
  });

  it("resolves the shared solution-figure prompt for every Flashcard subject", () => {
    const subjects = [
      { key: "MATH" as const, name: "Toán", slug: "toan", marker: "Đồ thị/hệ trục" },
      { key: "PHYSICS" as const, name: "Vật lý", slug: "vat-ly", marker: "mạch điện" },
      {
        key: "CHEMISTRY" as const,
        name: "Hóa học",
        slug: "hoa-hoc",
        marker: "sơ đồ phản ứng",
      },
      {
        key: "GENERAL" as const,
        name: "Lịch sử",
        slug: "lich-su",
        marker: "chuỗi thời gian",
      },
    ];

    for (const subject of subjects) {
      const request = buildFlashcardFigureStructuredInput({
        context: {
          flashcardId: "00000000-0000-4000-8000-000000000006",
          front: "Câu hỏi cần minh họa là gì?",
          solution: "Lời giải dùng một quan hệ trực quan cụ thể.",
          sourcePacketPageNumbers: [1],
          targetGrade: 9,
          subject,
        },
      });
      expect(request.systemPrompt).toContain(subject.marker);
      expect(request.systemPrompt).toContain("solution là nguồn có độ ưu tiên cao nhất");
      expect(request.systemPrompt).not.toContain("Tạo ảnh cho mặt trước");
      expect(request.systemPrompt).not.toContain("Tạo ảnh cho mặt sau");
      expect(request.promptVersion).toContain(subject.key.toLowerCase());
      expect(request.promptVersion).toContain("v1-shared");
    }
  });

  it("uses the exact same solution-figure core as Quiz for equivalent content", () => {
    const subject = { key: "MATH" as const, name: "Toán", slug: "toan" };
    const flashcard = buildFlashcardFigureStructuredInput({
      context: {
        flashcardId: "00000000-0000-4000-8000-000000000006",
        front: "Cho tam giác ABC vuông tại A.",
        solution: "Dựng AH vuông góc BC rồi áp dụng hệ thức lượng.",
        sourcePacketPageNumbers: [1],
        targetGrade: 9,
        subject,
      },
    });
    const quiz = buildSolutionFigureInput({
      subject,
      targetGrade: 9,
      plan: {
        version: 2,
        role: "SOLUTION",
        problem: "Cho tam giác ABC vuông tại A.",
        solution: "Dựng AH vuông góc BC rồi áp dụng hệ thức lượng.",
      },
    });

    expect(flashcard).toEqual(quiz);
  });
});
