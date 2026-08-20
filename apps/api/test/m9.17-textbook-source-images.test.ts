import { describe, expect, it } from "vitest";

import {
  lessonSummaryJobInputSchema,
  stemFigurePlanDraftSchema,
} from "#api/modules/ai/types/lesson-summary.types";
import { buildLessonSummaryStructuredInput } from "#api/modules/ai/utils/lesson-summary-prompt";
import { resolveStemFigureCurrentAssetKind } from "#api/modules/stem-figures/serializers/stem-figure.serializers";
import type { FigureReferenceSnapshot } from "#api/modules/stem-figures/services/figure-reference-resolver.service";
import { buildFiguresToPersist } from "#api/workers/services/lesson-summary-generation.service";

const HASH = "a".repeat(64);
const DOCUMENT_ID = "10000000-0000-4000-8000-000000000001";
const DRAFT_ID = "10000000-0000-4000-8000-000000000002";

function jobInput(useTextbookSourceImages?: boolean) {
  return lessonSummaryJobInputSchema.parse({
    documentIds: [DOCUMENT_ID],
    sourceHash: HASH,
    requestDraftId: DRAFT_ID,
    requestHash: HASH,
    packetHash: HASH,
    manifestHash: HASH,
    ...(useTextbookSourceImages === undefined ? {} : { useTextbookSourceImages }),
    targetGrade: 8,
    subjectKey: "MATH",
    subjectName: "Toán",
    subjectSlug: "toan",
    style: "student_friendly",
    styleInstructions: "Dễ hiểu",
    length: "standard",
    targetWordCount: null,
    extraInstructions: "",
    systemInstructions: "",
    userPrompt: "",
    schemaReferenceStrategy: "inline",
    promptCacheKeyEnabled: false,
    promptCacheRetention: "in_memory",
  });
}

function plan(origin: "TEXTBOOK_SOURCE" | "GENERATED_FROM_BRIEF" = "TEXTBOOK_SOURCE") {
  return stemFigurePlanDraftSchema.parse({
    figureOrigin: origin,
    sourceReferences:
      origin === "TEXTBOOK_SOURCE"
        ? [
            {
              packetPageNumber: 1,
              printedPageLabel: "12",
              figureLabel: "Hình 1.2",
              sourceTarget: { scope: "WHOLE_FIGURE", locator: null },
            },
          ]
        : [],
    altText: "Hai panel của hình gốc",
    caption: "Hình minh họa",
    figurePlanContractVersion: 3,
    localId: "F001",
  });
}

function snapshot(
  status: FigureReferenceSnapshot["status"],
  objectKeys: string[],
): FigureReferenceSnapshot {
  return {
    version: 1,
    localPlanId: "F001",
    status,
    assets: objectKeys.map((objectKey, index) => ({
      objectKey,
      mimeType: "image/png",
      label: `Panel ${index + 1}`,
      packetPageNumber: 1,
      source: "OCR_CROP",
      sourceTarget: { scope: "WHOLE_FIGURE", locator: null },
    })),
    references: [],
  };
}

