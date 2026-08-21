import { createHash } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import type { EnvConfig } from "#api/config/env.validation";
import { Difficulty, QuestionType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  generatedQuizOutputSchema,
  generatedTestOutputSchema,
  getGeneratedQuizOutputSchema,
  getGeneratedTestOutputSchema,
} from "#api/modules/ai/types/lesson-content-generation.types";
import {
  getLessonSummaryProviderTransportOutputSchema,
  LESSON_SUMMARY_FUNCTIONAL_PUNCTUATION_AND_MATH_LAYOUT_INSTRUCTION,
  LESSON_SUMMARY_SUBPART_LINEBREAK_INSTRUCTION,
  lessonSummaryOutputSchema,
  lessonSummaryProviderTransportOutputSchema,
  resolveLessonSummaryOutputTokenFloor,
  stemFigurePlanDraftSchema,
  stemFigureProviderPlanDraftSchema,
  stemFigureRenderPlanSchema,
} from "#api/modules/ai/types/lesson-summary.types";
import {
  findMissingRequiredLessonSummaryFigures,
  resolveLessonSummaryFigureRequirement,
} from "#api/modules/ai/utils/lesson-summary-figure-requirement";
import { mapLessonSummaryProviderOutput } from "#api/modules/ai/utils/lesson-summary-mapper";
import {
  applyLessonSummaryPhaseOneBlockEdits,
  prepareLessonSummaryPhaseOneLayoutEdits,
} from "#api/modules/ai/utils/lesson-summary-phase-one-editor";
import {
  buildLessonSummaryStructuredInput,
  LESSON_SUMMARY_LEARNER_FACING_IMAGE_INDEPENDENCE_INSTRUCTION,
} from "#api/modules/ai/utils/lesson-summary-prompt";
import { buildAiStructuredTextFormat } from "#api/modules/ai/utils/ai-structured-output-format";
import {
  buildOpenAiResponseInput,
  buildOpenAiStructuredResponseRequest,
  OPENAI_PREVIEW_BINARY_DATA,
  OPENAI_PREVIEW_FILE_ID,
} from "#api/modules/ai/utils/openai-response-request";
import { resolveCourseSubject } from "#api/modules/ai/utils/lesson-summary-subject";
import { reconcileLessonSummaryReviewIssues } from "#api/modules/learning-paths/utils/lesson-summary-review";
import {
  buildFlashcardPrompt,
  buildLessonContentSystemPrompt,
  buildQuizStructuredInput,
  buildTestPrompt,
} from "#api/modules/ai/utils/lesson-content-generation-prompt";
import { StemFigureRepairService } from "#api/modules/stem-figures/services/stem-figure-repair.service";
import {
  FigureReferenceResolverService,
  selectReferenceImages,
  type FigureReferenceSnapshot,
  type OcrImageShape,
} from "#api/modules/stem-figures/services/figure-reference-resolver.service";
import { SvgValidatorService } from "#api/modules/stem-figures/services/svg-validator.service";
import { preserveHistoricalExactReferenceAssets } from "#api/modules/stem-figures/services/stem-figures.service";
import {
  stemFigureGenerationBriefSchema,
  type StemFigureGenerationBrief,
} from "#api/modules/stem-figures/types/stem-figure-generation.types";
import { createStemFigureDiagnosticBatch } from "#api/modules/stem-figures/utils/stem-figure-diagnostics";
import {
  buildStemFigureGenerationBrief,
  projectStemFigureBlock,
  stemFigureLessonContextSchema,
} from "#api/modules/stem-figures/utils/stem-figure-generation-brief";
import { validateTexSourcePolicy } from "#api/modules/stem-figures/utils/tex-source-policy";
import {
  ensureStemFigureSummaryReference,
  readStemFigureOrigin,
} from "#api/modules/stem-figures/utils/stem-figure-summary-reference";

const lessonId = "00000000-0000-4000-8000-000000000001";
const chunkId = "00000000-0000-4000-8000-000000000002";
const testPacket = {
  filename: "lesson-source-packet.pdf",
  bytes: Buffer.from("%PDF-test"),
  modelManifest: {
    version: 1 as const,
    pages: [
      {
        packetPageNumber: 1,
        sourceKey: "source-1",
        documentTitle: "Tài liệu kiểm thử",
        sourcePdfPageNumber: 1,
        printedPageLabel: "1",
      },
    ],
  },
};
const validLatex = String.raw`\begin{tikzpicture}
  \draw (0,0) -- (2,0) -- (0,1.5) -- cycle;
\end{tikzpicture}`;
const validGemStyleFragment = String.raw`\usetikzlibrary{calc,angles,quotes}
\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \coordinate (B) at (2,0);
  \draw ($(A)!0.5!(B)$) circle (2pt);
\end{tikzpicture}`;

function collectPropertyDescriptions(value: unknown, propertyName: string): string[] {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const descriptions: string[] = [];
  const properties = record.properties;
  if (properties && typeof properties === "object") {
    const property = (properties as Record<string, unknown>)[propertyName];
    if (property && typeof property === "object") {
      const description = (property as Record<string, unknown>).description;
      if (typeof description === "string") descriptions.push(description);
    }
  }
  for (const nested of Object.values(record)) {
    descriptions.push(...collectPropertyDescriptions(nested, propertyName));
  }
  return descriptions;
}

function figureBrief(
  input: {
    blockContent?: Record<string, unknown>;
    blockPath?: string;
  } & Record<string, unknown>,
): StemFigureGenerationBrief {
  return {
    figurePlanContractVersion: 3,
    figureOrigin: "GENERATED_FROM_BRIEF",
    targetGrade: 12,
    blockPath: input.blockPath ?? "sections.0.blocks.0",
    blockContent: projectStemFigureBlock(input.blockContent ?? {}),
    sourceReferences: [],
    referenceAssets: [],
  };
}

