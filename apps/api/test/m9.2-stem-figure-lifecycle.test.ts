import { ReviewStatus, StemFigureStatus } from "@prisma/client";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import { studentLessonSummarySelect } from "#api/modules/student-learning/selectors/student-lesson.selects";
import { serializeStudentLessonSummary } from "#api/modules/student-learning/serializers/student-lesson.serializers";
import { StemFigureArtifactService } from "#api/modules/stem-figures/services/stem-figure-artifact.service";
import { StemFigureDraftService } from "#api/modules/stem-figures/services/stem-figure-draft.service";
import { StemFigureJobService } from "#api/modules/stem-figures/services/stem-figure-job.service";
import { StemFigureRepairService } from "#api/modules/stem-figures/services/stem-figure-repair.service";
import { StemFiguresService } from "#api/modules/stem-figures/services/stem-figures.service";
import { serializeStemFigure } from "#api/modules/stem-figures/serializers/stem-figure.serializers";
import { createStemFigureDiagnosticBatch } from "#api/modules/stem-figures/utils/stem-figure-diagnostics";

const figureId = "00000000-0000-4000-8000-000000000031";
const currentRevisionId = "00000000-0000-4000-8000-000000000032";
const pendingRevisionId = "00000000-0000-4000-8000-000000000033";

