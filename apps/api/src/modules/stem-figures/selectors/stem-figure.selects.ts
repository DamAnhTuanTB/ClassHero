import { Prisma } from "@prisma/client";

const revisionSelect = {
  id: true,
  sourceKind: true,
  origin: true,
  status: true,
  latexSource: true,
  sourceHash: true,
  sourceVersion: true,
  altText: true,
  caption: true,
  previewSvg: true,
  deliveryFileId: true,
  deliveryFile: {
    select: { objectKey: true, publicUrl: true, mimeType: true, metadataJson: true },
  },
  sanitizedSvgHash: true,
  rendererVersion: true,
  validatorVersion: true,
  repairCount: true,
  maxRepairAttempts: true,
  referenceSnapshotJson: true,
  referenceSnapshotHash: true,
  generationBriefHash: true,
  providerRequestSnapshotsJson: true,
  lastErrorCategory: true,
  lastErrorCode: true,
  lastErrorMessage: true,
  createdAt: true,
  finishedAt: true,
  attempts: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      sourceVersion: true,
      errorCategory: true,
      errorCode: true,
      diagnosticBatch: true,
      diagnosticBatchHash: true,
      collectionComplete: true,
      createdAt: true,
      backgroundJob: {
        select: {
          providerUsageEvents: {
            where: { provider: "OPENAI", status: "SUCCEEDED" },
            select: { id: true, cachedInputTokens: true, costVnd: true },
          },
        },
      },
    },
  },
} satisfies Prisma.StemFigureRevisionSelect;

export const stemFigureSelect = {
  id: true,
  lessonId: true,
  lessonSummaryId: true,
  aiGenerationId: true,
  blockPath: true,
  figureIndex: true,
  localPlanId: true,
  planJson: true,
  subjectKey: true,
  subjectName: true,
  subjectSlug: true,
  status: true,
  theme: true,
  currentRevisionId: true,
  currentRevision: { select: revisionSelect },
  pendingRevisionId: true,
  pendingRevision: { select: revisionSelect },
  revisions: {
    orderBy: { createdAt: "desc" as const },
    take: 20,
    select: {
      providerRequestSnapshotsJson: true,
      referenceSnapshotJson: true,
      referenceSnapshotHash: true,
    },
  },
  lastErrorCategory: true,
  lastErrorCode: true,
  lastErrorMessage: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.StemFigureSelect;

export type StemFigureRecord = Prisma.StemFigureGetPayload<{
  select: typeof stemFigureSelect;
}>;