describe("M9.2 TeX/TikZ Summary contract", () => {
  it("allows exactly one textbook/current reference or no reference image", () => {
    for (const referenceImageMode of [
      "SOURCE_CROP_ONLY",
      "CURRENT_ONLY",
      "NONE",
    ] as const) {
      expect(
        stemFigureGenerationBriefSchema.safeParse({
          ...figureBrief({ blockContent: {} }),
          referenceImageMode,
        }).success,
      ).toBe(true);
    }
    expect(
      stemFigureGenerationBriefSchema.safeParse({
        ...figureBrief({ blockContent: {} }),
        referenceImageMode: "CURRENT_AND_SOURCE_CROP",
      }).success,
    ).toBe(false);
  });

  it("accepts only figure plan v3 and rejects old contracts", () => {
    const v3Plan = {
      figurePlanContractVersion: 3,
      figureOrigin: "TEXTBOOK_SOURCE" as const,
      altText: "Khối tròn xoay và mặt cắt vuông góc trục.",
      caption: null,
      sourceReferences: [
        {
          packetPageNumber: 6,
          printedPageLabel: "24",
          figureLabel: "Hình 4.25",
          sourceTarget: { scope: "WHOLE_FIGURE" as const, locator: null },
        },
      ],
      localId: "F025",
    };

    expect(stemFigureRenderPlanSchema.safeParse(v3Plan).success).toBe(true);
    expect(stemFigurePlanDraftSchema.safeParse(v3Plan).success).toBe(true);
    expect(
      stemFigureRenderPlanSchema.safeParse({
        ...v3Plan,
        figurePlanContractVersion: 1,
      }).success,
    ).toBe(false);
    expect(
      stemFigureRenderPlanSchema.safeParse({
        ...v3Plan,
        figurePlanContractVersion: 2,
      }).success,
    ).toBe(false);
    expect(
      stemFigureRenderPlanSchema.safeParse({
        ...v3Plan,
        visualIntent: "Field cũ phải bị strict reject.",
      }).success,
    ).toBe(false);
    expect(
      stemFigureRenderPlanSchema.safeParse({
        ...v3Plan,
        localId: "F25",
      }).success,
    ).toBe(false);
  });

  it("keeps source locators structured without a semantic figure field", () => {
    const plan = {
      figureOrigin: "TEXTBOOK_SOURCE" as const,
      caption: "Các vectơ cùng phương trong hình hộp.",
      sourceReferences: [
        {
          packetPageNumber: 2,
          printedPageLabel: "43",
          figureLabel: "Hình 5.26",
          sourceTarget: {
            scope: "SUBFIGURE" as const,
            locator: "hình bên phải, có các đỉnh A, B, C, D",
          },
        },
      ],
    };

    expect(stemFigureProviderPlanDraftSchema.safeParse(plan).success).toBe(true);
    expect(
      stemFigureProviderPlanDraftSchema.safeParse({
        ...plan,
        altText: "OpenAI không được trả field này ở Phase 1.",
      }).success,
    ).toBe(false);
  });

  it("validates whole-figure and subfigure source targets", () => {
    const basePlan = {
      figureOrigin: "TEXTBOOK_SOURCE" as const,
      caption: null,
      sourceReferences: [
        {
          packetPageNumber: 1,
          printedPageLabel: null,
          figureLabel: null,
          sourceTarget: { scope: "WHOLE_FIGURE" as const, locator: null },
        },
      ],
    };

    expect(stemFigureProviderPlanDraftSchema.safeParse(basePlan).success).toBe(true);
    expect(
      stemFigureProviderPlanDraftSchema.safeParse({
        ...basePlan,
        sourceReferences: [
          {
            ...basePlan.sourceReferences[0],
            sourceTarget: { scope: "WHOLE_FIGURE", locator: "hình bên trái" },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      stemFigureProviderPlanDraftSchema.safeParse({
        ...basePlan,
        sourceReferences: [
          {
            ...basePlan.sourceReferences[0],
            sourceTarget: { scope: "SUBFIGURE", locator: null },
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects removed routing metadata from the figure contracts", () => {
    const plan = {
      figurePlanContractVersion: 3,
      figureOrigin: "TEXTBOOK_SOURCE" as const,
      altText: "Tam giác ABC theo hình nguồn",
      caption: null,
      sourceReferences: [
        {
          packetPageNumber: 1,
          printedPageLabel: "41",
          figureLabel: "Hình 5.23",
          sourceTarget: { scope: "WHOLE_FIGURE", locator: null },
        },
      ],
      localId: "F001",
    };

    expect(stemFigurePlanDraftSchema.safeParse(plan).success).toBe(true);
    expect(
      stemFigurePlanDraftSchema.safeParse({
        ...plan,
        kind: "GEOMETRY_2D",
      }).success,
    ).toBe(false);
    expect(
      stemFigurePlanDraftSchema.safeParse({
        ...plan,
        sourceReferences: [
          {
            ...plan.sourceReferences[0],
            referenceRole: "PRIMARY_LAYOUT",
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      stemFigureGenerationBriefSchema.safeParse({
        ...figureBrief({ blockContent: {} }),
        figureKind: "GEOMETRY_2D",
      }).success,
    ).toBe(false);
  });

  it("reads the local block context from summaries using a legacy block type", () => {
    const storedSummary = {
      lessonId,
      title: "Ứng dụng hình học của tích phân",
      targetGrade: 12,
      objectives: ["Vận dụng tích phân."],
      sections: [
        {
          order: 1,
          displayHeading: "Thể tích vật thể",
          sourceEvidence: {
            kind: "CONTENT",
            text: "Phương pháp mặt cắt.",
            packetPageNumbers: [6],
          },
          blocks: [
            {
              type: "procedure",
              title: "Các bước tính",
              steps: ["Chọn trục", "Lập diện tích mặt cắt"],
            },
          ],
        },
      ],
    };

    expect(stemFigureLessonContextSchema.safeParse(storedSummary).success).toBe(true);
    expect(lessonSummaryOutputSchema.safeParse(storedSummary).success).toBe(false);
  });

  it("reattaches a completed figure to the exact block without duplicating it", () => {
    const content = {
      type: "lesson_summary_blocks",
      data: {
        sections: [{ blocks: [{ type: "knowledge", figures: [] }] }],
      },
    };
    const input = {
      blockPath: "sections.0.blocks.0",
      figureIndex: 0,
      figureId: "figure-1",
      figureOrigin: "GENERATED_FROM_BRIEF" as const,
      altText: "Hình kiểm thử",
      caption: null,
    };
    const attached = ensureStemFigureSummaryReference(content, input);
    const attachedAgain = ensureStemFigureSummaryReference(attached, input);
    expect(attachedAgain).toMatchObject({
      data: {
        sections: [
          {
            blocks: [
              {
                figures: [
                  {
                    kind: "TEX_FIGURE",
                    figureId: "figure-1",
                    figureOrigin: "GENERATED_FROM_BRIEF",
                    status: "SUCCEEDED",
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    expect(JSON.stringify(attachedAgain).match(/figure-1/gu)).toHaveLength(1);
  });

  it("selects the crop whose caption exactly matches the requested figure identifier", () => {
    const selection = selectReferenceImages({
      images: [
        referenceImage({
          imageId: "wrong-5-25",
          captionCandidate: "Hình 5.25",
          nearbyText:
            "Vectơ chỉ phương đường thẳng đi qua A, M và hệ trục Oxyz Hình 5.26",
        }),
        referenceImage({
          imageId: "correct-5-26",
          captionCandidate: "Hình 5.26",
          nearbyText: "Đường thẳng trong không gian",
        }),
      ],
      pageNumber: 43,
      figureLabel: "Hình 5.26",
      query: "Hình 5.26 vectơ chỉ phương đường thẳng đi qua A và M",
    });

    expect(selection.images.map((image) => image.imageId)).toEqual(["correct-5-26"]);
    expect(selection.ambiguous).toBe(false);
  });

  it.each([
    ["HÌNH 5 . 26", "Hình 5.26"],
    ["Figure 5-26", "Fig. 5.26"],
    ["Hình 5.26 a", "Hình 5.26a"],
  ])("normalizes OCR spacing and figure-label variants: %s", (requested, caption) => {
    const selection = selectReferenceImages({
      images: [referenceImage({ imageId: "matching", captionCandidate: caption })],
      pageNumber: 43,
      figureLabel: requested,
      query: requested,
    });

    expect(selection.images.map((image) => image.imageId)).toEqual(["matching"]);
  });

  it("keeps complementary exact-caption crops when one textbook figure has panels", () => {
    const selection = selectReferenceImages({
      images: [
        referenceImage({
          imageId: "subcrop-a",
          pageNumber: 20,
          captionCandidate: "Hình 7.12a",
        }),
        referenceImage({
          imageId: "subcrop-b",
          pageNumber: 20,
          captionCandidate: "Hình 7.12a",
        }),
        referenceImage({
          imageId: "neighbour",
          pageNumber: 20,
          captionCandidate: "Hình 7.12b",
        }),
      ],
      pageNumber: 20,
      figureLabel: "Hình 7.12a",
      query: "Hình 7.12a",
    });

    expect(selection.images.map((image) => image.imageId)).toEqual([
      "subcrop-a",
      "subcrop-b",
    ]);
    expect(selection.ambiguous).toBe(false);
    expect(selection.warnings).toContain("figure_label_exact_match_multiple_crops");
  });

  it("refuses a neighbouring crop and requests page fallback when a formal label is not matched", () => {
    const selection = selectReferenceImages({
      images: [
        referenceImage({
          imageId: "wrong-5-25",
          captionCandidate: "Hình 5.25",
          nearbyText: "Hình 5.26 vectơ chỉ phương",
        }),
        referenceImage({
          imageId: "uncaptioned",
          captionCandidate: null,
          nearbyText: "Vectơ chỉ phương",
        }),
      ],
      pageNumber: 43,
      figureLabel: "Hình 5.26",
      query: "Hình 5.26 vectơ chỉ phương",
    });

    expect(selection.images).toEqual([]);
    expect(selection.warnings).toContain("figure_label_not_matched_using_page_fallback");
  });

  it("does not confuse a parent figure identity with a labelled subfigure", () => {
    const selection = selectReferenceImages({
      images: [
        referenceImage({
          imageId: "subfigure-4-16-a",
          captionCandidate: "Hình 4.16a",
        }),
      ],
      pageNumber: 43,
      figureLabel: "Hình 4.16",
      query: "Hình 4.16",
    });

    expect(selection.images).toEqual([]);
    expect(selection.warnings).toContain("figure_label_not_matched_using_page_fallback");
  });

  it("requests the full PDF page when the block has no concrete figure label", () => {
    const selection = selectReferenceImages({
      images: [
        referenceImage({
          imageId: "generic-page-crop",
          captionCandidate: null,
          nearbyText: "Vectơ chỉ phương của đường thẳng",
        }),
      ],
      pageNumber: 43,
      figureLabel: null,
      query: "Vectơ chỉ phương của đường thẳng",
    });

    expect(selection.images).toEqual([]);
    expect(selection.ambiguous).toBe(false);
    expect(selection.warnings).toContain("figure_label_missing_using_page_fallback");
  });

  it("sends the immutable Mathpix crop without rebuilding it from the PDF page", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "lesson-document-1",
        file: {
          id: "source-file-1",
          objectKey: "documents/source.pdf",
          checksum: "source-checksum",
        },
        activeOcrArtifact: {
          id: "ocr-artifact-1",
          imageManifestObjectKey: "ocr/image-manifest.json",
        },
        sourceDocument: null,
      },
    ]);
    const downloadObject = vi.fn().mockResolvedValue(
      Buffer.from(
        JSON.stringify({
          images: [
            {
              imageId: "figure-5-24",
              pageNumber: 42,
              objectKey: "document-images/page-42/figure-5-24.jpg",
              mimeType: "image/jpeg",
              captionCandidate: "Hình 5.24",
              nearbyText: "Hình hộp",
              isUsableForAi: true,
            },
          ],
        }),
      ),
    );
    const headObject = vi.fn();
    const uploadObject = vi.fn();
    const resolver = new FigureReferenceResolverService(
      { lessonDocument: { findMany } } as never,
      { downloadObject, headObject, uploadObject } as never,
    );

    const result = await resolver.resolve({
      manifest: {
        version: 1,
        lessonId,
        packetHash: "packet-hash",
        pageCount: 1,
        pages: [
          {
            packetPageNumber: 1,
            sourceKey: "source-1",
            lessonDocumentId: "lesson-document-1",
            sourceDocumentId: "source-document-1",
            sourceFileId: "source-file-1",
            sourcePdfPageNumber: 42,
            printedPageLabel: "41",
            pageRangeId: null,
            documentTitle: "Toán 12",
            segmentOrder: 0,
          },
        ],
      },
      plan: stemFigureRenderPlanSchema.parse({
        figurePlanContractVersion: 3,
        figureOrigin: "TEXTBOOK_SOURCE",
        localId: "F001",
        sourceReferences: [
          {
            packetPageNumber: 1,
            printedPageLabel: "41",
            figureLabel: "Hình 5.24",
            sourceTarget: { scope: "WHOLE_FIGURE", locator: null },
          },
        ],
      }),
    });

    expect(result.status).toBe("resolved");
    expect(result.assets).toEqual([
      expect.objectContaining({
        objectKey: "document-images/page-42/figure-5-24.jpg",
        mimeType: "image/jpeg",
        source: "OCR_CROP",
      }),
    ]);
    expect(downloadObject).toHaveBeenCalledOnce();
    expect(downloadObject).toHaveBeenCalledWith("ocr/image-manifest.json");
    expect(headObject).not.toHaveBeenCalled();
    expect(uploadObject).not.toHaveBeenCalled();
  });

  it("relocates an exact figure label to its unique canonical packet page", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "lesson-document-1",
        file: {
          id: "source-file-1",
          objectKey: "documents/source.pdf",
          checksum: "source-checksum",
        },
        activeOcrArtifact: {
          id: "ocr-artifact-1",
          imageManifestObjectKey: "ocr/image-manifest.json",
        },
        sourceDocument: null,
      },
    ]);
    const downloadObject = vi.fn().mockResolvedValue(
      Buffer.from(
        JSON.stringify({
          images: [
            {
              imageId: "figure-4-16",
              pageNumber: 21,
              objectKey: "document-images/page-21/figure-4-16.jpg",
              mimeType: "image/jpeg",
              captionCandidate: "Hinh 4.16",
              nearbyText: "Miền phẳng giới hạn bởi hai đồ thị",
              isUsableForAi: true,
            },
            {
              imageId: "figure-4-17",
              pageNumber: 22,
              objectKey: "document-images/page-22/figure-4-17.jpg",
              mimeType: "image/jpeg",
              captionCandidate: "Hình 4.17",
              nearbyText: "Hai parabol",
              isUsableForAi: true,
            },
          ],
        }),
      ),
    );
    const headObject = vi.fn();
    const resolver = new FigureReferenceResolverService(
      { lessonDocument: { findMany } } as never,
      { downloadObject, headObject, uploadObject: vi.fn() } as never,
    );
    const manifest = {
      version: 1 as const,
      lessonId,
      packetHash: "packet-hash",
      pageCount: 3,
      pages: [
        packetManifestPage(1, 20, "19"),
        packetManifestPage(2, 21, "20"),
        packetManifestPage(3, 22, "21"),
      ],
    };
    const requestedPlan = stemFigureRenderPlanSchema.parse({
      figurePlanContractVersion: 3,
      figureOrigin: "TEXTBOOK_SOURCE",
      localId: "F001",
      sourceReferences: [
        {
          packetPageNumber: 3,
          printedPageLabel: "21",
          figureLabel: "Hình 4.16",
          sourceTarget: { scope: "WHOLE_FIGURE", locator: null },
        },
      ],
    });
    const corroboratedPlan = stemFigureRenderPlanSchema.parse({
      figurePlanContractVersion: 3,
      figureOrigin: "TEXTBOOK_SOURCE",
      localId: "F002",
      sourceReferences: [
        {
          packetPageNumber: 3,
          printedPageLabel: "wrong-provider-label",
          figureLabel: "Hình 4.17",
          sourceTarget: { scope: "WHOLE_FIGURE", locator: null },
        },
      ],
    });

    const [relocated, corroborated] = await resolver.resolveMany({
      manifest,
      plans: [requestedPlan, corroboratedPlan],
    });

    expect(relocated?.plan.sourceReferences[0]).toMatchObject({
      packetPageNumber: 2,
      printedPageLabel: "20",
      figureLabel: "Hình 4.16",
    });
    expect(relocated?.snapshot).toMatchObject({
      status: "resolved",
      assets: [
        {
          objectKey: "document-images/page-21/figure-4-16.jpg",
          packetPageNumber: 2,
          source: "OCR_CROP",
        },
      ],
      references: [
        {
          sourcePdfPageNumber: 21,
          requestedPlanReference: {
            packetPageNumber: 3,
            printedPageLabel: "21",
          },
          warnings: [
            "figure_label_exact_match_relocated",
            "printed_page_label_canonicalized",
          ],
        },
      ],
    });
    expect(corroborated?.plan.sourceReferences[0]).toMatchObject({
      packetPageNumber: 3,
      printedPageLabel: "21",
    });
    expect(corroborated?.snapshot.references[0]?.warnings).toContain(
      "printed_page_label_canonicalized",
    );
    expect(downloadObject).toHaveBeenCalledOnce();
    expect(headObject).not.toHaveBeenCalled();
  });

  it("keeps duplicate exact-label pages ambiguous instead of choosing one", async () => {
    const resolver = packetResolverWithImages([
      referenceImage({
        imageId: "figure-copy-page-21",
        pageNumber: 21,
        captionCandidate: "Hình 4.16",
      }),
      referenceImage({
        imageId: "figure-copy-page-22",
        pageNumber: 22,
        captionCandidate: "Hình 4.16",
      }),
    ]);
    const requestedPlan = stemFigureRenderPlanSchema.parse({
      figurePlanContractVersion: 3,
      figureOrigin: "TEXTBOOK_SOURCE",
      localId: "F001",
      sourceReferences: [
        {
          packetPageNumber: 1,
          printedPageLabel: "19",
          figureLabel: "Hình 4.16",
          sourceTarget: { scope: "WHOLE_FIGURE", locator: null },
        },
      ],
    });

    const [result] = await resolver.resolveMany({
      manifest: {
        version: 1,
        lessonId,
        packetHash: "packet-hash",
        pageCount: 3,
        pages: [
          packetManifestPage(1, 20, "19"),
          packetManifestPage(2, 21, "20"),
          packetManifestPage(3, 22, "21"),
        ],
      },
      plans: [requestedPlan],
    });

    expect(result?.plan).toEqual(requestedPlan);
    expect(result?.snapshot.status).toBe("ambiguous");
    expect(result?.snapshot.assets).toEqual([
      expect.objectContaining({ packetPageNumber: 1, source: "PDF_PAGE" }),
    ]);
    expect(result?.snapshot.references[0]?.warnings).toContain(
      "figure_label_exact_match_multiple_pages",
    );
  });

  it("falls back to the relocated canonical page when the exact crop is unusable", async () => {
    const resolver = packetResolverWithImages([
      referenceImage({
        imageId: "unusable-figure-4-16",
        pageNumber: 21,
        captionCandidate: "Hình 4.16",
        isUsableForAi: false,
      }),
    ]);
    const requestedPlan = stemFigureRenderPlanSchema.parse({
      figurePlanContractVersion: 3,
      figureOrigin: "TEXTBOOK_SOURCE",
      localId: "F001",
      sourceReferences: [
        {
          packetPageNumber: 3,
          printedPageLabel: "21",
          figureLabel: "Hình 4.16",
          sourceTarget: { scope: "WHOLE_FIGURE", locator: null },
        },
      ],
    });

    const [result] = await resolver.resolveMany({
      manifest: {
        version: 1,
        lessonId,
        packetHash: "packet-hash",
        pageCount: 3,
        pages: [
          packetManifestPage(1, 20, "19"),
          packetManifestPage(2, 21, "20"),
          packetManifestPage(3, 22, "21"),
        ],
      },
      plans: [requestedPlan],
    });

    expect(result?.plan.sourceReferences[0]).toMatchObject({
      packetPageNumber: 2,
      printedPageLabel: "20",
    });
    expect(result?.snapshot.status).toBe("page_fallback");
    expect(result?.snapshot.assets).toEqual([
      expect.objectContaining({
        objectKey: "derived/lesson-summary-reference-pages/source-checksum/page-21.png",
        packetPageNumber: 2,
        source: "PDF_PAGE",
      }),
    ]);
    expect(result?.snapshot.references[0]?.warnings).toEqual(
      expect.arrayContaining([
        "figure_label_exact_match_relocated",
        "figure_label_exact_match_unusable",
        "no_usable_ocr_crop",
      ]),
    );
  });

  it("preserves complementary exact-label crops from an immutable historical snapshot", () => {
    const plan = stemFigureRenderPlanSchema.parse({
      figurePlanContractVersion: 3,
      figureOrigin: "TEXTBOOK_SOURCE",
      sourceReferences: [
        {
          packetPageNumber: 6,
          printedPageLabel: "24",
          figureLabel: "Hình 4.25",
          sourceTarget: { scope: "WHOLE_FIGURE", locator: null },
        },
      ],
      localId: "F025",
    });
    const firstPanel = {
      objectKey: "ocr/hinh-4-25-panel-a.png",
      mimeType: "image/png",
      label: "Hình 4.25",
      packetPageNumber: 6,
      source: "OCR_CROP" as const,
    };
    const secondPanel = {
      ...firstPanel,
      objectKey: "ocr/hinh-4-25-panel-b.png",
    };
    const snapshot = (
      assets: FigureReferenceSnapshot["assets"],
    ): FigureReferenceSnapshot => ({
      version: 1,
      localPlanId: "F025",
      status: "resolved",
      assets,
      references: [],
    });

    const merged = preserveHistoricalExactReferenceAssets({
      fresh: snapshot([firstPanel]),
      historical: snapshot([firstPanel, secondPanel]),
      plan,
    });

    expect(merged.assets.map((asset) => asset.objectKey)).toEqual([
      firstPanel.objectKey,
      secondPanel.objectKey,
    ]);
  });

  it("does not preserve guessed historical crops when the plan has no figure label", () => {
    const plan = stemFigureRenderPlanSchema.parse({
      figurePlanContractVersion: 3,
      figureOrigin: "TEXTBOOK_SOURCE",
      sourceReferences: [
        {
          packetPageNumber: 6,
          printedPageLabel: "24",
          figureLabel: null,
          sourceTarget: { scope: "WHOLE_FIGURE", locator: null },
        },
      ],
      localId: "F026",
    });
    const pageFallback: FigureReferenceSnapshot = {
      version: 1,
      localPlanId: "F026",
      status: "page_fallback",
      assets: [
        {
          objectKey: "pages/page-6.png",
          mimeType: "image/png",
          label: "Trang 6",
          packetPageNumber: 6,
          source: "PDF_PAGE",
        },
      ],
      references: [],
    };
    const historical: FigureReferenceSnapshot = {
      ...pageFallback,
      assets: [
        {
          ...pageFallback.assets[0]!,
          objectKey: "ocr/guessed.png",
          source: "OCR_CROP",
        },
      ],
    };

    expect(
      preserveHistoricalExactReferenceAssets({
        fresh: pageFallback,
        historical,
        plan,
      }).assets,
    ).toEqual(pageFallback.assets);
  });

  it("scales the output-token floor with requested lesson length", () => {
    expect(
      resolveLessonSummaryOutputTokenFloor({
        length: "detailed",
        targetWordCount: 3_000,
      }),
    ).toBe(13_000);
    expect(
      resolveLessonSummaryOutputTokenFloor({
        length: "standard",
        targetWordCount: null,
      }),
    ).toBe(8_000);
  });

  it.each([
    "13. Ứng dụng hình học tích phân",
    "Đường tròn ngoại tiếp tam giác",
    "Hình học không gian",
  ])(
    "keeps figure coverage source-contextual for every lesson title: %s",
    (lessonTitle) => {
      expect(
        resolveLessonSummaryFigureRequirement({
          lessonTitle,
          subjectKey: "MATH",
          contextChunks: [{ content: "Nội dung bài học Toán 12." }],
        }),
      ).toBe("CONTEXTUAL");
    },
  );

  it.each([
    "14. Phương trình mặt phẳng",
    "15. Phương trình đường thẳng trong không gian",
    "16. Công thức tính góc trong không gian",
  ])(
    "keeps analytical geometry contextual instead of forcing a calculation figure: %s",
    (lessonTitle) => {
      expect(
        resolveLessonSummaryFigureRequirement({
          lessonTitle,
          subjectKey: "MATH",
          contextChunks: [
            {
              content:
                "Nội dung có hình chóp, hình cầu và hình trụ ở bài tập cuối nhưng phần chính là phép tính tọa độ.",
            },
          ],
        }),
      ).toBe("CONTEXTUAL");
    },
  );

  it("does not force figures for symbolic analytical-geometry formulas", () => {
    const output = buildMathProviderOutput({
      title: "15. Phương trình đường thẳng trong không gian",
      displayHeading: "Phương trình tham số của đường thẳng",
      theoryContent:
        "Đường thẳng đi qua A và có vectơ chỉ phương u có phương trình x=x0+at, y=y0+bt, z=z0+ct.",
      illustrationProblem: "Viết phương trình đường thẳng đi qua A có vectơ u.",
    });

    expect(
      findMissingRequiredLessonSummaryFigures({ output, subjectKey: "MATH" }),
    ).toEqual([]);
  });

  it("does not confuse 'số đối' with the visual term 'sơ đồ'", () => {
    const output = buildMathProviderOutput({
      title: "Cộng, trừ, nhân, chia số hữu tỉ",
      displayHeading: "Tính chất của phép cộng số hữu tỉ",
      theoryContent: "Hai số đối nhau luôn có tổng bằng 0: a + (-a) = 0.",
      illustrationProblem: "Tính tổng của hai số đối nhau.",
    });

    expect(
      findMissingRequiredLessonSummaryFigures({ output, subjectKey: "MATH" }),
    ).toEqual([]);
  });

  it("flags unbalanced LaTeX braces on the exact block field", () => {
    const output = buildMathProviderOutput({
      title: "Cộng, trừ, nhân, chia số hữu tỉ",
      displayHeading: "Bài tập vận dụng",
      theoryContent: "Diện tích hình chữ nhật được tính bằng chiều dài nhân chiều rộng.",
      illustrationProblem: "Tính diện tích hình chữ nhật.",
    });
    const mapped = mapLessonSummaryProviderOutput({
      lessonId,
      output,
      packetPageCount: 1,
      targetGrade: 7,
      subjectKey: "MATH",
    });
    const malformed = {
      ...mapped.content,
      sections: mapped.content.sections.map((section, sectionIndex) => ({
        ...section,
        blocks: section.blocks.map((block, blockIndex) =>
          sectionIndex === 0 && blockIndex === 1 && block.type === "example"
            ? {
                ...block,
                problem: "Hai ảnh có kích thước $10\\text{ cm}\\times15\\text{ cm$.",
              }
            : block,
        ),
      })),
    };

    const reviewed = reconcileLessonSummaryReviewIssues({
      type: "lesson_summary_blocks",
      version: 3,
      data: malformed,
    });
    const issue = (
      reviewed.data as {
        sections: Array<{ blocks: Array<{ reviewIssues?: ReviewIssue[] }> }>;
      }
    ).sections[0]?.blocks[1]?.reviewIssues?.[0];

    expect(issue).toEqual(
      expect.objectContaining({
        code: "MALFORMED_LATEX",
        path: "sections.0.blocks.1.problem",
        resolution: "FIX_ONLY",
        accepted: false,
      }),
    );
  });

  it("keeps the exact Phase 1 provider object for every mapped Summary block", () => {
    const output = buildMathProviderOutput({
      title: "Phương trình đường thẳng",
      displayHeading: "Vectơ chỉ phương",
      theoryContent: "Vectơ chỉ phương song song với đường thẳng.",
      illustrationProblem: "Xác định vectơ chỉ phương.",
    });
    const mapped = mapLessonSummaryProviderOutput({
      lessonId,
      output,
      packetPageCount: 1,
      targetGrade: 12,
      subjectKey: "MATH",
    });
    const unit = output.theorySections[0]?.items[0];
    expect(unit?.itemType).toBe("UNIT");
    if (!unit || unit.itemType !== "UNIT") throw new Error("Expected UNIT fixture.");

    expect(mapped.phaseOneBlocks["sections.0.blocks.0"]).toEqual(unit.theory);
    expect(mapped.phaseOneBlocks["sections.0.blocks.1"]).toEqual(unit.example);
    expect(mapped.phaseOneBlocks["sections.1.blocks.0"]).toEqual(
      output.applicationExercises.standardExercise,
    );
    expect(mapped.phaseOneBlocks["sections.1.blocks.1"]).toEqual(
      output.applicationExercises.realWorldExercise,
    );
  });

  it("validates edited Phase 1 blocks and maps text without generating figures", () => {
    const output = buildMathProviderOutput({
      title: "Phương trình đường thẳng",
      displayHeading: "Vectơ chỉ phương",
      theoryContent: "Nội dung ban đầu.",
      illustrationProblem: "Đề bài ban đầu.",
    });
    const mapped = mapLessonSummaryProviderOutput({
      lessonId,
      output,
      packetPageCount: 1,
      targetGrade: 12,
      subjectKey: "MATH",
    });
    const blocks = structuredClone(mapped.phaseOneBlocks);
    const theory = blocks["sections.0.blocks.0"] as Record<string, unknown>;
    theory.content = "Nội dung đã sửa trên raw JSON.";

    const result = applyLessonSummaryPhaseOneBlockEdits({
      lessonId,
      blocks,
      snapshot: {
        type: "lesson_summary_phase_one_blocks",
        version: 2,
        providerOutput: output,
        blocks: mapped.phaseOneBlocks,
        providerPaths: mapped.phaseOneProviderPaths,
        subjectKey: "MATH",
        targetGrade: 12,
        packetPageCount: 1,
      },
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.message);
    expect(result.mapped.content.sections[0]?.blocks[0]).toMatchObject({
      type: "knowledge",
      content: "Nội dung đã sửa trên raw JSON.",
    });
    expect(result.mapped.figures).toEqual([]);
  });

  it("persists a deleted block instead of rebuilding it from raw Phase 1", () => {
    const output = buildMathProviderOutput({
      title: "Phương trình đường thẳng",
      displayHeading: "Vectơ chỉ phương",
      theoryContent: "Nội dung ban đầu.",
      illustrationProblem: "Đề bài ban đầu.",
      illustrationFigure: {
        caption: null,
      },
    });
    const mapped = mapLessonSummaryProviderOutput({
      lessonId,
      output,
      packetPageCount: 1,
      targetGrade: 12,
      subjectKey: "MATH",
    });
    const prepared = prepareLessonSummaryPhaseOneLayoutEdits(
      {
        type: "lesson_summary_phase_one_blocks",
        version: 2,
        providerOutput: output,
        blocks: mapped.phaseOneBlocks,
        providerPaths: mapped.phaseOneProviderPaths,
        subjectKey: "MATH",
        targetGrade: 12,
        packetPageCount: 1,
      },
      [{ type: "DELETE_BLOCK", sectionIndex: 0, blockIndex: 0 }],
    );

    expect(prepared.success).toBe(true);
    if (!prepared.success) throw new Error(prepared.message);
    expect(prepared.snapshot.blocks["sections.0.blocks.0"]).toMatchObject({
      type: "example",
      problem: "Đề bài ban đầu.",
    });
    expect(Object.keys(prepared.snapshot.blocks)).not.toContain("sections.0.blocks.1");
    expect(prepared.blockPathChanges.get("sections.0.blocks.0")).toBeNull();
    expect(prepared.blockPathChanges.get("sections.0.blocks.1")).toBe(
      "sections.0.blocks.0",
    );

    const result = applyLessonSummaryPhaseOneBlockEdits({
      lessonId,
      blocks: prepared.snapshot.blocks,
      snapshot: prepared.snapshot,
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.message);
    expect(result.mapped.content.sections[0]?.blocks).toHaveLength(1);
    expect(result.mapped.content.sections[0]?.blocks[0]).toMatchObject({
      type: "example",
      problem: "Đề bài ban đầu.",
    });
    expect(result.mapped.figures[0]?.blockPath).toBe("sections.0.blocks.0");
  });

  it("persists a deleted section instead of rebuilding it from raw Phase 1", () => {
    const output = buildMathProviderOutput({
      title: "Phương trình đường thẳng",
      displayHeading: "Vectơ chỉ phương",
      theoryContent: "Nội dung ban đầu.",
      illustrationProblem: "Đề bài ban đầu.",
      illustrationFigure: { caption: null },
    });
    const mapped = mapLessonSummaryProviderOutput({
      lessonId,
      output,
      packetPageCount: 1,
      targetGrade: 12,
      subjectKey: "MATH",
    });
    const prepared = prepareLessonSummaryPhaseOneLayoutEdits(
      {
        type: "lesson_summary_phase_one_blocks",
        version: 2,
        providerOutput: output,
        blocks: mapped.phaseOneBlocks,
        providerPaths: mapped.phaseOneProviderPaths,
        subjectKey: "MATH",
        targetGrade: 12,
        packetPageCount: 1,
      },
      [{ type: "DELETE_SECTION", sectionIndex: 0 }],
    );

    expect(prepared.success).toBe(true);
    if (!prepared.success) throw new Error(prepared.message);
    const deletedSectionPaths = Object.keys(mapped.phaseOneBlocks).filter((path) =>
      path.startsWith("sections.0."),
    );
    const followingSectionPaths = Object.keys(mapped.phaseOneBlocks).filter((path) =>
      path.startsWith("sections.1."),
    );
    expect(deletedSectionPaths).not.toHaveLength(0);
    expect(
      deletedSectionPaths.every((path) => prepared.blockPathChanges.get(path) === null),
    ).toBe(true);
    expect(
      followingSectionPaths.every(
        (path) =>
          prepared.blockPathChanges.get(path) ===
          path.replace("sections.1.", "sections.0."),
      ),
    ).toBe(true);
    expect(Object.keys(prepared.snapshot.blocks)).toHaveLength(
      Object.keys(mapped.phaseOneBlocks).length - deletedSectionPaths.length,
    );

    const result = applyLessonSummaryPhaseOneBlockEdits({
      lessonId,
      blocks: prepared.snapshot.blocks,
      snapshot: prepared.snapshot,
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.message);
    expect(result.mapped.content.sections).toHaveLength(
      mapped.content.sections.length - 1,
    );
    expect(result.mapped.content.sections.map((section) => section.title)).toEqual(
      mapped.content.sections.slice(1).map((section) => section.title),
    );
    expect(result.mapped.content.sections.map((section) => section.order)).toEqual(
      mapped.content.sections.slice(1).map((_, index) => index + 1),
    );
    expect(
      result.mapped.figures.every((figure) =>
        Object.keys(prepared.snapshot.blocks).includes(figure.blockPath),
      ),
    ).toBe(true);
  });

  it("persists heading deletion as a section merge", () => {
    const output = buildMathProviderOutput({
      title: "Phương trình đường thẳng",
      displayHeading: "Vectơ chỉ phương",
      theoryContent: "Nội dung ban đầu.",
      illustrationProblem: "Đề bài ban đầu.",
    });
    const mapped = mapLessonSummaryProviderOutput({
      lessonId,
      output,
      packetPageCount: 1,
      targetGrade: 12,
      subjectKey: "MATH",
    });
    const prepared = prepareLessonSummaryPhaseOneLayoutEdits(
      {
        type: "lesson_summary_phase_one_blocks",
        version: 2,
        providerOutput: output,
        blocks: mapped.phaseOneBlocks,
        providerPaths: mapped.phaseOneProviderPaths,
        subjectKey: "MATH",
        targetGrade: 12,
        packetPageCount: 1,
      },
      [{ type: "MERGE_SECTION", sectionIndex: 1 }],
    );

    expect(prepared.success).toBe(true);
    if (!prepared.success) throw new Error(prepared.message);
    const result = applyLessonSummaryPhaseOneBlockEdits({
      lessonId,
      blocks: prepared.snapshot.blocks,
      snapshot: prepared.snapshot,
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.message);
    expect(result.mapped.content.sections).toHaveLength(1);
    expect(result.mapped.content.sections[0]?.blocks).toHaveLength(4);
    expect(Object.keys(result.snapshot.blocks)).toEqual([
      "sections.0.blocks.0",
      "sections.0.blocks.1",
      "sections.0.blocks.2",
      "sections.0.blocks.3",
    ]);
  });

  it("rejects invalid edited Phase 1 JSON before persistence", () => {
    const output = buildMathProviderOutput({
      title: "Phương trình đường thẳng",
      displayHeading: "Vectơ chỉ phương",
      theoryContent: "Nội dung ban đầu.",
      illustrationProblem: "Đề bài ban đầu.",
    });
    const mapped = mapLessonSummaryProviderOutput({
      lessonId,
      output,
      packetPageCount: 1,
      targetGrade: 12,
      subjectKey: "MATH",
    });
    const blocks = structuredClone(mapped.phaseOneBlocks);
    delete (blocks["sections.0.blocks.0"] as Record<string, unknown>).content;

    const result = applyLessonSummaryPhaseOneBlockEdits({
      lessonId,
      blocks,
      snapshot: {
        type: "lesson_summary_phase_one_blocks",
        version: 2,
        providerOutput: output,
        blocks: mapped.phaseOneBlocks,
        providerPaths: mapped.phaseOneProviderPaths,
        subjectKey: "MATH",
        targetGrade: 12,
        packetPageCount: 1,
      },
    });

    expect(result).toMatchObject({
      success: false,
      code: "LESSON_SUMMARY_PHASE_ONE_SCHEMA_INVALID",
    });
  });

  it("removes a stale schema issue after the current contract accepts the block", () => {
    const output = buildMathProviderOutput({
      title: "Phương trình đường thẳng",
      displayHeading: "Vectơ chỉ phương",
      theoryContent: "Vectơ chỉ phương song song với đường thẳng.",
      illustrationProblem: "Xác định vectơ chỉ phương.",
    });
    const mapped = mapLessonSummaryProviderOutput({
      lessonId,
      output,
      packetPageCount: 1,
      targetGrade: 12,
      subjectKey: "MATH",
    });
    const block = mapped.content.sections[0]?.blocks[0];
    expect(block).toBeDefined();
    const blockWithFigureIntent = {
      ...block,
      figures: [
        {
          kind: "TEX_FIGURE",
          status: "SUCCEEDED",
          altText: "Vectơ chỉ phương.",
          caption: "Vectơ chỉ phương của đường thẳng.",
          figureId: "00000000-0000-4000-8000-000000000004",
          figureOrigin: "GENERATED_FROM_BRIEF",
        },
      ],
    };
    const fingerprint = createHash("sha256")
      .update(JSON.stringify(blockWithFigureIntent))
      .digest("hex");
    const staleIssue = {
      id: "BLOCK_SCHEMA_INVALID-stale",
      code: "BLOCK_SCHEMA_INVALID",
      path: "sections.0.blocks.0",
      message: "Khối có dữ liệu chưa đúng cấu trúc cần thiết.",
      suggestion: "Mở dữ liệu của khối và sửa lại.",
      technicalDetails: "Issue schema cũ không còn áp dụng.",
      fingerprint,
      resolution: "FIX_ONLY" as const,
      accepted: false,
    };
    const reviewed = reconcileLessonSummaryReviewIssues({
      type: "lesson_summary_blocks",
      version: 3,
      data: {
        ...mapped.content,
        sections: mapped.content.sections.map((section, sectionIndex) => ({
          ...section,
          blocks: section.blocks.map((candidate, blockIndex) =>
            sectionIndex === 0 && blockIndex === 0
              ? { ...blockWithFigureIntent, reviewIssues: [staleIssue] }
              : candidate,
          ),
        })),
      },
    });

    expect(
      (
        reviewed.data as {
          sections: Array<{ blocks: Array<{ reviewIssues?: ReviewIssue[] }> }>;
        }
      ).sections[0]?.blocks[0]?.reviewIssues,
    ).toBeUndefined();
  });

  it("requires block-local figure arrays while allowing an empty contextual plan", () => {
    const output = buildMathProviderOutput({
      title: "Ứng dụng hình học của tích phân",
      displayHeading: "Ứng dụng hình học của tích phân",
      theoryContent: "Tính diện tích hình phẳng bằng tích phân.",
      illustrationProblem: "Tính diện tích miền giới hạn bởi hai đồ thị.",
    });

    expect(
      getLessonSummaryProviderTransportOutputSchema("MATH", "CONTEXTUAL").safeParse({
        ...output,
        theorySections: output.theorySections.map((section, sectionIndex) =>
          sectionIndex === 0
            ? {
                ...section,
                items: section.items.map((item, itemIndex) =>
                  itemIndex === 0 && item.itemType === "UNIT"
                    ? { ...item, theory: { ...item.theory, figures: null } }
                    : item,
                ),
              }
            : section,
        ),
      }).success,
    ).toBe(false);
    expect(
      getLessonSummaryProviderTransportOutputSchema("MATH", "CONTEXTUAL").safeParse(
        output,
      ).success,
    ).toBe(true);
  });

  it.each([
    ["toan", "Toán", "MATH"],
    ["toan-hoc", "Toán học", "MATH"],
    ["ly", "Vật lý", "PHYSICS"],
    ["custom", "Vật Lí", "PHYSICS"],
    ["hoa", "Hóa", "CHEMISTRY"],
    ["custom", "Hoá học", "CHEMISTRY"],
    ["sinh-hoc", "Sinh học", "GENERAL"],
  ] as const)("resolves course domain %s/%s to %s", (slug, name, key) => {
    expect(resolveCourseSubject({ domainName: name, domainSlug: slug }).key).toBe(key);
  });

  it("accepts a local light-mode figure brief and maps it to a durable draft", () => {
    const providerOutput = lessonSummaryProviderTransportOutputSchema.parse({
      title: "Tam giác vuông",
      objectives: ["Nhận biết tam giác vuông"],
      theorySections: [
        {
          displayHeading: "Tam giác vuông",
          sourceEvidence: {
            kind: "HEADING",
            text: "Tam giác vuông",
            packetPageNumbers: [1],
          },
          items: [
            {
              itemType: "UNIT",
              theory: {
                type: "knowledge",
                title: "Khái niệm",
                content: "Tam giác vuông có một góc vuông.",
                sourcePageNumbers: [1],
                figures: [],
              },
              example: {
                type: "example",
                exampleKind: "ILLUSTRATION",
                problem: "Cho tam giác ABC vuông tại A.",
                solution: "Ta có góc BAC là góc vuông.",
                answer: "Tam giác ABC vuông tại A.",
                origin: "SOURCE_EXACT",
                sourcePageNumbers: [1],
                isGeometry: false,
                geometryStatement: null,
                figures: [
                  figurePlan({
                    caption: "Tam giác vuông ABC",
                  }),
                ],
              },
            },
          ],
        },
      ],
      applicationExercises: {
        standardExercise: textOnlyExample("STANDARD_EXERCISE"),
        realWorldExercise: textOnlyExample("REAL_WORLD_EXERCISE"),
      },
    });
    const mapped = mapLessonSummaryProviderOutput({
      lessonId,
      output: providerOutput,
      packetPageCount: 1,
      targetGrade: 12,
    });

    expect(mapped.figures).toEqual([
      {
        blockPath: "sections.0.blocks.1",
        figureIndex: 0,
        draft: expect.objectContaining({
          figurePlanContractVersion: 3,
        }),
      },
    ]);
    expect(mapped.content.targetGrade).toBe(12);
    expect(mapped.content.sections[0]?.blocks[1]).not.toHaveProperty("visual");
  });

  it("accepts a Gem-style TikZ fragment without requiring a document preamble", () => {
    expect(validateTexSourcePolicy(validGemStyleFragment, undefined, "MATH")).toEqual([]);
  });

  it("uses a focused Stage 2 prompt when generating from block content", async () => {
    const generateStructured = vi.fn().mockResolvedValue({
      data: { latexSource: validGemStyleFragment },
    });
    const service = new StemFigureRepairService(
      { generateStructured } as never,
      { get: vi.fn() } as never,
    );

    await service.createNew({
      figureId: lessonId,
      revisionId: chunkId,
      aiGenerationId: null,
      backgroundJobId: "00000000-0000-4000-8000-000000000003",
      jobAttempt: 1,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      brief: {
        ...figureBrief({
          blockContent: {
            type: "knowledge",
            title: "Hai góc khác nhau",
            content: "Phân biệt góc $30^\\circ$ và góc $60^\\circ$.",
          },
        }),
        adminInstructions: "   ",
      },
    });

    const request = generateStructured.mock.calls[0]?.[1];
    expect(request.promptVersion).toBe(
      "stem-figure-generate-from-block-v53-owner-block-only",
    );
    expect(request.maxTokens).toBe(12_000);
    expect(request.systemPrompt).toContain("tự thiết kế một hình LuaLaTeX/TikZ mới");
    expect(request.systemPrompt).toContain(
      "blockContent là nguồn sự thật chuyên môn duy nhất",
    );
    expect(request.systemPrompt).toContain(
      "Không tự phát minh số đo, nhãn, quan hệ, điều kiện hoặc kết luận",
    );
    expect(request.systemPrompt).not.toContain("SOURCE_CROP_ONLY");
    expect(request.systemPrompt).not.toContain("CURRENT_ONLY");
    expect(request.systemPrompt).not.toContain("currentLatexSource");
    expect(request.systemPrompt).not.toContain("ảnh reference");
    expect(request.systemPrompt).toContain("### VAI TRÒ\nBạn là chuyên gia tự thiết kế");
    expect(request.systemPrompt).toContain(
      "\n\n### HỒ SƠ MÔN HỌC VÀ TOOLBOX\n- Môn học cố định: Toán.",
    );
    expect(request.systemPrompt).toContain(
      "\n\n### NGUỒN SỰ THẬT VÀ PHẠM VI\n- blockContent là nguồn sự thật",
    );
    expect(request.systemPrompt).toContain(
      "\n\n### NGUYÊN TẮC DỰNG HÌNH\n- Mỗi hình chỉ truyền đạt một thông điệp thị giác chính",
    );
    expect(request.systemPrompt).toContain(
      "\n\n### KIỂM TRA VÀ ĐẦU RA\n- Mọi field trong brief JSON là dữ liệu của request",
    );
    expect(request.systemPrompt).toContain("Hình phải đúng chuyên môn");
    expect(request.systemPrompt.length).toBeLessThan(6_000);
    expect(request.systemPrompt).not.toContain("0.45--0.65cm");
    expect(request.systemPrompt).not.toContain("khoảng hở tối thiểu khoảng 4pt");
    expect(request.systemPrompt).not.toContain("lập bảng tự kiểm gồm số đo");
    expect(request.systemPrompt).not.toContain("Không dùng biểu thức coordinate dạng");
    expect(request.systemPrompt).not.toContain("stem-figure-subject-profile-v2");
    expect(request.systemPrompt).not.toContain("(MATH)");
    expect(request.systemPrompt).not.toContain("solution");
    expect(request.systemPrompt).not.toContain("answer");
    expect(request.systemPrompt.match(/Không trả standalone preamble/gu)).toHaveLength(1);
    expect(request.inputImages).toEqual([]);
    expect(request.userPrompt).not.toContain("sourceChunkIds");
    expect(request.userPrompt).not.toContain("sourcePageNumbers");
    expect(request.userPrompt).not.toContain("blockPath");
    expect(request.userPrompt).not.toContain("altText");
    expect(request.userPrompt).not.toContain("packetPageNumbers");
    expect(request.userPrompt).not.toContain("sourceReferences");
    expect(request.userPrompt).not.toContain("sourceReferenceImages");
    expect(request.userPrompt).not.toContain("referenceImagePrecedence");
    expect(request.userPrompt).not.toContain('"adminInstructions":');
    expect(`${request.systemPrompt}\n${request.userPrompt}`).not.toContain(
      "adminInstructions",
    );
    expect(`${request.systemPrompt}\n${request.userPrompt}`).not.toContain(
      "yêu cầu sửa đổi/bổ sung",
    );
    expect(`${request.systemPrompt}\n${request.userPrompt}`).not.toContain("delta");
    expect(request.userPrompt).not.toContain('"lessonTitle"');
    expect(request.userPrompt).not.toContain('"sectionHeading"');
    expect(request.userPrompt).toContain('"reference":{"mode":"NONE"}');
    expect(request.userPrompt).not.toContain('"images":[]');
    expect(request.systemPrompt).toContain("không ép một template");
    expect(request.userPrompt).not.toContain('"visualConstraints"');
    expect(request.userPrompt).not.toContain('"angleMarkers"');
    expect(request.userPrompt).not.toContain("essentialElements");
  });

  it.each([
    {
      name: "AI-proposed figure without a reference",
      mode: "NONE" as const,
      assets: [
        {
          objectKey: "ignored/source.png",
          mimeType: "image/png",
          label: "Ảnh phải bị bỏ qua",
          packetPageNumber: 1,
          source: "OCR_CROP" as const,
        },
      ],
      inputImages: [
        { imageUrl: "data:image/png;base64,aWdub3JlZA==", detail: "high" as const },
      ],
      expectedReference: { mode: "NONE" },
      expectedInputImageCount: 0,
      adminInstructions: null,
      currentLatexSource: null,
    },
    {
      name: "one textbook target with current TikZ source",
      mode: "CURRENT_ONLY" as const,
      assets: [
        {
          objectKey: "source/current-target.png",
          mimeType: "image/png",
          label: "Hình 1.2",
          packetPageNumber: 2,
          source: "OCR_CROP" as const,
        },
      ],
      inputImages: [
        { imageUrl: "data:image/png;base64,PHN2Zy8+", detail: "high" as const },
      ],
      expectedReference: {
        mode: "CURRENT_ONLY",
        images: [{ label: "Hình 1.2", source: "OCR_CROP" }],
      },
      expectedInputImageCount: 1,
      adminInstructions: "Giữ bố cục, làm nhãn rõ hơn.",
      currentLatexSource: validGemStyleFragment,
    },
    {
      name: "one exact textbook crop",
      mode: "SOURCE_CROP_ONLY" as const,
      assets: [
        {
          objectKey: "source/hinh-1.png",
          mimeType: "image/png",
          label: "Hình 1",
          packetPageNumber: 2,
          source: "OCR_CROP" as const,
        },
      ],
      inputImages: [
        { imageUrl: "data:image/png;base64,c291cmNl", detail: "original" as const },
      ],
      expectedReference: {
        mode: "SOURCE_CROP_ONLY",
        images: [{ label: "Hình 1", source: "OCR_CROP" }],
      },
      expectedInputImageCount: 1,
      adminInstructions: null,
      currentLatexSource: null,
    },
    {
      name: "four complementary textbook panels",
      mode: "SOURCE_CROP_ONLY" as const,
      assets: Array.from({ length: 4 }, (_, index) => ({
        objectKey: `source/hinh-2-panel-${index + 1}.png`,
        mimeType: "image/png",
        label: "Hình 2",
        packetPageNumber: 3,
        source: "OCR_CROP" as const,
      })),
      inputImages: Array.from({ length: 4 }, (_, index) => ({
        imageUrl: `data:image/png;base64,cGFuZWwt${index + 1}`,
        detail: "high" as const,
      })),
      expectedReference: {
        mode: "SOURCE_CROP_ONLY",
        images: Array.from({ length: 4 }, () => ({
          label: "Hình 2",
          source: "OCR_CROP",
        })),
        panelPolicy: "PRESERVE_EACH_REFERENCE_IMAGE_AS_DISTINCT_PANEL_IN_ORDER",
      },
      expectedInputImageCount: 4,
      adminInstructions: null,
      currentLatexSource: null,
    },
    {
      name: "full textbook page fallback",
      mode: "SOURCE_CROP_ONLY" as const,
      assets: [
        {
          objectKey: "derived/page-4.png",
          mimeType: "image/png",
          label: "Trang 4",
          packetPageNumber: 4,
          source: "PDF_PAGE" as const,
        },
      ],
      inputImages: [
        { imageUrl: "data:image/png;base64,cGFnZQ==", detail: "high" as const },
      ],
      expectedReference: {
        mode: "SOURCE_CROP_ONLY",
        images: [{ label: "Trang 4", source: "PDF_PAGE" }],
      },
      expectedInputImageCount: 1,
      adminInstructions: null,
      currentLatexSource: null,
    },
  ])(
    "builds the complete minimal Phase 2 provider payload: $name",
    async ({
      mode,
      assets,
      inputImages,
      expectedReference,
      expectedInputImageCount,
      adminInstructions,
      currentLatexSource,
    }) => {
      const generateStructured = vi.fn().mockResolvedValue({
        data: { latexSource: validGemStyleFragment },
      });
      const service = new StemFigureRepairService(
        { generateStructured } as never,
        { get: vi.fn() } as never,
      );
      const brief = figureBrief({
        blockContent: {
          type: "example",
          problem: "Vẽ hình minh họa.",
          solution: "Dùng quan hệ đã cho để kiểm tra hình.",
          answer: "Quan hệ đúng.",
          origin: "SOURCE_EXACT",
          sourcePageNumbers: [1],
          figures: [{ internal: true }],
        },
      });
      brief.referenceImageMode = mode;
      if (mode === "SOURCE_CROP_ONLY") brief.figureOrigin = "TEXTBOOK_SOURCE";
      brief.referenceAssets = assets;
      brief.adminInstructions = adminInstructions;
      if (currentLatexSource) brief.currentLatexSource = currentLatexSource;

      await service.createNew({
        figureId: lessonId,
        revisionId: chunkId,
        aiGenerationId: null,
        backgroundJobId: "00000000-0000-4000-8000-000000000003",
        jobAttempt: 1,
        subject: { key: "MATH", name: "Toán", slug: "toan" },
        brief,
        referenceImages: inputImages,
      });

      const request = generateStructured.mock.calls[0]?.[1];
      const providerBrief = JSON.parse(
        String(request.userPrompt).split("\n\n").at(-1)!,
      ) as Record<string, unknown>;
      expect(request.inputImages).toHaveLength(expectedInputImageCount);
      expect(providerBrief).toEqual({
        targetGrade: 12,
        blockContent: {
          type: "example",
          problem: "Vẽ hình minh họa.",
        },
        reference: expectedReference,
        ...(currentLatexSource ? { currentLatexSource } : {}),
        ...(adminInstructions ? { adminInstructions } : {}),
      });
      expect(providerBrief).not.toHaveProperty("lessonTitle");
      expect(providerBrief).not.toHaveProperty("sectionHeading");
      expect(providerBrief).not.toHaveProperty("sourceEvidence");
      expect(providerBrief).not.toHaveProperty("essentialElements");
      expect(providerBrief).not.toHaveProperty("pairedTheory");
      if (!adminInstructions) {
        const providerPrompts = `${request.systemPrompt}\n${request.userPrompt}`;
        expect(providerPrompts).not.toContain("adminInstructions");
        expect(providerPrompts).not.toContain("yêu cầu sửa đổi/bổ sung");
        expect(providerPrompts).not.toContain("delta");
      }
    },
  );

  it("sends textbook reference, current TikZ, and admin request for a minimal current-image edit", async () => {
    const generateStructured = vi.fn().mockResolvedValue({
      data: { latexSource: validGemStyleFragment },
    });
    const service = new StemFigureRepairService(
      { generateStructured } as never,
      { get: vi.fn() } as never,
    );
    const brief = figureBrief({
      blockContent: { type: "knowledge", content: "Nội dung kiểm thử." },
    });
    brief.referenceImageMode = "CURRENT_ONLY";
    brief.currentLatexSource = validGemStyleFragment;
    brief.adminInstructions = "Chỉ sửa vị trí nhãn A để không chồng lên cạnh.";
    brief.referenceAssets = [
      {
        objectKey: "source/hinh-1-2.png",
        mimeType: "image/png",
        label: "Hình 1.2",
        packetPageNumber: 2,
        source: "OCR_CROP",
      },
    ];

    await service.createNew({
      figureId: lessonId,
      revisionId: chunkId,
      aiGenerationId: null,
      backgroundJobId: "00000000-0000-4000-8000-000000000003",
      jobAttempt: 1,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      brief,
      referenceImages: [{ imageUrl: "data:image/png;base64,c291cmNl", detail: "high" }],
    });

    const request = generateStructured.mock.calls[0]?.[1] as {
      inputImages: unknown[];
      promptVersion: string;
      systemPrompt: string;
      userPrompt: string;
    };
    const providerBrief = JSON.parse(request.userPrompt.split("\n\n").at(-1)!) as Record<
      string,
      unknown
    >;
    expect(request.inputImages).toHaveLength(1);
    expect(request.promptVersion).toBe(
      "stem-figure-edit-current-source-v53-owner-block-only",
    );
    expect(providerBrief).toMatchObject({
      reference: {
        mode: "CURRENT_ONLY",
        images: [{ label: "Hình 1.2", source: "OCR_CROP" }],
      },
      currentLatexSource: validGemStyleFragment,
      adminInstructions: "Chỉ sửa vị trí nhãn A để không chồng lên cạnh.",
    });
    expect(request.userPrompt).toContain("sửa tối thiểu currentLatexSource");
    expect(request.systemPrompt).toContain(
      "ảnh reference là ảnh sách giáo khoa xác định hình đích cần đạt",
    );
    expect(request.systemPrompt).toContain("không viết lại toàn hình");
  });

  it("does not send current TikZ in the Phase 2 textbook regeneration mode", async () => {
    const generateStructured = vi.fn().mockResolvedValue({
      data: { latexSource: validGemStyleFragment },
    });
    const service = new StemFigureRepairService(
      { generateStructured } as never,
      { get: vi.fn() } as never,
    );
    const brief = figureBrief({
      blockContent: { type: "knowledge", content: "Nội dung kiểm thử." },
    });
    brief.referenceImageMode = "SOURCE_CROP_ONLY";
    brief.currentLatexSource = validGemStyleFragment;

    await service.createNew({
      figureId: lessonId,
      revisionId: chunkId,
      aiGenerationId: null,
      backgroundJobId: "00000000-0000-4000-8000-000000000003",
      jobAttempt: 1,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      brief,
    });

    const request = generateStructured.mock.calls[0]?.[1];
    const providerBrief = JSON.parse(
      String(request.userPrompt).split("\n\n").at(-1)!,
    ) as Record<string, unknown>;
    expect(providerBrief).not.toHaveProperty("currentLatexSource");
    expect(request.userPrompt).not.toContain("sửa tối thiểu currentLatexSource");
  });

  it("omits a missing target grade instead of sending a null provider field", async () => {
    const generateStructured = vi.fn().mockResolvedValue({
      data: { latexSource: validGemStyleFragment },
    });
    const service = new StemFigureRepairService(
      { generateStructured } as never,
      { get: vi.fn() } as never,
    );
    const brief = figureBrief({
      blockContent: { type: "knowledge", content: "Nội dung kiểm thử." },
    });
    brief.targetGrade = null;

    await service.createNew({
      figureId: lessonId,
      revisionId: chunkId,
      aiGenerationId: null,
      backgroundJobId: "00000000-0000-4000-8000-000000000003",
      jobAttempt: 1,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      brief,
    });

    const request = generateStructured.mock.calls[0]?.[1];
    const providerBrief = JSON.parse(
      String(request.userPrompt).split("\n\n").at(-1)!,
    ) as Record<string, unknown>;
    expect(providerBrief).not.toHaveProperty("targetGrade");
  });

  it.each([
    {
      mode: "SOURCE_CROP_ONLY" as const,
      source: "OCR_CROP" as const,
      objectKey: "source/conflicting-triangle.png",
      mimeType: "image/png",
      packetPageNumber: 2,
    },
    {
      mode: "CURRENT_ONLY" as const,
      source: "OCR_CROP" as const,
      objectKey: "source/current-triangle-target.png",
      mimeType: "image/png",
      packetPageNumber: 2,
    },
    {
      mode: "NONE" as const,
      source: null,
      objectKey: null,
      mimeType: null,
      packetPageNumber: null,
    },
  ])(
    "applies the dedicated system prompt and authority rules in $mode",
    async ({ mode, source, objectKey, mimeType, packetPageNumber }) => {
      const generateStructured = vi.fn().mockResolvedValue({
        data: { latexSource: validGemStyleFragment },
      });
      const service = new StemFigureRepairService(
        { generateStructured } as never,
        { get: vi.fn() } as never,
      );
      const brief = figureBrief({
        blockContent: {
          type: "example",
          problem: "Vẽ tam giác ABC vuông tại A.",
        },
      });
      brief.referenceImageMode = mode;
      if (mode === "SOURCE_CROP_ONLY") {
        brief.figureOrigin = "TEXTBOOK_SOURCE";
      }
      brief.adminInstructions =
        "Giữ nguyên tam giác ABC của ảnh baseline và bổ sung đường tròn tâm O có bán kính R ở bên phải.";
      brief.referenceAssets =
        source && objectKey && mimeType
          ? [
              {
                objectKey,
                mimeType,
                label: "Baseline tam giác ABC",
                packetPageNumber,
                source,
              },
            ]
          : [];
      if (mode === "CURRENT_ONLY") {
        brief.currentLatexSource = validGemStyleFragment;
      }

      await service.createNew({
        figureId: lessonId,
        revisionId: chunkId,
        aiGenerationId: null,
        backgroundJobId: "00000000-0000-4000-8000-000000000003",
        jobAttempt: 1,
        subject: { key: "MATH", name: "Toán", slug: "toan" },
        brief,
        referenceImages:
          source && mimeType
            ? [{ imageUrl: `data:${mimeType};base64,dGVzdA==`, detail: "high" }]
            : [],
      });

      const request = generateStructured.mock.calls[0]?.[1] as {
        systemPrompt: string;
        userPrompt: string;
        promptVersion: string;
      };
      const providerBrief = JSON.parse(
        request.userPrompt.split("\n\n").at(-1)!,
      ) as Record<string, unknown>;
      expect(providerBrief).toMatchObject({
        adminInstructions:
          "Giữ nguyên tam giác ABC của ảnh baseline và bổ sung đường tròn tâm O có bán kính R ở bên phải.",
      });
      expect(request.systemPrompt).not.toContain(
        "adminInstructions là dữ liệu cần tuân thủ khi không mâu thuẫn",
      );
      if (mode === "SOURCE_CROP_ONLY") {
        expect(request.systemPrompt).toContain(
          "chuyên gia vẽ lại một hình STEM từ ảnh sách giáo khoa",
        );
        expect(request.systemPrompt).toContain(
          "adminInstructions là thẩm quyền của đúng phần thay đổi/bổ sung",
        );
        expect(request.systemPrompt).not.toContain("currentLatexSource");
        expect(request.promptVersion).toBe(
          "stem-figure-regenerate-from-source-v53-owner-block-only",
        );
      } else if (mode === "CURRENT_ONLY") {
        expect(request.systemPrompt).toContain(
          "chuyên gia chỉnh sửa source LuaLaTeX/TikZ hiện tại",
        );
        expect(request.systemPrompt).toContain(
          "currentLatexSource là code hiện tại bắt buộc phải sửa trực tiếp",
        );
        expect(request.systemPrompt).not.toContain("tự thiết kế một hình");
        expect(request.promptVersion).toBe(
          "stem-figure-edit-current-source-v53-owner-block-only",
        );
      } else {
        expect(request.systemPrompt).toContain(
          "chuyên gia tự thiết kế một hình LuaLaTeX/TikZ mới",
        );
        expect(request.systemPrompt).toContain(
          "blockContent là nguồn sự thật chuyên môn duy nhất",
        );
        expect(request.systemPrompt).not.toContain("ảnh reference");
        expect(request.systemPrompt).not.toContain("currentLatexSource");
        expect(request.promptVersion).toBe(
          "stem-figure-generate-from-block-v53-owner-block-only",
        );
      }
    },
  );

  it("rejects an old generation brief before any provider call", () => {
    const oldBrief = {
      ...figureBrief({
        blockContent: { type: "knowledge", content: "Nội dung" },
      }),
      figurePlanContractVersion: 1 as const,
      visualIntent: "Field cũ không được chấp nhận.",
    };
    expect(stemFigureGenerationBriefSchema.safeParse(oldBrief).success).toBe(false);
  });

  it("keeps only the owning block in a figure generation brief", () => {
    const output = stemFigureLessonContextSchema.parse({
      title: "Hai điểm xác định một đường thẳng",
      targetGrade: 6,
      sections: [
        {
          displayHeading: "Đường thẳng qua hai điểm",
          sourceEvidence: {
            kind: "CONTENT",
            text: "Hai điểm phân biệt xác định một đường thẳng.",
            packetPageNumbers: [1],
          },
          blocks: [
            {
              type: "knowledge",
              title: "Kiến thức",
              content: "Hai điểm phân biệt xác định một đường thẳng.",
            },
            {
              type: "example",
              problem: "Vẽ đường thẳng đi qua A và B.",
              isGeometry: true,
              geometryStatement: { hypotheses: ["A và B phân biệt"] },
            },
          ],
        },
      ],
    });
    const brief = buildStemFigureGenerationBrief({
      output,
      blockPath: "sections.0.blocks.1",
      plan: {
        figurePlanContractVersion: 3,
        localId: "F001",
        figureOrigin: "GENERATED_FROM_BRIEF",
        sourceReferences: [],
      },
      targetGrade: 6,
    });

    expect(brief.blockContent).toEqual({
      type: "example",
      problem: "Vẽ đường thẳng đi qua A và B.",
      isGeometry: true,
      geometryStatement: { hypotheses: ["A và B phân biệt"] },
    });
    expect(brief).not.toHaveProperty("pairedTheory");
    expect(
      stemFigureGenerationBriefSchema.safeParse({
        ...brief,
        pairedTheory: output.sections[0]?.blocks[0],
      }).success,
    ).toBe(false);
  });

  it("caps a same-label textbook figure at four usable crops in deterministic order", () => {
    const selection = selectReferenceImages({
      images: [
        ...Array.from({ length: 6 }, (_, index) =>
          referenceImage({
            imageId: `panel-${index + 1}`,
            pageNumber: 9,
            captionCandidate: "Hình 3.4",
            score: 100 - index,
          }),
        ),
        referenceImage({
          imageId: "wrong-page",
          pageNumber: 10,
          captionCandidate: "Hình 3.4",
        }),
        referenceImage({
          imageId: "not-usable",
          pageNumber: 9,
          captionCandidate: "Hình 3.4",
          isUsableForAi: false,
        }),
      ],
      pageNumber: 9,
      figureLabel: "Hình 3.4",
      query: "Hình 3.4",
    });

    expect(selection.images.map(({ imageId }) => imageId)).toEqual([
      "panel-1",
      "panel-2",
      "panel-3",
      "panel-4",
    ]);
    expect(selection.ambiguous).toBe(false);
  });

  it("keeps the compiler contract explicit without implementation recipes", async () => {
    const generateStructured = vi.fn().mockResolvedValue({
      data: { latexSource: validGemStyleFragment },
    });
    const service = new StemFigureRepairService(
      { generateStructured } as never,
      { get: vi.fn() } as never,
    );

    await service.createNew({
      figureId: lessonId,
      revisionId: chunkId,
      aiGenerationId: null,
      backgroundJobId: "00000000-0000-4000-8000-000000000003",
      jobAttempt: 1,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      brief: figureBrief({
        blockContent: {
          type: "example",
          problem: "Minh hoạ mặt phẳng trong Oxyz.",
        },
      }),
    });

    const request = generateStructured.mock.calls[0]?.[1];
    expect(request.systemPrompt).toContain(
      "khai báo mọi coordinate/style trước khi dùng",
    );
    expect(request.systemPrompt).toContain("ưu tiên phép dựng TikZ đơn giản");
    expect(request.promptVersion).toBe(
      "stem-figure-generate-from-block-v53-owner-block-only",
    );
  });

  it("previews the complete resolved OpenAI request without calling the provider", async () => {
    const previewStructuredRequest = vi.fn(async (_context, input) => ({
      provider: "OPENAI",
      model: "gpt-5.6-luna",
      catalogItemId: "catalog-figure",
      category: "TEXT_GENERATION",
      temperature: null,
      reasoningEffort: "medium",
      maxOutputTokens: 12_000,
      outputName: input.outputName,
      promptVersion: input.promptVersion,
      schemaVersion: input.schemaVersion,
      schemaReferenceStrategy: input.schemaReferenceStrategy,
      systemPrompt: input.systemPrompt,
      userPrompt: input.userPrompt,
      inputTextItems: input.inputTextItems,
      inputFiles: [],
      inputImages: [],
      textFormat: {
        type: "json_schema",
        name: "new_stem_figure",
        strict: true,
        schema: {
          type: "object",
          properties: { latexSource: { type: "string" } },
          required: ["latexSource"],
          additionalProperties: false,
        },
      },
      promptCache: undefined,
      inputTokenEstimate: {
        textInputTokens: 1_200,
        imageInputTokens: 1_000,
        estimatedTokens: 2_200,
      },
      estimatedCost: {
        available: true,
        inputUpperBoundUsd: 0.0022,
        inputUpperBoundVnd: 55,
        outputUpperBoundUsd: 0.12,
        outputUpperBoundVnd: 3_000,
        upperBoundUsd: 0.1222,
        upperBoundVnd: 3_055,
        fxRateVndPerUsd: 25_000,
      },
    }));
    const generateStructured = vi.fn();
    const service = new StemFigureRepairService(
      { previewStructuredRequest, generateStructured } as never,
      { get: vi.fn() } as never,
    );

    const preview = await service.previewCreateInput({
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      brief: {
        ...figureBrief({
          blockContent: {},
        }),
        adminInstructions: "Giữ nhãn rõ ràng.",
        referenceImageMode: "CURRENT_ONLY",
        referenceAssets: [
          {
            objectKey: "figures/current.svg",
            mimeType: "image/svg+xml",
            label: "Hình hiện tại",
            packetPageNumber: null,
            source: "CURRENT_FIGURE",
          },
        ],
      },
    });

    expect(generateStructured).not.toHaveBeenCalled();
    expect(previewStructuredRequest).toHaveBeenCalledOnce();
    expect(preview).toMatchObject({
      providerInput: {
        model: "gpt-5.6-luna",
        instructions: expect.stringContaining("LuaLaTeX/TikZ"),
        reasoning: { effort: "medium" },
        max_output_tokens: 12_000,
        text: {
          format: {
            type: "json_schema",
            name: "new_stem_figure",
          },
        },
      },
      systemPrompt: expect.stringContaining("LuaLaTeX/TikZ"),
      userPrompt: expect.stringContaining('"blockContent":{}'),
      context: {
        textInputTokens: 1_200,
        imageInputTokens: 1_000,
        estimatedTokens: 2_200,
      },
      estimatedCost: { available: true, upperBoundVnd: 3_055 },
    });
    expect(JSON.stringify(preview)).toContain("Giữ nhãn rõ ràng.");
    expect(JSON.stringify(preview)).toContain('"type":"input_image"');
    expect(preview.providerInput).not.toHaveProperty("provider");
    expect(preview.providerInput).not.toHaveProperty("promptVersion");
    expect(preview.providerInput).not.toHaveProperty("schemaVersion");
    expect(JSON.stringify(preview.providerInput)).not.toContain('"preview"');
    expect(JSON.stringify(preview)).toContain(OPENAI_PREVIEW_BINARY_DATA);
    expect(JSON.stringify(preview)).not.toContain('"lessonTitle"');
    expect(JSON.stringify(preview)).not.toContain('"sectionHeading"');
  });

  it("requires a readable textbook-style layout without implementation recipes", async () => {
    const generateStructured = vi.fn().mockResolvedValue({
      data: { latexSource: validGemStyleFragment },
    });
    const service = new StemFigureRepairService(
      { generateStructured } as never,
      { get: vi.fn() } as never,
    );

    await service.createNew({
      figureId: lessonId,
      revisionId: chunkId,
      aiGenerationId: null,
      backgroundJobId: "00000000-0000-4000-8000-000000000003",
      jobAttempt: 1,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      brief: figureBrief({
        blockContent: {
          type: "example",
          problem: "Cho ba điểm không thẳng hàng.",
        },
      }),
    });

    const request = generateStructured.mock.calls[0]?.[1];
    expect(request.systemPrompt).toContain("bố cục thoáng, ít màu, nét rõ");
    expect(request.systemPrompt).toContain(
      "Chọn tập đối tượng và quan hệ tối thiểu nhưng đủ",
    );
    expect(request.promptVersion).toBe(
      "stem-figure-generate-from-block-v53-owner-block-only",
    );
  });

  it("uses the admin-edited prompts and the resolved route for both preview and creation", async () => {
    const routeSnapshot = {
      feature: "SUMMARY",
      version: 3,
      model: "gpt-5.6-luna",
      temperature: null,
      reasoningEffort: "xhigh",
      maxOutputTokens: 20_000,
      hasConfiguration: true,
      candidates: [],
    } as never;
    const previewStructuredRequest = vi.fn().mockResolvedValue({
      provider: "OPENAI",
      model: "gpt-5.6-luna",
      temperature: null,
      reasoningEffort: "medium",
      maxOutputTokens: 12_000,
      promptVersion: "stem-figure-create-new-v49-conditional-admin-authority",
      schemaVersion: "stem-figure-create-new-v5",
      systemPrompt: "SYSTEM CUSTOM",
      userPrompt: "USER CUSTOM",
      textFormat: { type: "json_schema" },
      inputTokenEstimate: {
        textInputTokens: 10,
        imageInputTokens: 0,
        estimatedTokens: 10,
      },
      estimatedCost: {
        available: false,
        inputUpperBoundUsd: null,
        inputUpperBoundVnd: null,
        outputUpperBoundUsd: null,
        outputUpperBoundVnd: null,
        upperBoundUsd: null,
        upperBoundVnd: null,
        fxRateVndPerUsd: 25_000,
      },
    });
    const generateStructured = vi.fn().mockResolvedValue({
      data: { latexSource: validGemStyleFragment },
    });
    const service = new StemFigureRepairService(
      { previewStructuredRequest, generateStructured } as never,
      { get: vi.fn() } as never,
    );
    const brief = figureBrief({ blockContent: {} });

    await service.previewCreateInput({
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      brief,
      routeSnapshot,
      systemPrompt: "SYSTEM CUSTOM",
      userPrompt: "USER CUSTOM",
    });
    await service.createNew({
      figureId: lessonId,
      revisionId: chunkId,
      aiGenerationId: null,
      backgroundJobId: "00000000-0000-4000-8000-000000000003",
      jobAttempt: 1,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      brief,
      routeSnapshot,
      systemPrompt: "SYSTEM CUSTOM",
      userPrompt: "USER CUSTOM",
    });

    expect(previewStructuredRequest.mock.calls[0]?.[0]).toMatchObject({
      routeSnapshot: {
        model: "gpt-5.6-luna",
        reasoningEffort: "medium",
        maxOutputTokens: 12_000,
      },
    });
    expect(previewStructuredRequest.mock.calls[0]?.[1]).toMatchObject({
      systemPrompt: "SYSTEM CUSTOM",
      userPrompt: "USER CUSTOM",
    });
    expect(generateStructured.mock.calls[0]?.[0]).toMatchObject({
      routeSnapshot: {
        model: "gpt-5.6-luna",
        reasoningEffort: "medium",
        maxOutputTokens: 12_000,
      },
    });
    expect(generateStructured.mock.calls[0]?.[1]).toMatchObject({
      systemPrompt: "SYSTEM CUSTOM",
      userPrompt: "USER CUSTOM",
    });
  });

  it("uses only explicit figure provenance", () => {
    expect(
      readStemFigureOrigin({
        figureOrigin: "GENERATED_FROM_BRIEF",
        sourceReferences: [{ packetPageNumber: 1 }],
      }),
    ).toBe("GENERATED_FROM_BRIEF");
    expect(readStemFigureOrigin({ sourceReferences: [] })).toBeUndefined();
    expect(
      readStemFigureOrigin({
        sourceReferences: [
          {
            packetPageNumber: 1,
            printedPageLabel: "23",
            figureLabel: "Hình 1.2",
          },
        ],
      }),
    ).toBeUndefined();
    expect(readStemFigureOrigin({})).toBeUndefined();
  });

  it("rejects contradictory Phase 1 provenance and strips stale PDF assets from a new AI figure", async () => {
    const textbookReference = {
      packetPageNumber: 1,
      printedPageLabel: "23",
      figureLabel: "Hình 1.2",
      sourceTarget: { scope: "WHOLE_FIGURE" as const, locator: null },
    };
    const generatedPlan = {
      figureOrigin: "GENERATED_FROM_BRIEF" as const,
      sourceReferences: [],
      caption: null,
    };

    expect(stemFigureProviderPlanDraftSchema.safeParse(generatedPlan).success).toBe(true);
    expect(
      stemFigureProviderPlanDraftSchema.safeParse({
        ...generatedPlan,
        sourceReferences: [textbookReference],
      }).success,
    ).toBe(false);
    expect(
      stemFigureProviderPlanDraftSchema.safeParse({
        ...generatedPlan,
        figureOrigin: "TEXTBOOK_SOURCE",
      }).success,
    ).toBe(false);

    const output = stemFigureLessonContextSchema.parse({
      title: "Cộng phân số",
      targetGrade: 4,
      sections: [
        {
          displayHeading: "Cộng hai phân số cùng mẫu",
          sourceEvidence: {
            kind: "CONTENT",
            text: "Quy tắc cộng hai phân số cùng mẫu.",
            packetPageNumbers: [1],
          },
          blocks: [
            {
              type: "knowledge",
              title: "Quy tắc",
              content: "Cộng các tử và giữ nguyên mẫu.",
              figures: [],
            },
          ],
        },
      ],
    });
    const stalePdfAsset = {
      objectKey: "derived/reference-pages/page-1.png",
      mimeType: "image/png",
      label: "Trang 1",
      packetPageNumber: 1,
      source: "PDF_PAGE" as const,
    };
    const brief = buildStemFigureGenerationBrief({
      output,
      blockPath: "sections.0.blocks.0",
      plan: {
        ...generatedPlan,
        figurePlanContractVersion: 3,
        localId: "F001",
      },
      targetGrade: 4,
      referenceAssets: [stalePdfAsset],
    });

    expect(brief.referenceImageMode).toBe("NONE");
    expect(brief.figureOrigin).toBe("GENERATED_FROM_BRIEF");
    expect(brief.sourceReferences).toEqual([]);
    expect(brief.referenceAssets).toEqual([]);

    // Simulate a future/stale caller reattaching a PDF asset after the brief
    // was built. The provider boundary must still trust provenance first.
    brief.referenceImageMode = "SOURCE_CROP_ONLY";
    brief.referenceAssets = [stalePdfAsset];

    const generateStructured = vi.fn().mockResolvedValue({
      data: { latexSource: validGemStyleFragment },
    });
    const repairService = new StemFigureRepairService(
      { generateStructured } as never,
      { get: vi.fn() } as never,
    );
    await repairService.createNew({
      figureId: lessonId,
      revisionId: chunkId,
      aiGenerationId: null,
      backgroundJobId: "00000000-0000-4000-8000-000000000003",
      jobAttempt: 1,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      brief,
      // Even a stale caller-provided image must be ignored because the brief
      // has no provider reference assets and mode NONE.
      referenceImages: [{ imageUrl: "data:image/png;base64,YWJj", detail: "high" }],
    });
    const providerRequest = generateStructured.mock.calls[0]?.[1];
    expect(providerRequest.inputImages).toEqual([]);
    expect(providerRequest.userPrompt).toContain('"reference":{"mode":"NONE"}');

    const findMany = vi.fn();
    const resolver = new FigureReferenceResolverService(
      { lessonDocument: { findMany } } as never,
      {} as never,
    );
    const snapshot = await resolver.resolve({
      manifest: {
        version: 1,
        lessonId,
        packetHash: "packet-hash",
        pageCount: 1,
        pages: [],
      },
      plan: {
        ...generatedPlan,
        figurePlanContractVersion: 3,
        localId: "F001",
      },
    });
    expect(findMany).not.toHaveBeenCalled();
    expect(snapshot).toMatchObject({ status: "not_found", assets: [], references: [] });
  });

  it("captures the exact resolved figure request and ordered source-image identity", async () => {
    const onRequestPrepared = vi.fn(async () => undefined);
    const generateStructured = vi.fn(async (context: Record<string, unknown>) => {
      await (context.onResolvedRequest as (value: unknown) => Promise<void>)({
        provider: "OPENAI",
        model: "gpt-5.4",
        catalogItemId: "model-id",
        category: "AI_MODEL",
        temperature: 0.1,
        reasoningEffort: "medium",
        maxOutputTokens: 12_000,
        outputName: "new_stem_figure",
        promptVersion: "stem-figure-create-new-v49-conditional-admin-authority",
        schemaVersion: "stem-figure-create-new-v5",
        systemPrompt: "system",
        userPrompt: "user",
        inputFiles: [],
        inputImages: [
          {
            order: 0,
            detail: "high",
            mimeType: "image/jpeg",
            byteLength: 3,
            sha256: "a".repeat(64),
          },
          {
            order: 1,
            detail: "high",
            mimeType: "image/jpeg",
            byteLength: 4,
            sha256: "b".repeat(64),
          },
        ],
        textFormat: { type: "json_schema" },
      });
      return { data: { latexSource: validGemStyleFragment } };
    });
    const service = new StemFigureRepairService(
      { generateStructured } as never,
      { get: vi.fn() } as never,
    );
    const brief = figureBrief({
      blockContent: { type: "knowledge", content: "Nội dung" },
    });
    brief.figureOrigin = "TEXTBOOK_SOURCE";
    brief.sourceReferences = [
      {
        packetPageNumber: 2,
        printedPageLabel: "43",
        figureLabel: "Hình 5.26",
        sourceTarget: { scope: "WHOLE_FIGURE", locator: null },
      },
    ];
    brief.referenceAssets = [
      {
        objectKey: "document-images/page-043/hinh-5-26.jpg",
        mimeType: "image/jpeg",
        label: "Hình 5.26",
        packetPageNumber: 2,
        source: "OCR_CROP",
        sourceTarget: { scope: "WHOLE_FIGURE", locator: null },
      },
      {
        objectKey: "document-images/page-043/hinh-5-26-panel-b.jpg",
        mimeType: "image/jpeg",
        label: "Hình 5.26",
        packetPageNumber: 2,
        source: "OCR_CROP",
        sourceTarget: { scope: "WHOLE_FIGURE", locator: null },
      },
    ];
    brief.referenceImageMode = "SOURCE_CROP_ONLY";

    await service.createNew({
      figureId: lessonId,
      revisionId: chunkId,
      aiGenerationId: null,
      backgroundJobId: "00000000-0000-4000-8000-000000000003",
      jobAttempt: 1,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      brief,
      referenceImages: [
        { imageUrl: "data:image/jpeg;base64,YWJj", detail: "high" },
        { imageUrl: "data:image/jpeg;base64,ZGVmZw==", detail: "high" },
      ],
      onRequestPrepared,
    });

    expect(onRequestPrepared).toHaveBeenCalledWith(
      expect.objectContaining({
        callKind: "CREATE_NEW",
        generationBrief: brief,
        referenceImages: [
          expect.objectContaining({
            order: 0,
            label: "Hình 5.26",
            objectKey: "document-images/page-043/hinh-5-26.jpg",
            sha256: "a".repeat(64),
          }),
          expect.objectContaining({
            order: 1,
            label: "Hình 5.26",
            objectKey: "document-images/page-043/hinh-5-26-panel-b.jpg",
            sha256: "b".repeat(64),
          }),
        ],
        request: expect.objectContaining({
          model: "gpt-5.4",
          maxOutputTokens: 12_000,
        }),
      }),
    );
    const providerRequest = generateStructured.mock.calls[0]?.[1];
    expect(providerRequest.userPrompt).toContain(
      '"panelPolicy":"PRESERVE_EACH_REFERENCE_IMAGE_AS_DISTINCT_PANEL_IN_ORDER"',
    );
    expect(providerRequest.userPrompt).not.toContain('"panelCount"');
    expect(providerRequest.userPrompt).not.toContain('"panelArrangement"');
    expect(providerRequest.userPrompt).not.toContain('"panelInvariant"');
    expect(providerRequest.userPrompt).not.toContain('"visualConstraints"');
    expect(providerRequest.userPrompt).not.toContain('"referenceLayout"');
    expect(providerRequest.userPrompt).not.toContain('"referenceInspection"');
    expect(providerRequest.userPrompt).toContain(
      '"images":[{"label":"Hình 5.26","source":"OCR_CROP","sourceTarget":{"scope":"WHOLE_FIGURE"}},{"label":"Hình 5.26","source":"OCR_CROP","sourceTarget":{"scope":"WHOLE_FIGURE"}}]',
    );
    expect(providerRequest.userPrompt).toContain(
      '"reference":{"mode":"SOURCE_CROP_ONLY"',
    );
    expect(providerRequest.userPrompt).not.toContain('"lessonTitle"');
    expect(providerRequest.userPrompt).not.toContain('"sectionHeading"');
    expect(providerRequest.userPrompt).not.toContain("referenceRole");
    expect(providerRequest.userPrompt).not.toContain("figureKind");
    expect(providerRequest.userPrompt).not.toContain("sourceEvidence");
    expect(providerRequest.userPrompt).not.toContain("packetPageNumber");
    expect(providerRequest.userPrompt).not.toContain("sourceReferences");
  });

  it("does not group same-label crops from different pages as one multi-panel figure", async () => {
    const generateStructured = vi.fn().mockResolvedValue({
      data: { latexSource: validGemStyleFragment },
    });
    const service = new StemFigureRepairService(
      { generateStructured } as never,
      { get: vi.fn() } as never,
    );
    const brief = figureBrief({
      blockContent: { type: "knowledge", content: "Nội dung" },
    });
    brief.figureOrigin = "TEXTBOOK_SOURCE";
    brief.referenceAssets = [2, 3].map((packetPageNumber) => ({
      objectKey: `document-images/page-${packetPageNumber}/hinh-1.jpg`,
      mimeType: "image/jpeg",
      label: "Hình 1",
      packetPageNumber,
      source: "OCR_CROP" as const,
    }));
    brief.referenceImageMode = "SOURCE_CROP_ONLY";

    await service.createNew({
      figureId: lessonId,
      revisionId: chunkId,
      aiGenerationId: null,
      backgroundJobId: "00000000-0000-4000-8000-000000000003",
      jobAttempt: 1,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      brief,
      referenceImages: [
        { imageUrl: "data:image/jpeg;base64,YWJj", detail: "high" },
        { imageUrl: "data:image/jpeg;base64,ZGVmZw==", detail: "high" },
      ],
    });

    const providerRequest = generateStructured.mock.calls[0]?.[1];
    expect(providerRequest.userPrompt).not.toContain("panelPolicy");
    expect(providerRequest.userPrompt).not.toContain("referenceRole");
  });

  it("marks a PDF page fallback for target localization before drawing", async () => {
    const generateStructured = vi.fn().mockResolvedValue({
      data: { latexSource: validGemStyleFragment },
    });
    const service = new StemFigureRepairService(
      { generateStructured } as never,
      { get: vi.fn() } as never,
    );
    const brief = figureBrief({
      blockContent: {
        type: "example",
        problem: "Minh họa hai góc $30^\\circ$ và $60^\\circ$.",
      },
    });
    brief.figureOrigin = "TEXTBOOK_SOURCE";
    brief.referenceAssets = [
      {
        objectKey: "derived/reference-pages/page-50.png",
        mimeType: "image/png",
        label: "Trang 9",
        packetPageNumber: 9,
        source: "PDF_PAGE",
      },
    ];
    brief.referenceImageMode = "SOURCE_CROP_ONLY";

    await service.createNew({
      figureId: lessonId,
      revisionId: chunkId,
      aiGenerationId: null,
      backgroundJobId: "00000000-0000-4000-8000-000000000003",
      jobAttempt: 1,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      brief,
      referenceImages: [{ imageUrl: "data:image/png;base64,YWJj", detail: "high" }],
    });

    const request = generateStructured.mock.calls[0]?.[1];
    expect(request.userPrompt).not.toContain('"visualConstraints"');
    expect(request.userPrompt).toContain('"source":"PDF_PAGE"');
    expect(request.systemPrompt).toContain("Nếu ảnh là nguyên trang");
    expect(request.systemPrompt).toContain("chỉ dựng hình con khớp sourceTarget");
  });

  it("projects an example to problem-only provider context", async () => {
    const generateStructured = vi.fn().mockResolvedValue({
      data: { latexSource: validGemStyleFragment },
    });
    const service = new StemFigureRepairService(
      { generateStructured } as never,
      { get: vi.fn() } as never,
    );

    await service.createNew({
      figureId: lessonId,
      revisionId: chunkId,
      aiGenerationId: null,
      backgroundJobId: "00000000-0000-4000-8000-000000000003",
      jobAttempt: 1,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      brief: figureBrief({
        blockPath: "sections.0.blocks.1",
        blockContent: {
          type: "example",
          problem: "Tính khoảng cách từ M tới mặt phẳng P.",
          solution: "Thay số vào công thức và rút gọn.",
          answer: "Khoảng cách bằng 4.",
        },
      }),
    });

    const request = generateStructured.mock.calls[0]?.[1];
    expect(request.userPrompt).toContain(
      '"blockContent":{"type":"example","problem":"Tính khoảng cách từ M tới mặt phẳng P."}',
    );
    expect(request.userPrompt).not.toContain("solution");
    expect(request.userPrompt).not.toContain("answer");
    expect(request.systemPrompt).toContain("ngôn ngữ minh họa sách giáo khoa");
    expect(request.systemPrompt).toContain(
      "Không chép nguyên đề bài, lý thuyết, phép tính trung gian hoặc kết luận lên hình",
    );
    expect(request.promptVersion).toBe(
      "stem-figure-generate-from-block-v53-owner-block-only",
    );
    expect(request.inputImages).toEqual([]);
  });

  it("makes grades 3 through 12 an explicit prompt invariant", () => {
    for (let grade = 3; grade <= 12; grade += 1) {
      const request = buildLessonSummaryStructuredInput({
        lessonId,
        lessonTitle: `Bài lớp ${grade}`,
        targetGrade: grade,
        subject: { key: "MATH", name: "Toán", slug: "toan" },
        documentIds: ["00000000-0000-4000-8000-000000000003"],
        sourceHash: "a".repeat(64),
        packet: testPacket,
        configuration: {
          style: "student_friendly",
          styleInstructions: "",
          length: "standard",
          targetWordCount: null,
          extraInstructions: "",
        },
      });
      expect(request.systemPrompt).toContain("ĐỘ TRUNG THỰC VÀ CÁCH TRÌNH BÀY");
      expect(request.userPrompt).toContain(`lớp ${grade}`);
    }
  });

  it("keeps criteria in knowledge without a property cue and preserves math layout", () => {
    const request = buildLessonSummaryStructuredInput({
      lessonId,
      lessonTitle: "Vị trí tương đối giữa hai đường thẳng",
      targetGrade: 12,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      documentIds: ["00000000-0000-4000-8000-000000000003"],
      sourceHash: "a".repeat(64),
      packet: testPacket,
      configuration: {
        style: "student_friendly",
        styleInstructions: "",
        length: "standard",
        lengthCustomWords: null,
        customInstructions: "",
        provider: "OPENAI",
        model: "gpt-5.6-terra",
        reasoningEffort: "medium",
        maxOutputTokens: 16_000,
      },
    });

    expect(request.systemPrompt).toContain("không được suy từ nội dung phát biểu");
    expect(request.systemPrompt).toContain("không đủ để suy ra theorem");
    expect(request.systemPrompt).toContain("phân loại theo chức năng thực tế của block");
    expect(request.systemPrompt).toContain("dùng ký hiệu $\\Leftrightarrow$");
    expect(request.systemPrompt).toContain("dấu ngoặc nhọn");
    expect(request.systemPrompt).toContain(
      "ngắt dòng thị giác do dàn trang với ranh giới ngữ nghĩa",
    );
    expect(request.systemPrompt).toContain(
      "dùng công thức inline hay display theo vai trò ngữ nghĩa",
    );

    const textFormat = buildAiStructuredTextFormat(
      getLessonSummaryProviderTransportOutputSchema("MATH", "CONTEXTUAL", 12),
      "lesson_summary_provider_contract",
    );
    const serializedSchema = JSON.stringify(textFormat);
    expect(serializedSchema).toContain(
      "Không coi ngắt dòng do dàn trang là ranh giới ngữ nghĩa",
    );
    expect(serializedSchema).toContain(
      "chọn inline hay display theo vai trò và độ phức tạp",
    );
    expect(serializedSchema).toContain(
      "Bảo toàn câu, đoạn, danh sách, hệ điều kiện, dấu câu dẫn",
    );
  });

  it.each([
    {
      subject: { key: "MATH" as const, name: "Toán", slug: "toan" },
      allowed: ["hình học", "isGeometry", "geometryStatement", "GT–KL"],
      forbidden: ["circuitikz", "chemfig", "mhchem"],
    },
    {
      subject: { key: "PHYSICS" as const, name: "Vật lý", slug: "vat-ly" },
      allowed: ["đơn vị SI", "quang học"],
      forbidden: [
        "tkz-euclide",
        "tkz-tab",
        "chemfig",
        "mhchem",
        "isGeometry",
        "geometryStatement",
        "GT–KL",
      ],
    },
    {
      subject: { key: "CHEMISTRY" as const, name: "Hóa học", slug: "hoa-hoc" },
      allowed: ["hóa trị", "công thức cấu tạo"],
      forbidden: [
        "circuitikz",
        "tkz-euclide",
        "tkz-tab",
        "tikz-3dplot",
        "isGeometry",
        "geometryStatement",
        "GT–KL",
      ],
    },
  ])(
    "isolates every OpenAI input to $subject.name",
    ({ subject, allowed, forbidden }) => {
      const request = buildLessonSummaryStructuredInput({
        lessonId,
        lessonTitle: "Bài học theo môn",
        targetGrade: 9,
        subject,
        documentIds: ["00000000-0000-4000-8000-000000000003"],
        sourceHash: "a".repeat(64),
        packet: testPacket,
        configuration: {
          style: "student_friendly",
          styleInstructions: "",
          length: "standard",
          targetWordCount: null,
          extraInstructions: "",
        },
      });
      const serializedInput = JSON.stringify({
        systemPrompt: request.systemPrompt,
        userPrompt: request.userPrompt,
        metadata: request.metadata,
      });
      for (const value of allowed) expect(serializedInput).toContain(value);
      for (const value of forbidden) expect(serializedInput).not.toContain(value);
      expect(request.metadata).toMatchObject({ subject });
    },
  );

  it("sends every selected source page through exactly one Phase 1 PDF attachment", () => {
    const packet = {
      filename: "multi-image-source-packet.pdf",
      bytes: Buffer.from("%PDF-packet-with-multiple-images"),
      modelManifest: {
        version: 1 as const,
        pages: [
          {
            packetPageNumber: 1,
            sourceKey: "D01",
            documentTitle: "SGK chính",
            sourcePdfPageNumber: 12,
            printedPageLabel: "34",
          },
          {
            packetPageNumber: 2,
            sourceKey: "D01",
            documentTitle: "SGK chính",
            sourcePdfPageNumber: 13,
            printedPageLabel: "35",
          },
          {
            packetPageNumber: 3,
            sourceKey: "D02",
            documentTitle: "Tài liệu bổ sung",
            sourcePdfPageNumber: 1,
            printedPageLabel: null,
          },
        ],
      },
    };
    const request = buildLessonSummaryStructuredInput({
      lessonId,
      lessonTitle: "Bài có nhiều trang nguồn",
      targetGrade: 9,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      documentIds: ["doc-primary", "doc-supplement"],
      sourceHash: "a".repeat(64),
      packet,
      configuration: {
        style: "student_friendly",
        styleInstructions: "",
        length: "standard",
        targetWordCount: null,
        extraInstructions: "",
      },
    });

    expect(request.inputFiles).toEqual([
      {
        filename: packet.filename,
        mimeType: "application/pdf",
        fileData: packet.bytes.toString("base64"),
        detail: "high",
      },
    ]);
    expect(request).not.toHaveProperty("inputImages");
    expect(request.inputTextItems).toEqual([
      {
        id: "source_packet_manifest",
        text: JSON.stringify(packet.modelManifest),
      },
    ]);
    expect(request.userPrompt).not.toContain("Không có yêu cầu bổ sung của admin");

    const providerRequest = buildOpenAiStructuredResponseRequest({
      request,
      model: "gpt-5.6-luna",
      structuredTextFormat: {
        type: "json_schema",
        name: request.outputName,
        strict: true,
        schema: { type: "object" },
      },
      responseInput: buildOpenAiResponseInput(request, [
        {
          type: "input_file",
          file_id: OPENAI_PREVIEW_FILE_ID,
          detail: "high",
        },
      ]),
    });
    expect(providerRequest.input).toEqual([
      {
        role: "user",
        content: [
          {
            type: "input_file",
            file_id: OPENAI_PREVIEW_FILE_ID,
            detail: "high",
          },
          {
            type: "input_text",
            text: JSON.stringify(packet.modelManifest),
          },
          { type: "input_text", text: request.userPrompt },
        ],
      },
    ]);
    expect(JSON.stringify(providerRequest.input)).not.toMatch(
      /packetHash|source_packet_manifest|user_prompt|filename/u,
    );
  });

  it("keeps every subject schema free of another subject's terminology", () => {
    for (const subjectKey of ["MATH", "PHYSICS", "CHEMISTRY"] as const) {
      const schema = JSON.stringify(
        getLessonSummaryProviderTransportOutputSchema(subjectKey).toJSONSchema(),
      );
      expect(schema).not.toMatch(
        /tkz-euclide|tkz-tab|tikz-3dplot|circuitikz|chemfig|mhchem|Vật lý|Hóa học|Toán học/iu,
      );
    }
  });

  it("requires every labeled subpart to start on its own line across Summary fields and subjects", () => {
    const request = buildLessonSummaryStructuredInput({
      lessonId,
      lessonTitle: "Bài học nhiều ý",
      targetGrade: 9,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      documentIds: ["00000000-0000-4000-8000-000000000003"],
      sourceHash: "a".repeat(64),
      packet: testPacket,
      configuration: {
        style: "student_friendly",
        styleInstructions: "",
        length: "standard",
        targetWordCount: null,
        extraInstructions: "",
      },
    });
    expect(request.systemPrompt).toContain(LESSON_SUMMARY_SUBPART_LINEBREAK_INSTRUCTION);

    for (const subjectKey of ["MATH", "PHYSICS", "CHEMISTRY", "GENERAL"] as const) {
      const schema =
        getLessonSummaryProviderTransportOutputSchema(subjectKey).toJSONSchema();
      for (const field of ["problem", "solution", "answer"] as const) {
        const descriptions = collectPropertyDescriptions(schema, field);
        expect(descriptions.length).toBeGreaterThan(0);
        expect(
          descriptions.every((description) =>
            description.includes(LESSON_SUMMARY_SUBPART_LINEBREAK_INSTRUCTION),
          ),
        ).toBe(true);
      }
    }
  });

  it("keeps functional punctuation and readable multiline math layout in every Summary text field", () => {
    const request = buildLessonSummaryStructuredInput({
      lessonId,
      lessonTitle: "Bài học có công thức nhiều dòng",
      targetGrade: 9,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      documentIds: ["00000000-0000-4000-8000-000000000003"],
      sourceHash: "a".repeat(64),
      packet: testPacket,
      configuration: {
        style: "student_friendly",
        styleInstructions: "",
        length: "standard",
        targetWordCount: null,
        extraInstructions: "",
      },
    });
    expect(request.systemPrompt).toContain(
      LESSON_SUMMARY_FUNCTIONAL_PUNCTUATION_AND_MATH_LAYOUT_INSTRUCTION,
    );
    expect(request.systemPrompt).toContain("phải kết thúc bằng dấu `:`");
    expect(request.systemPrompt).toContain("$\\Leftrightarrow$");
    expect(request.systemPrompt).toContain("$\\Rightarrow$");
    expect(request.systemPrompt).toContain("$$\\begin{aligned}...\\end{aligned}$$");
    expect(request.systemPrompt).toContain("không để chuỗi `..`");
    expect(request.systemPrompt).toContain("có từ hai dấu `=` cấp ngoài cùng trở lên");
    expect(request.systemPrompt).toContain(
      "Không áp dụng quy tắc này cho các phương trình độc lập",
    );
    expect(request.systemPrompt).toContain(
      LESSON_SUMMARY_LEARNER_FACING_IMAGE_INDEPENDENCE_INSTRUCTION,
    );
    expect(request.systemPrompt).toContain(
      "nội dung phải tự đủ nghĩa, độc lập với hình ảnh",
    );
    expect(request.systemPrompt).toContain(
      "Mã hình nguồn chỉ được lưu trong `sourceReferences.figureLabel`",
    );

    for (const subjectKey of ["MATH", "PHYSICS", "CHEMISTRY", "GENERAL"] as const) {
      const schema =
        getLessonSummaryProviderTransportOutputSchema(subjectKey).toJSONSchema();
      expect(JSON.stringify(schema)).not.toContain(
        LESSON_SUMMARY_LEARNER_FACING_IMAGE_INDEPENDENCE_INSTRUCTION,
      );
      for (const field of ["content", "problem", "solution", "answer"] as const) {
        const descriptions = collectPropertyDescriptions(schema, field);
        expect(descriptions.length).toBeGreaterThan(0);
        expect(
          descriptions.every((description) =>
            description.includes(
              LESSON_SUMMARY_FUNCTIONAL_PUNCTUATION_AND_MATH_LAYOUT_INSTRUCTION,
            ),
          ),
        ).toBe(true);
      }
    }
  });

  it("keeps the Math-only GT–KL field out of non-Math Summary schemas", () => {
    expect(
      JSON.stringify(
        getLessonSummaryProviderTransportOutputSchema("MATH").toJSONSchema(),
      ),
    ).toContain("geometryStatement");
    for (const subjectKey of ["PHYSICS", "CHEMISTRY", "GENERAL"] as const) {
      expect(
        JSON.stringify(
          getLessonSummaryProviderTransportOutputSchema(subjectKey).toJSONSchema(),
        ),
      ).not.toContain("geometryStatement");
    }
  });

  it("keeps the Math-only GT–KL field out of Physics and Chemistry schemas", () => {
    expect(JSON.stringify(getGeneratedQuizOutputSchema("MATH").toJSONSchema())).toContain(
      "geometryStatement",
    );
    for (const subjectKey of ["PHYSICS", "CHEMISTRY", "GENERAL"] as const) {
      const quizSchema = JSON.stringify(
        getGeneratedQuizOutputSchema(subjectKey).toJSONSchema(),
      );
      const testSchema = JSON.stringify(
        getGeneratedTestOutputSchema(subjectKey).toJSONSchema(),
      );
      expect(quizSchema).not.toContain("geometryStatement");
      expect(testSchema).not.toContain("geometryStatement");
      expect(`${quizSchema}${testSchema}`).not.toMatch(
        /Toán|Vật lý|Hóa học|tkz-euclide|circuitikz|chemfig|mhchem/iu,
      );
    }
  });

  it("uses both admin prompts verbatim when admin overrides them", () => {
    const request = buildLessonSummaryStructuredInput({
      lessonId,
      lessonTitle: "Định luật Ôm",
      targetGrade: 9,
      subject: { key: "PHYSICS", name: "Vật lý", slug: "vat-ly" },
      documentIds: ["00000000-0000-4000-8000-000000000003"],
      sourceHash: "a".repeat(64),
      packet: testPacket,
      configuration: {
        style: "student_friendly",
        styleInstructions: "",
        length: "standard",
        targetWordCount: null,
        extraInstructions: "",
      },
      systemInstructions: "System tùy chỉnh của admin.",
      userPrompt: "Yêu cầu tùy chỉnh của admin.",
    });
    expect(request.systemPrompt).toBe("System tùy chỉnh của admin.");
    expect(request.userPrompt).toBe("Yêu cầu tùy chỉnh của admin.");
    expect(request.systemPrompt).not.toContain("HỒ SƠ MÔN HỌC");
    expect(request.systemPrompt).not.toContain("YÊU CẦU VỀ HÌNH MINH HỌA");
    expect(request.userPrompt).not.toContain("PHẠM VI MÔN HỌC");
  });

  it("preserves whitespace in both admin prompts exactly", () => {
    const systemInstructions = "  System dòng 1\nSystem dòng 2  \n";
    const userPrompt = "\n  User dòng 1\nUser dòng 2  ";
    const request = buildLessonSummaryStructuredInput({
      lessonId,
      lessonTitle: "Định luật Ôm",
      targetGrade: 9,
      subject: { key: "PHYSICS", name: "Vật lý", slug: "vat-ly" },
      documentIds: ["00000000-0000-4000-8000-000000000003"],
      sourceHash: "a".repeat(64),
      packet: testPacket,
      configuration: {
        style: "student_friendly",
        styleInstructions: "",
        length: "standard",
        targetWordCount: null,
        extraInstructions: "",
      },
      systemInstructions,
      userPrompt,
    });

    expect(request.systemPrompt).toBe(systemInstructions);
    expect(request.userPrompt).toBe(userPrompt);
  });

  it("keeps preview-to-worker prompt round trips idempotent", () => {
    const subject = {
      key: "CHEMISTRY" as const,
      name: "Hóa học",
      slug: "hoa-hoc",
    };
    const baseInput = {
      lessonId,
      lessonTitle: "Phản ứng hóa học",
      targetGrade: 8,
      subject,
      documentIds: ["00000000-0000-4000-8000-000000000003"],
      sourceHash: "a".repeat(64),
      packet: testPacket,
      configuration: {
        style: "student_friendly" as const,
        styleInstructions: "",
        length: "standard" as const,
        targetWordCount: null,
        extraInstructions: "",
      },
    };
    const preview = buildLessonSummaryStructuredInput(baseInput);
    const worker = buildLessonSummaryStructuredInput({
      ...baseInput,
      systemInstructions: preview.systemPrompt,
      userPrompt: preview.userPrompt,
    });

    expect(worker.systemPrompt).toBe(preview.systemPrompt);
    expect(worker.userPrompt).toBe(preview.userPrompt);
    expect(worker.systemPrompt.match(/HỒ SƠ MÔN HỌC BẮT BUỘC/gu)).toHaveLength(1);
    expect(worker.systemPrompt.match(/YÊU CẦU VỀ HÌNH MINH HỌA/gu)).toHaveLength(1);
  });

  it("makes source-supported before/after figures mandatory without a title heuristic", () => {
    const request = buildLessonSummaryStructuredInput({
      lessonId,
      lessonTitle: "Đường tròn ngoại tiếp tam giác",
      targetGrade: 9,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      documentIds: ["00000000-0000-4000-8000-000000000003"],
      sourceHash: "a".repeat(64),
      packet: testPacket,
      configuration: {
        style: "student_friendly",
        styleInstructions: "",
        length: "standard",
        targetWordCount: null,
        extraInstructions: "",
      },
    });

    expect(request.systemPrompt).toContain("ở cả phía trước và phía sau");
    expect(request.systemPrompt).toContain("bắt buộc tạo figure");
    expect(request.systemPrompt).toContain("Không ép hình chỉ vì tên bài");
  });

  it("does not infer missing figures from lesson titles or keywords", () => {
    const output = buildMathProviderOutput({
      title: "Bài 28",
      displayHeading: "Đường tròn ngoại tiếp tam giác",
      theoryContent:
        "Tâm đường tròn ngoại tiếp tam giác là giao điểm các đường trung trực.",
      illustrationProblem: "Cho tam giác ABC, xác định tâm đường tròn ngoại tiếp.",
    });

    expect(
      findMissingRequiredLessonSummaryFigures({ output, subjectKey: "MATH" }),
    ).toEqual([]);
  });

  it("keeps the source as visual authority without case-specific figure rules", () => {
    const request = buildLessonSummaryStructuredInput({
      lessonId,
      lessonTitle: "Phương trình mặt phẳng",
      targetGrade: 12,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      documentIds: ["00000000-0000-4000-8000-000000000003"],
      sourceHash: "a".repeat(64),
      packet: testPacket,
      configuration: {
        style: "student_friendly",
        styleInstructions: "",
        length: "standard",
        targetWordCount: null,
        extraInstructions: "",
      },
    });

    expect(request.systemPrompt).toContain("sourceTarget");
    expect(request.systemPrompt).toContain("ảnh là thẩm quyền duy nhất");
    expect(request.systemPrompt).toContain(
      "Nội dung block chỉ dùng để nhận diện và kiểm tra đúng bài",
    );
    expect(request.systemPrompt).toContain("inventory toàn bộ hình/crop");
    expect(request.systemPrompt).toContain("Không được trả mọi figures=[]");
    expect(request.systemPrompt).toContain(
      "Phân biệt tuyệt đối `sourceReferences.figureLabel` và `caption`",
    );
    expect(request.systemPrompt).toContain("Không được dùng riêng mã hình");
    expect(request.systemPrompt).toContain("Mỗi block tối đa một logical figure");
    expect(request.systemPrompt).toContain(
      "ảnh là thẩm quyền duy nhất cho mọi thuộc tính nhìn thấy",
    );
    expect(request.systemPrompt).toContain(
      "Khung nền vàng là tín hiệu vùng định nghĩa/kiến thức/định lí/tính chất",
    );
    expect(request.systemPrompt).not.toMatch(
      /Hình 5\.28|mặt trời|sơ đồ chuyển động|Ta thừa nhận định lí sau|\\widehat\{BAC\}|35\^\\circ/iu,
    );
    expect(request.systemPrompt).toContain("luôn là ứng viên realWorldExercise phù hợp");
    expect(request.systemPrompt).toContain("không được thay bài đó bằng một bài AI khác");
    expect(request.systemPrompt).toContain("figures/sourceReferences bị bỏ mất");
    expect(request.systemPrompt).not.toContain("figure brief");
    expect(request.systemPrompt).not.toContain("brief hình");
    expect(request.systemPrompt).not.toContain("theo đề, brief");
    expect(request.systemPrompt).not.toContain("brief sơ đồ thí nghiệm");
    expect(request.promptVersion).toBe(
      "lesson-summary-pdf-packet-five-block-prompt-v21-image-independent-fields",
    );
    expect(request.schemaVersion).toBe(
      "lesson-summary-pdf-packet-five-block-schema-v20-equality-chain-linebreak",
    );
  });

  it("enforces prompt provenance and minimum-section invariants in the provider schema", () => {
    const providerSchema = getLessonSummaryProviderTransportOutputSchema(
      "MATH",
      "CONTEXTUAL",
      12,
    );
    const base = buildMathProviderOutput({
      title: "Đường thẳng",
      displayHeading: "Vectơ chỉ phương",
      theoryContent:
        "Một đường thẳng được xác định bởi một điểm và một vectơ chỉ phương.",
      illustrationProblem: "Nêu một vectơ chỉ phương của đường thẳng đã cho.",
    });
    const wrongAiProvenance = structuredClone(base);
    const firstItem = wrongAiProvenance.theorySections[0]?.items[0];
    if (!firstItem || firstItem.itemType !== "UNIT") {
      throw new Error("Expected a UNIT fixture.");
    }
    firstItem.example.origin = "AI_AUTHORED";
    const missingSourcePage = structuredClone(base);
    const sourcedItem = missingSourcePage.theorySections[0]?.items[0];
    if (!sourcedItem || sourcedItem.itemType !== "UNIT") {
      throw new Error("Expected a UNIT fixture.");
    }
    sourcedItem.example.sourcePageNumbers = [];

    expect(providerSchema.safeParse(base).success).toBe(true);
    expect(providerSchema.safeParse(wrongAiProvenance).success).toBe(false);
    expect(providerSchema.safeParse(missingSourcePage).success).toBe(false);
    expect(providerSchema.safeParse({ ...base, theorySections: [] }).success).toBe(false);
    expect(providerSchema.safeParse({ ...base, objectives: [] }).success).toBe(false);

    const structuredFormat = buildAiStructuredTextFormat(
      providerSchema,
      "lesson_summary_provider_contract",
      "inline",
    );
    const serializedSchema = JSON.stringify(structuredFormat.schema);
    expect(serializedSchema).toContain('"AI_AUTHORED"');
    expect(serializedSchema).toContain('"maxItems":0');
    expect(serializedSchema).not.toContain('"altText"');
    expect(
      (
        structuredFormat.schema as {
          properties: { theorySections: { minItems?: number } };
        }
      ).properties.theorySections.minItems,
    ).toBe(1);
  });

  it("rejects a source figure identifier used as the learner-facing caption", () => {
    const base = buildMathProviderOutput({
      title: "Hai đường thẳng vuông góc",
      displayHeading: "Điều kiện vuông góc",
      theoryContent: "Hai đường thẳng vuông góc khi tích vô hướng bằng không.",
      illustrationProblem: "Xét hai đường thẳng có vectơ chỉ phương vuông góc.",
      illustrationFigure: {
        caption: "Hai đường thẳng vuông góc và các vectơ chỉ phương tương ứng",
      },
    });
    const sourceLabelOnly = structuredClone(base);
    const firstItem = sourceLabelOnly.theorySections[0]!.items[0]!;
    if (firstItem.itemType !== "UNIT") {
      throw new Error("Expected a UNIT fixture.");
    }
    firstItem.example.figures[0]!.caption = "Hình 5.28";

    expect(
      lessonSummaryProviderTransportOutputSchema.safeParse(sourceLabelOnly).success,
    ).toBe(false);
    expect(lessonSummaryProviderTransportOutputSchema.safeParse(base).success).toBe(true);
  });

  it.each(["inline", "ref_v2"] as const)(
    "does not send regex lookaround in the %s OpenAI JSON Schema",
    (referenceStrategy) => {
      const textFormat = buildAiStructuredTextFormat(
        getLessonSummaryProviderTransportOutputSchema("MATH", "CONTEXTUAL", 12),
        "lesson_summary_provider_contract",
        referenceStrategy,
      );
      const serializedSchema = JSON.stringify(textFormat);

      expect(serializedSchema).not.toMatch(/\(\?(?:[=!]|<[=!])/u);
      expect(serializedSchema).toContain("caption");
      expect(serializedSchema).not.toContain("altText");
      expect(serializedSchema).not.toContain("referenceRole");
      expect(serializedSchema).not.toContain("essentialElements");
      expect(serializedSchema).not.toContain("GEOMETRY_3D");
    },
  );

  it("keeps display-caption validation independent from the persisted render plan", () => {
    const persistedPlan = {
      figurePlanContractVersion: 3,
      figureOrigin: "TEXTBOOK_SOURCE" as const,
      localId: "F001",
      sourceReferences: [
        {
          packetPageNumber: 1,
          printedPageLabel: "41",
          figureLabel: "Hình 5.23",
          sourceTarget: { scope: "WHOLE_FIGURE" as const, locator: null },
        },
      ],
      altText: "Đường thẳng và vectơ chỉ phương",
      caption: "Hình 5.23",
    };

    expect(stemFigurePlanDraftSchema.safeParse(persistedPlan).success).toBe(false);
    expect(stemFigureRenderPlanSchema.parse(persistedPlan)).toEqual(persistedPlan);
  });

  it("keeps explicit source notes separate and requires examples to cover multi-case theory", () => {
    const request = buildLessonSummaryStructuredInput({
      lessonId,
      lessonTitle: "Vị trí tương đối giữa hai đường thẳng",
      targetGrade: 12,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      documentIds: ["00000000-0000-4000-8000-000000000003"],
      sourceHash: "a".repeat(64),
      packet: testPacket,
      configuration: {
        style: "student_friendly",
        styleInstructions: "",
        length: "detailed",
        targetWordCount: null,
        extraInstructions: "",
      },
    });

    expect(request.systemPrompt).toContain("phải tách toàn bộ nội dung thuộc nhãn đó");
    expect(request.systemPrompt).toContain("không được xuất hiện hoặc diễn đạt lại");
    expect(request.systemPrompt).toContain("example nhiều ý bao phủ từng phần chính");
  });

  it("accepts an AI-proposed figure and assigns its local id in the backend", () => {
    const output = buildMathProviderOutput({
      title: "Cộng phân số",
      displayHeading: "Cộng hai phân số",
      theoryContent: "Muốn cộng hai phân số cùng mẫu, cộng các tử và giữ nguyên mẫu.",
      illustrationProblem: "Tính 1/5 + 2/5 bằng mô hình trực quan.",
      illustrationFigure: {
        caption: null,
      },
    });

    expect(
      findMissingRequiredLessonSummaryFigures({ output, subjectKey: "MATH" }),
    ).toEqual([]);
    const mapped = mapLessonSummaryProviderOutput({
      lessonId,
      output,
      packetPageCount: 1,
      subjectKey: "MATH",
    });
    expect(mapped.figures).toHaveLength(1);
    expect(mapped.figures[0]?.draft.localId).toBe("F001");
    expect(mapped.figures[0]?.draft.figureOrigin).toBe("GENERATED_FROM_BRIEF");
    expect(mapped.figures[0]?.draft.sourceReferences).toEqual([]);
    expect(mapped.figures[0]?.draft.altText).toBe(
      "Hình minh họa cho Tính 1/5 + 2/5 bằng mô hình trực quan.",
    );
  });

  it("preserves multiple Phase 1 source references for one textbook figure", () => {
    const output = buildMathProviderOutput({
      title: "Hình ghép nhiều trang",
      displayHeading: "Quan hệ hình học",
      theoryContent: "Quan sát hai trạng thái liên tiếp của phép dựng.",
      illustrationProblem: "Giải thích phép dựng qua hai hình nguồn.",
      illustrationFigure: {
        caption: "Các bước của phép dựng",
      },
    });
    const figure = output.theorySections[0]!.items[0]!.example.figures[0]!;
    figure.figureOrigin = "TEXTBOOK_SOURCE";
    figure.sourceReferences = [
      {
        packetPageNumber: 1,
        printedPageLabel: "34",
        figureLabel: "Hình 3.4a",
        sourceTarget: { scope: "WHOLE_FIGURE", locator: null },
      },
      {
        packetPageNumber: 2,
        printedPageLabel: "35",
        figureLabel: "Hình 3.4b",
        sourceTarget: { scope: "WHOLE_FIGURE", locator: null },
      },
    ];

    const mapped = mapLessonSummaryProviderOutput({
      lessonId,
      output,
      packetPageCount: 2,
      subjectKey: "MATH",
    });

    expect(mapped.figures).toHaveLength(1);
    expect(mapped.figures[0]?.draft.figureOrigin).toBe("TEXTBOOK_SOURCE");
    expect(mapped.figures[0]?.draft.sourceReferences).toEqual(figure.sourceReferences);
    expect(mapped.figures[0]?.draft.localId).toBe("F001");
  });

  it("makes GT–KL mandatory for grade 7–9 geometry and forbidden for high school", () => {
    const gradeNine = buildLessonSummaryStructuredInput({
      lessonId,
      lessonTitle: "Đường tròn ngoại tiếp tam giác",
      targetGrade: 9,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      documentIds: ["00000000-0000-4000-8000-000000000003"],
      sourceHash: "a".repeat(64),
      packet: testPacket,
      configuration: {
        style: "student_friendly",
        styleInstructions: "",
        length: "standard",
        targetWordCount: null,
        extraInstructions: "",
      },
    });
    const gradeTwelve = buildLessonSummaryStructuredInput({
      ...{
        lessonId,
        lessonTitle: "Phương trình đường thẳng trong không gian",
        targetGrade: 12,
        subject: { key: "MATH" as const, name: "Toán", slug: "toan" },
        documentIds: ["00000000-0000-4000-8000-000000000003"],
        sourceHash: "a".repeat(64),
        packet: testPacket,
      },
      configuration: {
        style: "student_friendly",
        styleInstructions: "",
        length: "standard",
        targetWordCount: null,
        extraInstructions: "",
      },
    });

    expect(gradeNine.systemPrompt).toContain(
      "Với bài Hình học lớp 7–9, `isGeometry=true` và `geometryStatement` bắt buộc khác null",
    );
    expect(gradeTwelve.systemPrompt).toContain(
      "Với Hình học lớp 10–12, vẫn đặt `isGeometry=true` nhưng `geometryStatement=null`",
    );
  });

  it("enforces the GT–KL matrix in the grade-specific output schema", () => {
    const base = buildMathProviderOutput({
      title: "Tam giác",
      displayHeading: "Chứng minh hai tam giác bằng nhau",
      theoryContent: "Dùng các trường hợp bằng nhau của hai tam giác.",
      illustrationProblem: "Cho tam giác ABC và DEF. Chứng minh hai tam giác bằng nhau.",
    });
    const firstItem = base.theorySections[0]?.items[0];
    if (!firstItem || firstItem.itemType !== "UNIT") {
      throw new Error("Expected the fixture to start with a UNIT.");
    }
    const geometryStatement = {
      hypotheses: ["$AB = DE$", "$AC = DF$", String.raw`$\widehat{BAC}=\widehat{EDF}$`],
      conclusions: [String.raw`$\triangle ABC = \triangle DEF$`],
    };
    const replaceFirstExample = (example: Record<string, unknown>) => ({
      ...base,
      theorySections: [
        {
          ...base.theorySections[0]!,
          items: [{ ...firstItem, example }],
        },
      ],
    });
    const gradeNineSchema = getLessonSummaryProviderTransportOutputSchema(
      "MATH",
      "CONTEXTUAL",
      9,
    );
    const validGradeNine = replaceFirstExample({
      ...firstItem.example,
      isGeometry: true,
      geometryStatement,
    });

    expect(gradeNineSchema.safeParse(validGradeNine).success).toBe(true);
    expect(
      gradeNineSchema.safeParse(
        replaceFirstExample({
          ...firstItem.example,
          isGeometry: true,
          geometryStatement: null,
        }),
      ).success,
    ).toBe(false);
    expect(
      gradeNineSchema.safeParse(
        replaceFirstExample({
          ...firstItem.example,
          isGeometry: false,
          geometryStatement,
        }),
      ).success,
    ).toBe(false);

    const gradeTwelveSchema = getLessonSummaryProviderTransportOutputSchema(
      "MATH",
      "CONTEXTUAL",
      12,
    );
    const validGradeTwelve = replaceFirstExample({
      ...firstItem.example,
      isGeometry: true,
      geometryStatement: null,
    });
    expect(gradeTwelveSchema.safeParse(validGradeTwelve).success).toBe(true);
    expect(gradeTwelveSchema.safeParse(validGradeNine).success).toBe(false);

    const mapped = mapLessonSummaryProviderOutput({
      lessonId,
      output: gradeNineSchema.parse(validGradeNine),
      packetPageCount: 1,
      targetGrade: 9,
      subjectKey: "MATH",
    });
    expect(mapped.content.sections[0]?.blocks[1]).toEqual(
      expect.objectContaining({ isGeometry: true, geometryStatement }),
    );
    const mappedGradeTwelve = mapLessonSummaryProviderOutput({
      lessonId,
      output: gradeTwelveSchema.parse(validGradeTwelve),
      packetPageCount: 1,
      targetGrade: 12,
      subjectKey: "MATH",
    });
    expect(mappedGradeTwelve.content.sections[0]?.blocks[1]).toEqual(
      expect.objectContaining({ isGeometry: true }),
    );
    expect(
      mappedGradeTwelve.content.sections[0]?.blocks[1]?.type === "example"
        ? mappedGradeTwelve.content.sections[0].blocks[1].geometryStatement
        : null,
    ).toBeUndefined();

    const missingStatement = {
      ...mapped.content,
      sections: mapped.content.sections.map((section, sectionIndex) => ({
        ...section,
        blocks: section.blocks.map((block, blockIndex) =>
          sectionIndex === 0 && blockIndex === 1 && block.type === "example"
            ? { ...block, geometryStatement: undefined }
            : block,
        ),
      })),
    };
    const reviewed = reconcileLessonSummaryReviewIssues({
      type: "lesson_summary_blocks",
      version: 3,
      data: missingStatement,
    });
    expect(
      (
        reviewed.data as {
          sections: Array<{ blocks: Array<{ reviewIssues?: ReviewIssue[] }> }>;
        }
      ).sections[0]?.blocks[1]?.reviewIssues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "MISSING_GEOMETRY_STATEMENT" }),
      ]),
    );
  });

  it.each([
    {
      subject: { key: "MATH" as const, name: "Toán", slug: "toan" },
      expected: "giả thiết, phép biến đổi",
      forbidden: ["đơn vị SI", "hóa trị"],
    },
    {
      subject: { key: "PHYSICS" as const, name: "Vật lý", slug: "vat-ly" },
      expected: "đơn vị SI",
      forbidden: ["chứng minh hình học", "hóa trị"],
    },
    {
      subject: { key: "CHEMISTRY" as const, name: "Hóa học", slug: "hoa-hoc" },
      expected: "hóa trị",
      forbidden: ["đơn vị SI", "chứng minh hình học"],
    },
  ])(
    "isolates Quiz, Flashcard and Test prompts to $subject.name",
    ({ subject, expected, forbidden }) => {
      const configuration = {
        documentIds: ["00000000-0000-4000-8000-000000000003"],
        sourceHash: "a".repeat(64),
        targetGrade: 9,
        subjectKey: subject.key,
        subjectName: subject.name,
        subjectSlug: subject.slug,
        targetQuizSetId: null,
        questionCount: 1,
        difficulty: Difficulty.MEDIUM,
        difficultyCounts: null,
        questionTypes: [QuestionType.TRUE_FALSE],
        style: "student_friendly" as const,
        styleInstructions: "",
        extraInstructions: "",
        systemInstructions: "",
        userPrompt: "",
      };
      const quiz = buildQuizStructuredInput({
        lessonId,
        lessonTitle: "Bài học theo môn",
        sourceHash: configuration.sourceHash,
        documentIds: configuration.documentIds,
        chunks: [{ id: chunkId, content: "Nội dung đúng môn" }],
        configuration,
      });
      const serializedInput = [
        quiz.systemPrompt,
        quiz.userPrompt,
        buildLessonContentSystemPrompt(subject),
        buildFlashcardPrompt({
          lessonTitle: "Bài học theo môn",
          cardCount: 2,
          difficulty: Difficulty.MEDIUM,
          subject,
        }),
        buildTestPrompt({
          lessonTitle: "Bài học theo môn",
          questionCount: 1,
          durationSeconds: 600,
          difficultyRatio: { easy: 0, medium: 1, hard: 0 },
          questionTypes: [QuestionType.TRUE_FALSE],
          targetGrade: 9,
          subject,
        }),
      ].join("\n");
      expect(serializedInput).toContain(expected);
      expect(serializedInput).toContain(subject.name);
      for (const value of forbidden) expect(serializedInput).not.toContain(value);
    },
  );

  it.each([
    {
      subject: { key: "MATH" as const, name: "Toán", slug: "toan" },
      allowed: "tkz-euclide",
      forbidden: ["circuitikz", "chemfig", "mhchem"],
    },
    {
      subject: { key: "PHYSICS" as const, name: "Vật lý", slug: "vat-ly" },
      allowed: "circuitikz",
      forbidden: ["tkz-euclide", "chemfig", "mhchem"],
    },
    {
      subject: { key: "CHEMISTRY" as const, name: "Hóa học", slug: "hoa-hoc" },
      allowed: "chemfig",
      forbidden: ["tkz-euclide", "circuitikz"],
    },
  ])(
    "isolates the compile-repair OpenAI request to $subject.name",
    async ({ subject, allowed, forbidden }) => {
      const generateStructured = vi.fn().mockResolvedValue({
        data: { latexSource: validLatex },
      });
      const service = new StemFigureRepairService(
        { generateStructured } as never,
        createConfig(),
      );
      const diagnosticBatch = createStemFigureDiagnosticBatch({
        attemptId: "00000000-0000-4000-8000-000000000004",
        sourceVersion: 1,
        sourceHash: "b".repeat(64),
        category: "COMPILER",
        issues: [
          {
            code: "TEX_UNDEFINED_CONTROL_SEQUENCE",
            message: "Undefined control sequence",
            file: "fragment.tex",
            line: 3,
          },
        ],
        rawLogExcerpt: "fragment.tex:3: Undefined control sequence",
        collectionComplete: true,
      });

      await service.repair({
        figureId: "00000000-0000-4000-8000-000000000005",
        revisionId: "00000000-0000-4000-8000-000000000006",
        aiGenerationId: "generation-1",
        backgroundJobId: "job-1",
        jobAttempt: 1,
        repairNumber: 1,
        repairKind: "AUTO_COMPILER",
        latexSource: validLatex,
        diagnosticBatch,
        subject,
        adminInstructions:
          "Giữ nguyên mọi quan hệ và nhãn do admin vừa đổi; chỉ sửa lỗi compiler.",
      });

      const request = generateStructured.mock.calls[0]?.[1] as {
        systemPrompt: string;
        userPrompt: string;
        promptVersion: string;
      };
      const serializedInput = `${request.systemPrompt}\n${request.userPrompt}`;
      expect(serializedInput).toContain(allowed);
      expect(serializedInput).toContain(subject.name);
      expect(request.promptVersion).toBe(
        "stem-figure-batch-repair-v9-source-diagnostics-only",
      );
      expect(request.userPrompt).not.toContain("collectionComplete");
      expect(request.userPrompt).not.toContain('"column":null');
      expect(request.userPrompt).not.toContain('"element":null');
      expect(request.userPrompt).not.toContain('"path":null');
      expect(request.userPrompt).toContain(
        '"rawLogExcerpt":"fragment.tex:3: Undefined control sequence"',
      );
      expect(request.systemPrompt).toContain(
        "Đây là lượt sửa kỹ thuật, không phải lượt thiết kế lại",
      );
      expect(request.userPrompt).not.toContain("admin");
      for (const value of forbidden) expect(serializedInput).not.toContain(value);
    },
  );

  it("omits an empty admin request from the compile-repair prompts", async () => {
    const generateStructured = vi.fn().mockResolvedValue({
      data: { latexSource: validLatex },
    });
    const service = new StemFigureRepairService(
      { generateStructured } as never,
      createConfig(),
    );
    const diagnosticBatch = createStemFigureDiagnosticBatch({
      attemptId: "00000000-0000-4000-8000-000000000004",
      sourceVersion: 1,
      sourceHash: "b".repeat(64),
      category: "COMPILER",
      issues: [
        {
          code: "TEX_UNDEFINED_CONTROL_SEQUENCE",
          message: "Undefined control sequence",
          file: "fragment.tex",
          line: 3,
        },
      ],
      rawLogExcerpt: "fragment.tex:3: Undefined control sequence",
      collectionComplete: true,
    });

    await service.repair({
      figureId: "00000000-0000-4000-8000-000000000005",
      revisionId: "00000000-0000-4000-8000-000000000006",
      aiGenerationId: "generation-1",
      backgroundJobId: "job-1",
      jobAttempt: 1,
      repairNumber: 1,
      repairKind: "AUTO_COMPILER",
      latexSource: validLatex,
      diagnosticBatch,
      subject: { key: "MATH", name: "Toán", slug: "toan" },
      adminInstructions: "   ",
    });

    const request = generateStructured.mock.calls[0]?.[1] as {
      systemPrompt: string;
      userPrompt: string;
    };
    const providerPrompts = `${request.systemPrompt}\n${request.userPrompt}`;
    expect(providerPrompts).not.toContain("adminInstructions");
    expect(providerPrompts).not.toContain("Yêu cầu cuối cùng của admin");
    expect(providerPrompts).not.toContain("yêu cầu bổ sung");
  });

  it("keeps Quiz and Test strictly text-only", () => {
    const question = {
      questionType: "TRUE_FALSE",
      difficulty: "EASY",
      hint: "Xét định nghĩa.",
      example: {
        problem: "Số 2 là số chẵn.",
        solution: "2 chia hết cho 2.",
        answer: "Đúng",
        geometryStatement: null,
        figure: { latexSource: validLatex, altText: "Hình", caption: null },
      },
      correctAnswer: true,
    };
    expect(
      generatedQuizOutputSchema.safeParse({ title: "Quiz", questions: [question] })
        .success,
    ).toBe(false);
    const { hint: _hint, ...testQuestion } = question;
    expect(
      generatedTestOutputSchema.safeParse({
        title: "Test",
        questions: [{ ...testQuestion, sourceChunkIds: [chunkId] }],
      }).success,
    ).toBe(false);
  });
});

describe("M9.2 TeX source policy and SVG validator", () => {
  it("accepts one TikZ root without a compiler wrapper", () => {
    expect(validateTexSourcePolicy(validLatex, undefined, "MATH")).toEqual([]);
  });

  it("rejects every package and document declaration from provider output", () => {
    const standalone = String.raw`\documentclass{standalone}
\usepackage{tikz}
\begin{document}
${validLatex}
\end{document}`;
    expect(validateTexSourcePolicy(standalone, undefined, "MATH")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "TEX_DOCUMENT_DECLARATION_FORBIDDEN" }),
        expect.objectContaining({ code: "TEX_PACKAGE_DECLARATION_FORBIDDEN" }),
        expect.objectContaining({ code: "TEX_DOCUMENT_WRAPPER_FORBIDDEN" }),
      ]),
    );
  });

  it("accepts manifest-approved local libraries and styles", () => {
    const source = String.raw`\usetikzlibrary{calc,angles,quotes}
\tikzset{point/.style={circle,fill=black,inner sep=1pt}}
\begin{tikzpicture}
  \coordinate (A) at (0,0);
  \coordinate (B) at (2,0);
  \coordinate (C) at (1,1);
  \pic[draw] {angle=B--A--C};
  \node[point] at ($(A)!0.5!(B)$) {};
\end{tikzpicture}`;
    expect(validateTexSourcePolicy(source, undefined, "MATH")).toEqual([]);
  });

  it("accepts safe style configuration scoped inside the drawing root", () => {
    const source = String.raw`\begin{tikzpicture}
  \tikzset{axis/.style={black,very thick,->}}
  \pgfplotsset{every axis/.append style={font=\small}}
  \draw[axis] (0,0) -- (2,0);
\end{tikzpicture}`;
    expect(validateTexSourcePolicy(source, undefined, "MATH")).toEqual([]);
  });

  it("still rejects library loading inside the drawing root", () => {
    const source = String.raw`\begin{tikzpicture}
  \usetikzlibrary{calc}
  \draw (0,0) -- (2,0);
\end{tikzpicture}`;
    expect(validateTexSourcePolicy(source, undefined, "MATH")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "TEX_HEADER_COMMAND_POSITION_INVALID" }),
      ]),
    );
  });

  it("rejects a library outside the selected subject profile", () => {
    const source = String.raw`\usetikzlibrary{math}
${validLatex}`;
    expect(validateTexSourcePolicy(source, undefined, "GENERAL")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "TEX_LIBRARY_NOT_ALLOWED_FOR_SUBJECT" }),
      ]),
    );
  });

  it("allows circuitikz only as a Physics root", () => {
    const source = String.raw`\begin{circuitikz}
  \draw (0,0) to[R] (2,0);
\end{circuitikz}`;
    expect(validateTexSourcePolicy(source, undefined, "PHYSICS")).toEqual([]);
    expect(validateTexSourcePolicy(source, undefined, "MATH")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "TEX_ROOT_NOT_ALLOWED_FOR_SUBJECT" }),
      ]),
    );
  });

  it("allows axis only when nested in one TikZ root", () => {
    const nested = String.raw`\begin{tikzpicture}
  \begin{axis}\addplot {x};\end{axis}
\end{tikzpicture}`;
    const rootAxis = String.raw`\begin{axis}\addplot {x};\end{axis}`;
    expect(validateTexSourcePolicy(nested, undefined, "MATH")).toEqual([]);
    expect(validateTexSourcePolicy(rootAxis, undefined, "MATH")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "TEX_AXIS_ROOT_FORBIDDEN" }),
      ]),
    );
  });

  it("ignores forbidden command names inside comments", () => {
    expect(
      validateTexSourcePolicy(`% \\usepackage{evil}\n${validLatex}`, undefined, "MATH"),
    ).toEqual([]);
  });

  it("rejects global pgfplots compatibility mutations", () => {
    const source = String.raw`\pgfplotsset{compat=1.18}
${validLatex}`;
    expect(validateTexSourcePolicy(source, undefined, "MATH")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "TEX_PGFPLOTS_COMPAT_FORBIDDEN" }),
      ]),
    );
  });

  it.each([
    [String.raw`\input{/etc/passwd}`, "TEX_EXTERNAL_IO_FORBIDDEN"],
    [String.raw`\includegraphics{remote.png}`, "TEX_EXTERNAL_IO_FORBIDDEN"],
    [String.raw`\directlua{os.execute('id')}`, "TEX_UNSAFE_LUA_FORBIDDEN"],
    [String.raw`\write18{id}`, "TEX_SHELL_ESCAPE_FORBIDDEN"],
    ["https://example.com/a.svg", "TEX_NETWORK_REFERENCE_FORBIDDEN"],
  ])("rejects unsafe source %s", (payload, code) => {
    expect(validateTexSourcePolicy(`${validLatex}\n${payload}`)).toEqual(
      expect.arrayContaining([expect.objectContaining({ code })]),
    );
  });

  it("accepts a finite local-only dvisvgm-style SVG", () => {
    const validator = new SvgValidatorService(createConfig());
    const result = validator.validate(
      `<svg xmlns="http://www.w3.org/2000/svg" width="100pt" height="50pt" viewBox="0 0 100 50"><defs><path id="g0" d="M0 0L1 1"/></defs><g fill="none" stroke="#111"><path d="M2 2L98 48"/><use x="10" y="20" href="#g0"/></g></svg>`,
    );
    expect(result).toMatchObject({
      ok: true,
      viewBox: [0, 0, 100, 50],
      validatorVersion: "stem-svg-validator-v1",
    });
  });

  it.each([
    [
      `<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>`,
      "SVG_EXECUTABLE_CONTENT",
    ],
    [
      `<svg viewBox="0 0 10 10"><style>@import url(https://evil.test/a.css)</style></svg>`,
      "SVG_ELEMENT_FORBIDDEN",
    ],
    [
      `<svg viewBox="0 0 10 10"><use href="https://evil.test/a.svg#x"/></svg>`,
      "SVG_EXTERNAL_REFERENCE",
    ],
    [`<svg viewBox="0 0 NaN 10"><path d="M0 0"/></svg>`, "SVG_NON_FINITE_NUMBER"],
    [`<!DOCTYPE svg><svg viewBox="0 0 10 10"/>`, "SVG_DTD_FORBIDDEN"],
  ])("rejects unsafe SVG", (svg, code) => {
    const result = new SvgValidatorService(createConfig()).validate(svg);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code })]),
      );
    }
  });
});