describe("M9.17 textbook source image mode", () => {
  it("classifies both automatic and manual textbook crops by their provenance", () => {
    const rasterRevision = (metadataJson: Record<string, unknown>) =>
      ({
        sourceKind: "ADMIN_UPLOAD",
        deliveryFile: { metadataJson },
      }) as never;

    expect(
      resolveStemFigureCurrentAssetKind(
        rasterRevision({
          uploadSource: "lesson-summary.auto-source-crop",
          textbookSourceObjectKey: "ocr/auto-source.png",
        }),
      ),
    ).toBe("TEXTBOOK_SOURCE");
    expect(
      resolveStemFigureCurrentAssetKind(
        rasterRevision({
          uploadSource: "stem-figure.use-source-crop",
          textbookSourceObjectKey: "ocr/manual-source.png",
        }),
      ),
    ).toBe("TEXTBOOK_SOURCE");
    expect(
      resolveStemFigureCurrentAssetKind(
        rasterRevision({
          uploadSource: "lesson-summary.future-source-import",
          textbookSourceObjectKey: "ocr/future-source.png",
        }),
      ),
    ).toBe("TEXTBOOK_SOURCE");
    expect(
      resolveStemFigureCurrentAssetKind(
        rasterRevision({ uploadSource: "stem-figure.replace-upload" }),
      ),
    ).toBe("ADMIN_UPLOAD");
  });

  it("defaults the durable job flag to false", () => {
    expect(jobInput().useTextbookSourceImages).toBe(false);
  });

  it("does not change any Phase 1 structured input field", () => {
    const base = {
      lessonId: "lesson-1",
      lessonTitle: "Bài 1",
      targetGrade: 8,
      subject: { key: "MATH" as const, name: "Toán", slug: "toan" },
      documentIds: [DOCUMENT_ID],
      sourceHash: HASH,
      packet: {
        filename: "lesson.pdf",
        bytes: Buffer.from("same-pdf"),
        modelManifest: {
          version: 1 as const,
          pages: [
            {
              packetPageNumber: 1,
              sourceKey: "source-1",
              documentTitle: "SGK",
              sourcePdfPageNumber: 1,
              printedPageLabel: "12",
            },
          ],
        },
      },
      systemInstructions: "system",
      userPrompt: "user",
    };
    const unchecked = buildLessonSummaryStructuredInput({
      ...base,
      configuration: jobInput(false),
    });
    const checked = buildLessonSummaryStructuredInput({
      ...base,
      configuration: jobInput(true),
    });

    expect(checked).toEqual(unchecked);
  });

  it("materializes every confidently resolved crop in stable order", () => {
    const result = buildFiguresToPersist(
      [
        {
          blockPath: "sections.0.blocks.0",
          figureIndex: 0,
          draft: plan(),
          referenceSnapshot: snapshot("resolved", [
            "ocr/page-1-panel-a.png",
            "ocr/page-1-panel-b.png",
          ]),
        },
      ],
      true,
    );

    expect(result.map((item) => item.mode)).toEqual(["SOURCE_CROP", "SOURCE_CROP"]);
    expect(result.map((item) => item.figureIndex)).toEqual([0, 1]);
    expect(result.map((item) => item.sourceAsset?.objectKey)).toEqual([
      "ocr/page-1-panel-a.png",
      "ocr/page-1-panel-b.png",
    ]);
    expect(result[0]?.draft.localId).not.toBe(result[1]?.draft.localId);
    expect(result.every((item) => item.referenceSnapshot.assets.length === 1)).toBe(true);
  });

  it("keeps ambiguous crop candidates for review and never selects the first", () => {
    const result = buildFiguresToPersist(
      [
        {
          blockPath: "sections.0.blocks.0",
          figureIndex: 0,
          draft: plan(),
          referenceSnapshot: snapshot("ambiguous", [
            "ocr/candidate-a.png",
            "ocr/candidate-b.png",
          ]),
        },
      ],
      true,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.mode).toBe("NEEDS_REVIEW");
    expect(result[0]?.sourceAsset).toBeUndefined();
    expect(result[0]?.referenceSnapshot.assets).toHaveLength(2);
  });

  it("does not materialize AI-authored figures in textbook-only mode", () => {
    const result = buildFiguresToPersist(
      [
        {
          blockPath: "sections.0.blocks.0",
          figureIndex: 0,
          draft: plan("GENERATED_FROM_BRIEF"),
          referenceSnapshot: snapshot("not_found", []),
        },
      ],
      true,
    );

    expect(result).toEqual([]);
  });

  it("preserves the existing Phase 2 materialization when unchecked", () => {
    const result = buildFiguresToPersist(
      [
        {
          blockPath: "sections.0.blocks.0",
          figureIndex: 0,
          draft: plan(),
          referenceSnapshot: snapshot("resolved", ["ocr/source.png"]),
        },
      ],
      false,
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.mode).toBe("PHASE_TWO");
    expect(result[0]?.figureIndex).toBe(0);
  });
});