describe("M9.2 logical figure revision lifecycle", () => {
  it("resolves the admin-selected model configuration before preview and enqueue", async () => {
    const candidate = {
      catalogItemId: "catalog-gpt-5-6-luna",
      priceVersionId: "price-1",
      category: "AI_MODEL",
      provider: "OPENAI",
      model: "gpt-5.6-luna",
      maxInputTokens: 200_000,
      available: true,
      capabilitiesJson: {
        aiConfiguration: "REASONING_EFFORT",
        reasoningEffortLevels: ["low", "medium", "xhigh"],
      },
      rates: [],
    } as const;
    const modelRouting = {
      resolve: vi.fn().mockResolvedValue({
        feature: "SUMMARY",
        version: 5,
        model: "gpt-4.1-mini",
        temperature: 0.2,
        reasoningEffort: null,
        maxOutputTokens: 8_000,
        candidates: [],
        hasConfiguration: true,
      }),
      resolveCandidateByModel: vi.fn().mockResolvedValue(candidate),
    };
    const service = new StemFiguresService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      modelRouting as never,
    );

    const route = await (
      service as unknown as {
        resolveCreateAiRoute(input: unknown): Promise<{
          model: string;
          temperature: number | null;
          reasoningEffort: string | null;
          candidates: Array<{ model: string }>;
        }>;
      }
    ).resolveCreateAiRoute({
      model: "gpt-5.6-luna",
      reasoningEffort: "xhigh",
    });

    expect(route).toMatchObject({
      model: "gpt-5.6-luna",
      temperature: null,
      reasoningEffort: "xhigh",
      candidates: [{ model: "gpt-5.6-luna" }],
    });
    expect(modelRouting.resolveCandidateByModel).toHaveBeenCalledWith("gpt-5.6-luna");
  });

  it("keeps current asset metadata while exposing a failed candidate source", async () => {
    const result = await serializeStemFigure(
      {
        id: figureId,
        lessonId: "00000000-0000-4000-8000-000000000034",
        lessonSummaryId: null,
        aiGenerationId: null,
        blockPath: "sections.0.blocks.1",
        subjectKey: "MATH",
        subjectName: "Toán",
        subjectSlug: "toan",
        status: "FAILED",
        theme: "LIGHT",
        currentRevisionId,
        currentRevision: revision({
          id: currentRevisionId,
          origin: "INITIAL_AI",
          status: "SUCCEEDED",
          sourceVersion: 1,
          latexSource: "current source",
          altText: "Mô tả của ảnh đang dùng",
          caption: "Ảnh hiện hành",
          deliveryFile: { objectKey: "current.svg", publicUrl: null },
        }),
        pendingRevisionId,
        pendingRevision: revision({
          id: pendingRevisionId,
          status: "FAILED",
          sourceVersion: 2,
          latexSource: "failed candidate source",
          altText: "Mô tả candidate chưa dùng",
          caption: "Candidate lỗi",
          lastErrorCategory: "COMPILER",
          lastErrorCode: "TEX_COMPILE_FAILED",
          lastErrorMessage: "Missing number",
        }),
        latexSource: "legacy source",
        sourceHash: "a".repeat(64),
        sourceVersion: 2,
        altText: "legacy alt",
        caption: null,
        previewSvg: null,
        sanitizedSvgHash: null,
        rendererVersion: null,
        validatorVersion: null,
        repairCount: 0,
        maxRepairAttempts: 2,
        lastErrorCategory: "COMPILER",
        lastErrorCode: "TEX_COMPILE_FAILED",
        lastErrorMessage: "Missing number",
        createdAt: new Date("2026-08-12T00:00:00.000Z"),
        updatedAt: new Date("2026-08-12T00:00:01.000Z"),
      } as never,
      {
        resolveAccessUrl: vi.fn(async () => "https://assets.test/current.svg"),
      } as never,
      { createSignedGetUrl: vi.fn() } as never,
      true,
    );

    expect(result).toMatchObject({
      status: "FAILED",
      hasCurrentAsset: true,
      currentRevisionOrigin: "INITIAL_AI",
      assetUrl: "https://assets.test/current.svg",
      latexSource: "failed candidate source",
      sourceVersion: 2,
      altText: "Mô tả của ảnh đang dùng",
      caption: "Ảnh hiện hành",
    });
  });

  it("does not combine a stale figure error with a newer successful draft", async () => {
    const result = await serializeStemFigure(
      {
        id: figureId,
        lessonId: "00000000-0000-4000-8000-000000000034",
        lessonSummaryId: null,
        aiGenerationId: null,
        blockPath: "sections.0.blocks.1",
        subjectKey: "MATH",
        subjectName: "Toán",
        subjectSlug: "toan",
        status: "FAILED",
        theme: "LIGHT",
        currentRevisionId,
        currentRevision: revision({
          id: currentRevisionId,
          status: "SUCCEEDED",
          sourceVersion: 1,
          deliveryFile: { objectKey: "current.svg", publicUrl: null },
        }),
        pendingRevisionId,
        pendingRevision: revision({
          id: pendingRevisionId,
          status: "DRAFT_READY",
          sourceVersion: 3,
          latexSource: "successful candidate source",
        }),
        lastErrorCategory: "COMPILER",
        lastErrorCode: "TEX_COMPILE_FAILED",
        lastErrorMessage: "Stale compiler log from source version 2",
        createdAt: new Date("2026-08-12T00:00:00.000Z"),
        updatedAt: new Date("2026-08-12T00:00:01.000Z"),
      } as never,
      {
        resolveAccessUrl: vi.fn(async () => "https://assets.test/current.svg"),
      } as never,
      { createSignedGetUrl: vi.fn() } as never,
      true,
    );

    expect(result).toMatchObject({
      status: "SUCCEEDED",
      lastErrorCategory: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      diagnosticBatch: null,
      retryIssueCount: 0,
    });
  });

  it("hides stale page evidence from a detached admin draft but preserves a Phase 1 fallback", async () => {
    const pageSnapshot = {
      version: 1,
      localPlanId: "F001",
      status: "page_fallback",
      assets: [
        {
          objectKey: "derived/reference-page.png",
          mimeType: "image/png",
          label: "Trang 1",
          packetPageNumber: 1,
          source: "PDF_PAGE",
        },
      ],
      references: [],
    };
    const baseRecord = {
      id: figureId,
      lessonId: "00000000-0000-4000-8000-000000000034",
      lessonSummaryId: "00000000-0000-4000-8000-000000000036",
      aiGenerationId: null,
      blockPath: "sections.0.blocks.0",
      figureIndex: 0,
      localPlanId: "F001",
      planJson: {
        figurePlanContractVersion: 3,
        localId: "F001",
        figureOrigin: "GENERATED_FROM_BRIEF",
        sourceReferences: [],
      },
      subjectKey: "MATH",
      subjectName: "Toán",
      subjectSlug: "toan",
      status: "FAILED",
      theme: "LIGHT",
      currentRevisionId: null,
      currentRevision: null,
      pendingRevisionId,
      revisions: [],
      lastErrorCategory: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      createdAt: new Date("2026-08-12T00:00:00.000Z"),
      updatedAt: new Date("2026-08-12T00:00:01.000Z"),
    };
    const detachedAdminRevision = {
      ...revision({ id: pendingRevisionId, status: "DRAFT_READY" }),
      referenceSnapshotJson: pageSnapshot,
      referenceSnapshotHash: "a".repeat(64),
    };
    const storage = {
      createSignedGetUrl: vi.fn(async () => "https://assets.test/reference-page.png"),
    };
    const files = { resolveAccessUrl: vi.fn(async () => null) };

    const detachedAdmin = await serializeStemFigure(
      { ...baseRecord, pendingRevision: detachedAdminRevision } as never,
      files as never,
      storage as never,
      true,
    );
    const phaseOneFallback = await serializeStemFigure(
      {
        ...baseRecord,
        pendingRevision: { ...detachedAdminRevision, origin: "INITIAL_AI" },
      } as never,
      files as never,
      storage as never,
      true,
    );

    expect(detachedAdmin).toMatchObject({
      figureOrigin: "GENERATED_FROM_BRIEF",
      sourceReferenceSnapshotHash: null,
      sourceReferenceImages: [],
    });
    expect(phaseOneFallback.sourceReferenceImages).toEqual([
      expect.objectContaining({ source: "PDF_PAGE", label: "Trang 1" }),
    ]);
    expect(phaseOneFallback.figureOrigin).toBe("GENERATED_FROM_BRIEF");
  });

  it("restores textbook references from revision history after a code revision", async () => {
    const snapshot = {
      version: 1,
      localPlanId: "F001",
      status: "resolved",
      assets: [
        {
          objectKey: "derived/reference-crop.png",
          mimeType: "image/png",
          label: "Hình 1",
          packetPageNumber: 1,
          source: "OCR_CROP",
        },
      ],
      references: [],
    };
    const result = await serializeStemFigure(
      {
        id: figureId,
        lessonId: "00000000-0000-4000-8000-000000000034",
        lessonSummaryId: "00000000-0000-4000-8000-000000000036",
        aiGenerationId: null,
        blockPath: "sections.0.blocks.0",
        figureIndex: 0,
        localPlanId: "F001",
        planJson: {},
        subjectKey: "MATH",
        subjectName: "Toán",
        subjectSlug: "toan",
        status: "SUCCEEDED",
        theme: "LIGHT",
        currentRevisionId,
        currentRevision: {
          ...revision({
            id: currentRevisionId,
            status: "SUCCEEDED",
            deliveryFile: { objectKey: "current.svg", publicUrl: null },
          }),
          referenceSnapshotJson: null,
          referenceSnapshotHash: null,
        },
        pendingRevisionId: null,
        pendingRevision: null,
        revisions: [
          {
            providerRequestSnapshotsJson: null,
            referenceSnapshotJson: snapshot,
            referenceSnapshotHash: "snapshot-hash",
          },
        ],
        lastErrorCategory: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        createdAt: new Date("2026-08-12T00:00:00.000Z"),
        updatedAt: new Date("2026-08-12T00:00:01.000Z"),
      } as never,
      { resolveAccessUrl: vi.fn(async () => "https://assets.test/current.svg") } as never,
      {
        createSignedGetUrl: vi.fn(async () => "https://assets.test/reference.png"),
      } as never,
      true,
    );

    expect(result.sourceReferenceSnapshotHash).toBe("snapshot-hash");
    expect(result.sourceReferenceImages).toEqual([
      expect.objectContaining({
        objectKey: "derived/reference-crop.png",
        accessUrl: "https://assets.test/reference.png",
      }),
    ]);
  });

  it("copies the immutable textbook snapshot into a new code revision", async () => {
    const snapshot = {
      version: 1,
      localPlanId: "F001",
      status: "resolved",
      assets: [],
      references: [],
    };
    const createRevision = vi.fn(async (input: { data: Record<string, unknown> }) => ({
      id: pendingRevisionId,
      sourceHash: input.data.sourceHash,
    }));
    const prisma = {
      stemFigure: {
        findFirst: vi.fn(async () => ({
          id: figureId,
          subjectKey: "MATH",
          currentRevisionId,
        })),
        update: vi.fn(async () => ({})),
      },
      stemFigureRevision: {
        findFirst: vi.fn(async (input: { where: Record<string, unknown> }) =>
          "referenceSnapshotHash" in input.where
            ? {
                referenceSnapshotJson: snapshot,
                referenceSnapshotHash: "snapshot-hash",
              }
            : { sourceVersion: 1 },
        ),
        create: createRevision,
        update: vi.fn(async () => ({})),
      },
      stemFigureRenderAttempt: {
        aggregate: vi.fn(async () => ({ _max: { attemptNumber: 1 } })),
        create: vi.fn(async () => ({
          id: "00000000-0000-4000-8000-000000000037",
        })),
        update: vi.fn(async () => ({})),
      },
      $transaction: vi.fn(async (operations: Array<Promise<unknown>>) =>
        Promise.all(operations),
      ),
    };
    const service = new StemFigureDraftService(
      prisma as never,
      { get: vi.fn(() => 100_000) } as never,
      {
        render: vi.fn(async () => ({
          ok: true,
          svg: '<svg viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>',
          rendererVersion: "renderer-v1",
        })),
      } as never,
      {
        validate: vi.fn(() => ({
          ok: true,
          sanitizedSvg: '<svg viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>',
          sha256: "a".repeat(64),
          validatorVersion: "validator-v1",
        })),
      } as never,
      {} as never,
    );

    await service.compile(
      "00000000-0000-4000-8000-000000000034",
      figureId,
      "00000000-0000-4000-8000-000000000035",
      {
        baseRevisionId: currentRevisionId,
        sourceVersion: 1,
        latexSource: String.raw`\begin{tikzpicture}
  \draw (0,0) -- (2,0) -- (0,1.5) -- cycle;
\end{tikzpicture}`,
        altText: "Hình tam giác",
        caption: null,
      },
    );

    expect(createRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          referenceSnapshotJson: snapshot,
          referenceSnapshotHash: "snapshot-hash",
        }),
      }),
    );
    expect(prisma.stemFigure.update).toHaveBeenCalledWith({
      where: { id: figureId },
      data: {
        pendingRevisionId,
        status: "SUCCEEDED",
        lastErrorCategory: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });
  });

  it("requires the pending revision head when promoting an SVG", async () => {
    const svg = `<svg viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>`;
    const checksum = await import("node:crypto").then(({ createHash }) =>
      createHash("sha256").update(svg).digest("hex"),
    );
    const transaction = {
      stemFigure: {
        findFirst: vi.fn(async () => ({ id: figureId })),
        update: vi.fn(async () => ({})),
      },
      stemFigureRevision: {
        findFirst: vi.fn(async () => ({
          id: pendingRevisionId,
          sourceKind: "AI_TEX",
          latexSource: "source",
          sourceHash: "a".repeat(64),
          sourceVersion: 2,
          altText: "Hình",
          caption: null,
          sanitizedSvgHash: checksum,
          rendererVersion: "renderer-v2",
          validatorVersion: "validator-v1",
          repairCount: 0,
        })),
        update: vi.fn(async () => ({})),
      },
      file: { create: vi.fn(async () => ({ id: "file-id" })) },
    };
    const storage = {
      fileProvider: "R2",
      bucketName: "test",
      createObjectKey: vi.fn(() => "figures/result.svg"),
      uploadBuffer: vi.fn(async () => undefined),
      deleteObject: vi.fn(async () => undefined),
      getPublicUrl: vi.fn(() => "https://assets.test/result.svg"),
    };
    const service = new StemFigureArtifactService(
      { $transaction: vi.fn((callback) => callback(transaction)) } as never,
      storage as never,
      { get: vi.fn(() => "test") } as never,
    );

    await service.promoteSvg({
      figureId,
      revisionId: pendingRevisionId,
      svg,
      automatic: true,
    });

    expect(transaction.stemFigure.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: figureId,
          pendingRevisionId,
        }),
      }),
    );
  });

  it("updates current figure metadata without uploading or recompiling the SVG", async () => {
    const transaction = {
      stemFigure: {
        findFirst: vi.fn(async () => ({
          id: figureId,
          lessonSummaryId: null,
          blockPath: "sections.0.blocks.0",
          figureIndex: 0,
        })),
      },
      stemFigureRevision: {
        findFirst: vi.fn(async () => ({ id: currentRevisionId })),
        update: vi.fn(async () => ({})),
      },
    };
    const storage = {
      uploadBuffer: vi.fn(async () => undefined),
    };
    const service = new StemFigureArtifactService(
      { $transaction: vi.fn((callback) => callback(transaction)) } as never,
      storage as never,
      { get: vi.fn(() => "test") } as never,
    );

    await service.updateCurrentMetadata({
      figureId,
      revisionId: currentRevisionId,
      altText: "Mô tả hình đã cập nhật",
      caption: "Chú thích mới",
    });

    expect(transaction.stemFigureRevision.update).toHaveBeenCalledWith({
      where: { id: currentRevisionId },
      data: {
        altText: "Mô tả hình đã cập nhật",
        caption: "Chú thích mới",
      },
    });
    expect(storage.uploadBuffer).not.toHaveBeenCalled();
  });

  it("rejects a stale management action before enqueueing work", async () => {
    const prisma = {
      stemFigure: {
        findFirst: vi.fn(async () => ({
          id: figureId,
          currentRevisionId,
          pendingRevisionId,
          currentRevision: revision({ id: currentRevisionId, sourceVersion: 1 }),
          pendingRevision: revision({ id: pendingRevisionId, sourceVersion: 2 }),
        })),
      },
    };
    const jobs = { enqueue: vi.fn() };
    const service = new StemFiguresService(
      prisma as never,
      { get: vi.fn() } as never,
      {} as never,
      {} as never,
      jobs as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.createNewAi(
        "00000000-0000-4000-8000-000000000034",
        figureId,
        "00000000-0000-4000-8000-000000000035",
        {
          baseCurrentRevisionId: currentRevisionId,
          basePendingRevisionId: pendingRevisionId,
          baseSourceVersion: 1,
        },
      ),
    ).rejects.toThrow("Hình đã có revision mới");
    expect(jobs.enqueue).not.toHaveBeenCalled();
  });

  it("uses the textbook image and current TikZ source for CURRENT_ONLY", async () => {
    const lessonId = "00000000-0000-4000-8000-000000000034";
    const lessonSummaryId = "00000000-0000-4000-8000-000000000040";
    const aiGenerationId = "00000000-0000-4000-8000-000000000036";
    const requestDraftId = "00000000-0000-4000-8000-000000000037";
    const lessonDocumentId = "00000000-0000-4000-8000-000000000038";
    const sourceFileId = "00000000-0000-4000-8000-000000000039";
    const currentLatexSource = String.raw`\begin{tikzpicture}
\draw (0,0) -- (1,0);
\end{tikzpicture}`;
    const current = revision({
      id: currentRevisionId,
      status: "SUCCEEDED",
      sourceVersion: 1,
      latexSource: currentLatexSource,
      deliveryFile: { objectKey: "current-error.svg", publicUrl: null },
    });
    const textbookAsset = {
      objectKey: "source/hinh-1-2.png",
      mimeType: "image/png",
      label: "Hình 1.2",
      packetPageNumber: 1,
      source: "OCR_CROP" as const,
      sourceTarget: { scope: "WHOLE_FIGURE" as const, locator: null },
    };
    const prisma = {
      aiGeneration: {
        findUnique: vi.fn(async () => ({ inputMetaJson: { requestDraftId } })),
      },
      lessonSummaryRequestDraft: {
        findFirst: vi.fn(async () => ({
          manifestJson: {
            version: 1,
            lessonId,
            packetHash: "packet-hash",
            pageCount: 1,
            pages: [
              {
                packetPageNumber: 1,
                sourceKey: "D01",
                lessonDocumentId,
                sourceDocumentId: null,
                sourceFileId,
                sourcePdfPageNumber: 23,
                printedPageLabel: "23",
                pageRangeId: null,
                documentTitle: "SGK",
                segmentOrder: 0,
              },
            ],
          },
        })),
      },
      lessonSummary: {
        findUnique: vi.fn(async () => ({
          contentJson: {
            type: "lesson_summary_blocks",
            version: 3,
            data: {
              title: "Bài kiểm thử",
              targetGrade: 12,
              sections: [
                {
                  displayHeading: "Mục kiểm thử",
                  sourceEvidence: {
                    kind: "CONTENT",
                    text: "Nội dung nguồn",
                    packetPageNumbers: [1],
                  },
                  blocks: [{ type: "knowledge", content: "Nội dung kiểm thử" }],
                },
              ],
            },
          },
        })),
      },
    };
    const figureReferences = {
      resolve: vi.fn(async () => ({
        version: 1,
        localPlanId: "F001",
        status: "resolved",
        assets: [textbookAsset],
        references: [],
      })),
    };
    const service = new StemFiguresService(
      prisma as never,
      { get: vi.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      figureReferences as never,
      {} as never,
    );

    const figure = {
      id: figureId,
      lessonId,
      lessonSummaryId,
      aiGenerationId,
      blockPath: "sections.0.blocks.0",
      planJson: {
        figurePlanContractVersion: 3,
        localId: "F001",
        figureOrigin: "TEXTBOOK_SOURCE",
        sourceReferences: [
          {
            packetPageNumber: 1,
            printedPageLabel: "23",
            figureLabel: "Hình 1.2",
            sourceTarget: { scope: "WHOLE_FIGURE", locator: null },
          },
        ],
      },
      currentRevisionId,
      pendingRevisionId: null,
      currentRevision: current,
      pendingRevision: null,
    };
    const prepared = await (
      service as unknown as {
        prepareCreateNewAi(
          figure: unknown,
          dto: unknown,
        ): Promise<{ generationBrief: Record<string, unknown> }>;
      }
    ).prepareCreateNewAi(figure, {
      referenceImageMode: "CURRENT_ONLY",
      adminInstructions: "Sửa vị trí nhãn A.",
    });

    expect(figureReferences.resolve).toHaveBeenCalledOnce();
    expect(prepared.generationBrief).toMatchObject({
      referenceImageMode: "CURRENT_ONLY",
      currentLatexSource,
      adminInstructions: "Sửa vị trí nhãn A.",
      referenceAssets: [textbookAsset],
    });
    expect(JSON.stringify(prepared.generationBrief)).not.toContain("current-error.svg");
  });

  it("rejects textbook-reference mode when no OCR crop or page fallback can be resolved", async () => {
    const lessonId = "00000000-0000-4000-8000-000000000034";
    const aiGenerationId = "00000000-0000-4000-8000-000000000036";
    const requestDraftId = "00000000-0000-4000-8000-000000000037";
    const lessonDocumentId = "00000000-0000-4000-8000-000000000038";
    const sourceFileId = "00000000-0000-4000-8000-000000000039";
    const current = revision({
      id: currentRevisionId,
      status: "SUCCEEDED",
      sourceVersion: 1,
    });
    const prisma = {
      stemFigure: {
        findFirst: vi.fn(async () => ({
          id: figureId,
          lessonId,
          lessonSummaryId: "00000000-0000-4000-8000-000000000040",
          aiGenerationId,
          blockPath: "sections.0.blocks.0",
          subjectKey: "MATH",
          subjectName: "Toán",
          subjectSlug: "toan",
          planJson: {
            figurePlanContractVersion: 3,
            localId: "F001",
            figureOrigin: "TEXTBOOK_SOURCE",
            sourceReferences: [
              {
                packetPageNumber: 1,
                printedPageLabel: "23",
                figureLabel: "Hình 1.2",
                sourceTarget: { scope: "WHOLE_FIGURE", locator: null },
              },
            ],
          },
          currentRevisionId,
          pendingRevisionId: null,
          currentRevision: current,
          pendingRevision: null,
        })),
      },
      aiGeneration: {
        findUnique: vi.fn(async () => ({ inputMetaJson: { requestDraftId } })),
      },
      lessonSummaryRequestDraft: {
        findFirst: vi.fn(async () => ({
          manifestJson: {
            version: 1,
            lessonId,
            packetHash: "packet-hash",
            pageCount: 1,
            pages: [
              {
                packetPageNumber: 1,
                sourceKey: "D01",
                lessonDocumentId,
                sourceDocumentId: null,
                sourceFileId,
                sourcePdfPageNumber: 23,
                printedPageLabel: "23",
                pageRangeId: null,
                documentTitle: "SGK",
                segmentOrder: 0,
              },
            ],
          },
        })),
      },
    };
    const figureReferences = {
      resolve: vi.fn(async () => ({
        version: 1,
        localPlanId: "F001",
        status: "not_found",
        assets: [],
        references: [],
      })),
    };
    const service = new StemFiguresService(
      prisma as never,
      { get: vi.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      figureReferences as never,
    );

    await expect(
      service.previewCreateNewAi(lessonId, figureId, {
        baseCurrentRevisionId: currentRevisionId,
        basePendingRevisionId: null,
        baseSourceVersion: 1,
        referenceImageMode: "SOURCE_CROP_ONLY" as never,
        adminInstructions: null,
      }),
    ).rejects.toThrow("Không có ảnh gốc sách giáo khoa phù hợp");
    expect(figureReferences.resolve).toHaveBeenCalledOnce();
  });

  it("removes a deleted figure from block figure lists and legacy visual fields", async () => {
    const lessonId = "00000000-0000-4000-8000-000000000034";
    const lessonSummaryId = "00000000-0000-4000-8000-000000000036";
    const keptFigureId = "00000000-0000-4000-8000-000000000039";
    const summaryUpdate = vi.fn(async () => ({}));
    const transaction = {
      lessonSummary: {
        findUnique: vi.fn(async () => ({
          contentJson: {
            type: "lesson_summary_blocks",
            data: {
              title: "Bài kiểm thử xóa hình",
              sections: [
                {
                  blocks: [
                    {
                      type: "knowledge",
                      figures: [
                        { kind: "TEX_FIGURE", figureId, altText: "Hình sẽ xóa" },
                        {
                          kind: "TEX_FIGURE",
                          figureId: keptFigureId,
                          altText: "Hình được giữ",
                        },
                      ],
                    },
                    {
                      type: "example",
                      visual: { kind: "TEX_FIGURE", figureId },
                    },
                  ],
                },
              ],
            },
          },
        })),
        update: summaryUpdate,
      },
      stemFigure: { update: vi.fn(async () => ({})) },
    };
    const prisma = {
      stemFigure: {
        findFirst: vi.fn(async () => ({
          id: figureId,
          lessonId,
          lessonSummaryId,
          currentRevisionId,
          pendingRevisionId: null,
          currentRevision: revision({
            id: currentRevisionId,
            sourceVersion: 1,
          }),
          pendingRevision: null,
        })),
      },
      $transaction: vi.fn(
        async (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const service = new StemFiguresService(
      prisma as never,
      { get: vi.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );

    await service.delete(lessonId, figureId, {
      baseCurrentRevisionId: currentRevisionId,
      basePendingRevisionId: null,
      baseSourceVersion: 1,
    });

    const updatedContent = summaryUpdate.mock.calls[0]?.[0]?.data.contentJson;
    expect(JSON.stringify(updatedContent)).not.toContain(figureId);
    expect(JSON.stringify(updatedContent)).toContain(keptFigureId);
    expect(updatedContent).toMatchObject({
      data: {
        sections: [
          {
            blocks: [
              { figures: [{ kind: "TEX_FIGURE", figureId: keptFigureId }] },
              { visual: { kind: "NONE" } },
            ],
          },
        ],
      },
    });
  });

  it("revives a deleted logical figure as a detached draft without reusing its old current asset", async () => {
    const lessonId = "00000000-0000-4000-8000-000000000034";
    const deleted = {
      id: figureId,
      lessonId,
      lessonSummaryId: "00000000-0000-4000-8000-000000000036",
      aiGenerationId: null,
      blockPath: "sections.0.blocks.0",
      figureIndex: 0,
      localPlanId: "F001",
      planJson: {
        figurePlanContractVersion: 3,
        localId: "F001",
        figureOrigin: "GENERATED_FROM_BRIEF",
        sourceReferences: [],
      },
      currentRevisionId,
      pendingRevisionId: null,
      currentRevision: revision({
        id: currentRevisionId,
        status: "SUCCEEDED",
        deliveryFile: { objectKey: "old.svg", publicUrl: null },
      }),
      pendingRevision: null,
    };
    const figureUpdate = vi
      .fn()
      .mockResolvedValueOnce({ id: figureId })
      .mockResolvedValueOnce({});
    const revisionCreate = vi.fn(async () => ({ id: pendingRevisionId }));
    const transaction = {
      stemFigure: { update: figureUpdate, create: vi.fn() },
      stemFigureRevision: { create: revisionCreate },
    };
    const prisma = {
      lessonSummary: { findFirst: vi.fn(async () => ensureSummaryRecord()) },
      stemFigure: {
        findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(deleted),
      },
      stemFigureRevision: {
        findFirst: vi.fn(async () => ({ sourceVersion: 1 })),
      },
      $transaction: vi.fn(
        async (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const service = new StemFiguresService(
      prisma as never,
      { get: vi.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    vi.spyOn(service, "getForAdmin").mockResolvedValue({ id: figureId } as never);

    await service.ensureForBlock(lessonId, "actor-id", {
      blockPath: "sections.0.blocks.0",
    });

    expect(figureUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          currentRevisionId: null,
          deletedAt: null,
          pendingRevisionId: null,
        }),
      }),
    );
    expect(revisionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sourceVersion: 2, status: "DRAFT_READY" }),
      }),
    );
  });

  it("creates a detached code draft from block content when the block never had a figure", async () => {
    const lessonId = "00000000-0000-4000-8000-000000000034";
    const figureCreate = vi.fn(async () => ({ id: figureId }));
    const transaction = {
      stemFigure: { create: figureCreate, update: vi.fn(async () => ({})) },
      stemFigureRevision: {
        create: vi.fn(async () => ({ id: pendingRevisionId })),
      },
    };
    const prisma = {
      lessonSummary: { findFirst: vi.fn(async () => ensureSummaryRecord()) },
      stemFigure: { findFirst: vi.fn(async () => null) },
      $transaction: vi.fn(
        async (callback: (client: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    };
    const service = new StemFiguresService(
      prisma as never,
      { get: vi.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    vi.spyOn(service, "getForAdmin").mockResolvedValue({ id: figureId } as never);

    await service.ensureForBlock(lessonId, "actor-id", {
      blockPath: "sections.0.blocks.0",
    });

    expect(figureCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          blockPath: "sections.0.blocks.0",
          planJson: expect.objectContaining({
            figurePlanContractVersion: 3,
            figureOrigin: "GENERATED_FROM_BRIEF",
            sourceReferences: [],
          }),
          status: "FAILED",
        }),
      }),
    );
  });

  it("retries a budget-blocked initial source generation after budget is raised", async () => {
    const pending = revision({
      id: pendingRevisionId,
      sourceVersion: 1,
      latexSource: null,
      sourceHash: null,
      lastErrorCategory: "BUDGET",
      lastErrorCode: "PROVIDER_BUDGET_HARD_LIMIT",
    });
    const prisma = {
      stemFigure: {
        findFirst: vi.fn(async () => ({
          id: figureId,
          lessonSummaryId: "00000000-0000-4000-8000-000000000036",
          blockPath: "sections.0.blocks.0",
          planJson: {
            figurePlanContractVersion: 3,
            localId: "F001",
            figureOrigin: "GENERATED_FROM_BRIEF",
            sourceReferences: [],
            altText: "Tam giác ABC",
            caption: null,
          },
          currentRevisionId: null,
          pendingRevisionId,
          currentRevision: null,
          pendingRevision: pending,
        })),
      },
      lessonSummary: {
        findUnique: vi.fn(async () => ({
          contentJson: ensureSummaryRecord().contentJson,
        })),
      },
    };
    const jobs = {
      enqueue: vi.fn(async () => ({ id: "retry-job-id", status: "QUEUED" })),
    };
    const service = new StemFiguresService(
      prisma as never,
      { get: vi.fn() } as never,
      {} as never,
      {} as never,
      jobs as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.retry(
        "00000000-0000-4000-8000-000000000034",
        figureId,
        "00000000-0000-4000-8000-000000000035",
        {
          baseCurrentRevisionId: null,
          basePendingRevisionId: pendingRevisionId,
          baseSourceVersion: 1,
          latestAttemptId: null,
          diagnosticBatchHash: null,
        },
      ),
    ).resolves.toMatchObject({
      jobId: "retry-job-id",
      retryUsesAi: true,
      issueCount: 0,
    });
    expect(jobs.enqueue).toHaveBeenCalledWith(
      figureId,
      "00000000-0000-4000-8000-000000000035",
      expect.objectContaining({
        revisionId: pendingRevisionId,
        trigger: "MANUAL_SOURCE_RETRY",
        generationBrief: expect.objectContaining({
          figurePlanContractVersion: 3,
          figureOrigin: "GENERATED_FROM_BRIEF",
          blockPath: "sections.0.blocks.0",
          blockContent: expect.objectContaining({ content: "Tam giác ABC" }),
        }),
      }),
    );
  });

  it("scopes a manual retry idempotency key to the latest failed job", async () => {
    const failedJobId = "00000000-0000-4000-8000-000000000038";
    const prisma = {
      stemFigure: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: figureId,
          aiGenerationId: null,
          lessonId: "00000000-0000-4000-8000-000000000034",
          subjectKey: "MATH",
          subjectName: "Toán",
          subjectSlug: "toan",
          pendingRevisionId,
          currentRevisionId: null,
          aiGeneration: null,
        })),
        update: vi.fn(async () => ({})),
      },
      stemFigureRevision: {
        findFirstOrThrow: vi.fn(async () => ({
          id: pendingRevisionId,
          sourceHash: null,
          sourceVersion: 1,
          status: "FAILED",
        })),
        update: vi.fn(async () => ({})),
      },
      backgroundJob: {
        findFirst: vi.fn(async () => ({ id: failedJobId })),
        findUnique: vi.fn(async () => null),
        create: vi.fn(async ({ data }: { data: { idempotencyKey: string } }) => ({
          id: "new-job-id",
          status: "QUEUED",
          idempotencyKey: data.idempotencyKey,
        })),
      },
      $transaction: vi.fn(async (callback: (transaction: unknown) => unknown) =>
        callback(prisma),
      ),
    };
    const queue = { enqueue: vi.fn(async () => undefined) };
    const service = new StemFigureJobService(
      prisma as never,
      queue as never,
      { get: vi.fn(() => 0) } as never,
    );

    await service.enqueue(figureId, null, {
      revisionId: pendingRevisionId,
      trigger: "MANUAL_SOURCE_RETRY",
    });

    expect(prisma.backgroundJob.findUnique).toHaveBeenCalledWith({
      where: {
        idempotencyKey: expect.stringContaining(`MANUAL_SOURCE_RETRY:${failedJobId}`),
      },
      select: { id: true, status: true },
    });
    expect(queue.enqueue).toHaveBeenCalledWith("new-job-id");
  });

  it("rejects a raster upload whose declared MIME disagrees with decoded bytes", async () => {
    const figure = {
      id: figureId,
      currentRevisionId,
      pendingRevisionId: null,
      currentRevision: revision({ id: currentRevisionId, sourceVersion: 1 }),
      pendingRevision: null,
    };
    const storage = { uploadBuffer: vi.fn() };
    const service = new StemFiguresService(
      { stemFigure: { findFirst: vi.fn(async () => figure) } } as never,
      {
        get: vi.fn((key: string) => (key === "MAX_IMAGE_UPLOAD_MB" ? 10 : "test")),
      } as never,
      {} as never,
      storage as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const jpeg = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .jpeg()
      .toBuffer();

    await expect(
      service.replaceUpload(
        "00000000-0000-4000-8000-000000000034",
        figureId,
        "00000000-0000-4000-8000-000000000035",
        {
          buffer: jpeg,
          fieldname: "file",
          originalname: "mismatch.png",
          encoding: "7bit",
          mimetype: "image/png",
          size: jpeg.length,
        },
        {
          baseCurrentRevisionId: currentRevisionId,
          basePendingRevisionId: null,
          baseSourceVersion: 1,
        },
      ),
    ).rejects.toThrow("MIME khai báo không khớp");
    expect(storage.uploadBuffer).not.toHaveBeenCalled();
  });

  it("optionally enhances an OCR crop from history when the code revision omitted its snapshot", async () => {
    const sourceObjectKey = "document-images/page-050/figure-5-32.jpg";
    const snapshot = {
      version: 1,
      localPlanId: "F006",
      status: "resolved",
      assets: [
        {
          objectKey: sourceObjectKey,
          mimeType: "image/jpeg",
          label: "Hình 5.32",
          packetPageNumber: 9,
          source: "OCR_CROP",
        },
      ],
      references: [],
    };
    const figure = {
      id: figureId,
      status: "SUCCEEDED",
      currentRevisionId,
      pendingRevisionId: null,
      currentRevision: {
        ...revision({ id: currentRevisionId, sourceVersion: 1 }),
        referenceSnapshotJson: null,
        referenceSnapshotHash: null,
      },
      pendingRevision: null,
    };
    const jpeg = await sharp({
      create: {
        width: 16,
        height: 12,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .jpeg()
      .toBuffer();
    const transaction = {
      file: { create: vi.fn(async () => ({ id: "source-crop-file-id" })) },
      stemFigureRevision: {
        create: vi.fn(async () => ({ id: "source-crop-revision-id" })),
      },
      stemFigure: { update: vi.fn(async () => ({})) },
    };
    const prisma = {
      stemFigure: { findFirst: vi.fn(async () => figure) },
      stemFigureRevision: {
        findFirst: vi.fn(async (input: { where: Record<string, unknown> }) =>
          "referenceSnapshotHash" in input.where
            ? {
                referenceSnapshotJson: snapshot,
                referenceSnapshotHash: "snapshot-hash",
              }
            : { sourceVersion: 1 },
        ),
      },
      $transaction: vi.fn((callback) => callback(transaction)),
    };
    const storage = {
      fileProvider: "R2",
      bucketName: "test",
      downloadObject: vi.fn(async () => jpeg),
      createObjectKey: vi.fn(() => "figures/source-crop.webp"),
      uploadBuffer: vi.fn(async () => undefined),
      deleteObject: vi.fn(async () => undefined),
      getPublicUrl: vi.fn(() => "https://assets.test/source-crop.webp"),
    };
    const service = new StemFiguresService(
      prisma as never,
      {
        get: vi.fn((key: string) => (key === "MAX_IMAGE_UPLOAD_MB" ? 10 : "test")),
      } as never,
      { resolveAccessUrl: vi.fn() } as never,
      storage as never,
      {} as never,
      {} as never,
      {} as never,
    );
    vi.spyOn(service, "getForAdmin").mockResolvedValue({ id: figureId } as never);

    await service.useSourceCrop(
      "00000000-0000-4000-8000-000000000034",
      figureId,
      "00000000-0000-4000-8000-000000000035",
      {
        baseCurrentRevisionId: currentRevisionId,
        basePendingRevisionId: null,
        baseSourceVersion: 1,
        sourceSnapshotHash: "snapshot-hash",
        sourceObjectKey,
        enhance: false,
      },
    );

    expect(transaction.file.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadataJson: expect.not.objectContaining({
            rasterCleanupPipelineVersion: expect.anything(),
            rasterCleanupOperations: expect.anything(),
            automaticEnhancement: expect.anything(),
          }),
        }),
      }),
    );

    await service.useSourceCrop(
      "00000000-0000-4000-8000-000000000034",
      figureId,
      "00000000-0000-4000-8000-000000000035",
      {
        baseCurrentRevisionId: currentRevisionId,
        basePendingRevisionId: null,
        baseSourceVersion: 1,
        sourceSnapshotHash: "snapshot-hash",
        sourceObjectKey,
        enhance: true,
      },
    );

    expect(storage.downloadObject).toHaveBeenCalledWith(sourceObjectKey);
    expect(transaction.file.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadataJson: expect.objectContaining({
            uploadSource: "stem-figure.use-source-crop",
            textbookSourceObjectKey: sourceObjectKey,
            rasterCleanupPipelineVersion: "TEXTBOOK_RASTER_CLEANUP_V2",
            rasterCleanupOperations: ["ENHANCE"],
            automaticEnhancement: true,
          }),
        }),
      }),
    );
    expect(transaction.stemFigureRevision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceKind: "ADMIN_UPLOAD",
          referenceSnapshotJson: snapshot,
          referenceSnapshotHash: "snapshot-hash",
        }),
      }),
    );
    expect(transaction.stemFigure.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pendingRevisionId: null }),
      }),
    );
  });

  it("rejects an oversized full diagnostic payload before a paid provider call", async () => {
    const provider = { generateStructured: vi.fn() };
    const service = new StemFigureRepairService(
      provider as never,
      { get: vi.fn(() => 40) } as never,
    );
    const diagnosticBatch = createStemFigureDiagnosticBatch({
      attemptId: "00000000-0000-4000-8000-000000000036",
      sourceVersion: 1,
      sourceHash: "a".repeat(64),
      category: "COMPILER",
      issues: [{ code: "TEX_ERROR", message: "x".repeat(200) }],
      rawLogExcerpt: "x".repeat(200),
      collectionComplete: true,
    });

    await expect(
      service.repair({
        figureId,
        revisionId: pendingRevisionId,
        aiGenerationId: null,
        backgroundJobId: "00000000-0000-4000-8000-000000000037",
        jobAttempt: 1,
        repairNumber: 1,
        repairKind: "AUTO_COMPILER",
        latexSource: "a".repeat(30),
        diagnosticBatch,
        subject: { key: "MATH", name: "Toán", slug: "toan" },
      }),
    ).rejects.toThrow("STEM_FIGURE_RETRY_DIAGNOSTICS_TOO_LARGE");
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("hydrates only the current delivery asset for students and strips edit data", () => {
    expect(studentLessonSummarySelect.stemFigures.where).toMatchObject({
      deletedAt: null,
      currentRevision: {
        is: { status: "SUCCEEDED", deliveryFileId: { not: null } },
      },
    });
    const result = serializeStudentLessonSummary(
      {
        id: "summary-id",
        lessonId: "lesson-id",
        contentJson: {
          type: "lesson_summary_blocks",
          version: 3,
          data: {
            sections: [
              {
                blocks: [
                  {
                    type: "knowledge",
                    figures: [
                      {
                        kind: "TEX_FIGURE",
                        figureId,
                        figureOrigin: "TEXTBOOK_SOURCE",
                        latexSource: "must not leak",
                        previewSvg: "must not leak",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
        source: "AI",
        reviewStatus: ReviewStatus.APPROVED,
        updatedAt: new Date("2026-08-12T00:00:00.000Z"),
        deletedAt: null,
        stemFigures: [
          {
            id: figureId,
            status: StemFigureStatus.FAILED,
            currentRevision: {
              altText: "Hình hiện hành",
              caption: "Caption hiện hành",
              deliveryFile: { objectKey: "current.svg", publicUrl: null },
            },
          },
        ],
      } as never,
      new Map([[figureId, "https://assets.test/current.svg"]]),
    );

    expect(result).toMatchObject({
      contentJson: {
        data: {
          sections: [
            {
              blocks: [
                {
                  figures: [
                    {
                      kind: "TEX_FIGURE",
                      figureId,
                      status: "SUCCEEDED",
                      altText: "Hình hiện hành",
                      caption: "Caption hiện hành",
                      assetUrl: "https://assets.test/current.svg",
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).toContain("https://assets.test/current.svg");
    expect(serialized).not.toContain("latexSource");
    expect(serialized).not.toContain("previewSvg");
  });
});

function revision(
  overrides: Partial<{
    id: string;
    status: string;
    origin: string;
    sourceVersion: number;
    latexSource: string;
    sourceHash: string | null;
    altText: string;
    caption: string | null;
    deliveryFile: { objectKey: string; publicUrl: string | null } | null;
    lastErrorCategory: string | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
  }> = {},
) {
  return {
    id: overrides.id ?? pendingRevisionId,
    sourceKind: "AI_TEX",
    origin: overrides.origin ?? "ADMIN_EDIT",
    status: overrides.status ?? "FAILED",
    latexSource: overrides.latexSource === undefined ? "source" : overrides.latexSource,
    sourceHash:
      overrides.sourceHash === undefined ? "a".repeat(64) : overrides.sourceHash,
    sourceVersion: overrides.sourceVersion ?? 1,
    altText: overrides.altText ?? "Hình",
    caption: overrides.caption ?? null,
    previewSvg: null,
    deliveryFileId: overrides.deliveryFile ? "file-id" : null,
    deliveryFile: overrides.deliveryFile ?? null,
    sanitizedSvgHash: null,
    rendererVersion: null,
    validatorVersion: null,
    repairCount: 0,
    maxRepairAttempts: 2,
    referenceSnapshotJson: {
      version: 1,
      localPlanId: "F001",
      status: "not_found",
      assets: [],
      references: [],
    },
    referenceSnapshotHash: null,
    generationBriefHash: null,
    lastErrorCategory: overrides.lastErrorCategory ?? null,
    lastErrorCode: overrides.lastErrorCode ?? null,
    lastErrorMessage: overrides.lastErrorMessage ?? null,
    createdAt: new Date("2026-08-12T00:00:00.000Z"),
    finishedAt: null,
    attempts: [],
  };
}

function ensureSummaryRecord() {
  return {
    id: "00000000-0000-4000-8000-000000000036",
    aiGenerationId: null,
    lesson: {
      learningPath: { domain: { name: "Toán", slug: "toan" } },
    },
    contentJson: {
      type: "lesson_summary_blocks",
      data: {
        lessonId: "00000000-0000-4000-8000-000000000034",
        targetGrade: 12,
        title: "Bài kiểm thử",
        objectives: ["Đọc được hình minh họa."],
        sections: [
          {
            order: 1,
            displayHeading: "Tam giác",
            sourceEvidence: {
              kind: "HEADING",
              text: "Tam giác",
              packetPageNumbers: [1],
            },
            blocks: [
              {
                type: "knowledge",
                title: "Tam giác ABC",
                content: "Tam giác ABC",
                sourcePageNumbers: [1],
                figures: [],
              },
            ],
          },
          {
            order: 2,
            displayHeading: "Bài tập vận dụng",
            sourceEvidence: {
              kind: "HEADING",
              text: "Bài tập vận dụng",
              packetPageNumbers: [1],
            },
            blocks: [
              {
                type: "example",
                origin: "AI_AUTHORED",
                problem: "Nêu tên ba đỉnh.",
                solution: "Ba đỉnh là A, B, C.",
                answer: "A, B, C.",
                sourcePageNumbers: [],
                figures: [],
              },
            ],
          },
        ],
      },
    },
  };
}