function textOnlyExample(exampleKind: "STANDARD_EXERCISE" | "REAL_WORLD_EXERCISE") {
  return {
    type: "example",
    exampleKind,
    problem: "Nêu một ví dụ.",
    solution: "Áp dụng định nghĩa.",
    answer: "Ví dụ đúng.",
    origin: "AI_AUTHORED" as const,
    sourcePageNumbers: [],
    isGeometry: false,
    geometryStatement: null,
    figures: [],
  };
}

function figurePlan(
  input: {
    caption: string | null;
  } & Record<string, unknown>,
) {
  return {
    figureOrigin: "GENERATED_FROM_BRIEF" as const,
    sourceReferences: [],
    caption: input.caption,
  };
}

function buildMathProviderOutput(input: {
  title: string;
  displayHeading: string;
  theoryContent: string;
  illustrationProblem: string;
  illustrationFigure?: {
    caption: string | null;
  } & Record<string, unknown>;
}) {
  return lessonSummaryProviderTransportOutputSchema.parse({
    title: input.title,
    objectives: null,
    theorySections: [
      {
        displayHeading: input.displayHeading,
        sourceEvidence: {
          kind: "HEADING",
          text: input.displayHeading,
          packetPageNumbers: [1],
        },
        items: [
          {
            itemType: "UNIT",
            theory: {
              type: "knowledge",
              title: input.displayHeading,
              content: input.theoryContent,
              sourcePageNumbers: [1],
              figures: [],
            },
            example: {
              type: "example",
              exampleKind: "ILLUSTRATION",
              problem: input.illustrationProblem,
              solution: "Áp dụng kiến thức vừa học.",
              answer: "Kết quả đúng.",
              origin: "SOURCE_ADAPTED",
              sourcePageNumbers: [1],
              isGeometry: false,
              geometryStatement: null,
              figures: input.illustrationFigure
                ? [figurePlan(input.illustrationFigure)]
                : [],
            },
          },
        ],
      },
    ],
    applicationExercises: {
      standardExercise: textOnlyExample("STANDARD_EXERCISE"),
      realWorldExercise: textOnlyExample("REAL_WORLD_EXERCISE"),
    },
  });
}

function createConfig() {
  return {
    get: (key: keyof EnvConfig) =>
      ({
        TEX_RENDER_MAX_SVG_BYTES: 2_000_000,
        TEX_RENDER_MAX_SVG_NODES: 20_000,
        TEX_RENDER_MAX_PATH_CHARACTERS: 1_500_000,
        TEX_REPAIR_MAX_INPUT_CHARACTERS: 80_000,
      })[key],
  } as ConfigService<EnvConfig, true>;
}

function packetManifestPage(
  packetPageNumber: number,
  sourcePdfPageNumber: number,
  printedPageLabel: string,
) {
  return {
    packetPageNumber,
    sourceKey: "source-1",
    lessonDocumentId: "lesson-document-1",
    sourceDocumentId: "source-document-1",
    sourceFileId: "source-file-1",
    sourcePdfPageNumber,
    printedPageLabel,
    pageRangeId: null,
    documentTitle: "Toán 12",
    segmentOrder: 0,
  };
}

function packetResolverWithImages(images: OcrImageShape[]) {
  const findMany = vi.fn().mockResolvedValue([
    {
      id: "lesson-document-1",
      file: {
        id: "source-file-1",
        objectKey: "documents/source.pdf",
        checksum: "source-checksum",
      },
      activeOcrArtifact: {
        id: "ocr-artifact-1",
        imageManifestObjectKey: "ocr/image-manifest.json",
      },
      sourceDocument: null,
    },
  ]);
  return new FigureReferenceResolverService(
    { lessonDocument: { findMany } } as never,
    {
      downloadObject: vi.fn().mockResolvedValue(Buffer.from(JSON.stringify({ images }))),
      headObject: vi.fn().mockResolvedValue(true),
      uploadObject: vi.fn(),
    } as never,
  );
}

function referenceImage(
  input: Partial<OcrImageShape> & Pick<OcrImageShape, "imageId">,
): OcrImageShape {
  return {
    imageId: input.imageId,
    pageNumber: input.pageNumber ?? 43,
    objectKey: input.objectKey ?? `document-images/${input.imageId}.jpg`,
    mimeType: input.mimeType ?? "image/jpeg",
    captionCandidate: input.captionCandidate ?? null,
    nearbyText: input.nearbyText ?? null,
    normalizedBoundingBox: input.normalizedBoundingBox ?? null,
    isUsableForAi: input.isUsableForAi ?? true,
    score: input.score ?? 0,
  };
}
