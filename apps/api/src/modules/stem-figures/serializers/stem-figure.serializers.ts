import { readStemFigureDisplayScale } from "@learning-path/shared";
import { parseStemFigureDiagnosticBatch } from "#api/modules/stem-figures/utils/stem-figure-diagnostics";
import type { FilesService } from "#api/modules/files/services/files.service";
import type { ObjectStorageService } from "#api/modules/files/services/object-storage.service";
import type { StemFigureRecord } from "#api/modules/stem-figures/selectors/stem-figure.selects";
import type { StemFigureProviderRequestSnapshotCollection } from "#api/modules/stem-figures/types/stem-figure-provider-request.types";
import type { FigureReferenceSnapshot } from "#api/modules/stem-figures/services/figure-reference-resolver.service";
import { readStemFigureOrigin } from "#api/modules/stem-figures/utils/stem-figure-summary-reference";

export async function serializeStemFigure(
  record: StemFigureRecord,
  filesService: FilesService,
  storage: ObjectStorageService,
  includeSource: boolean,
) {
  const current = record.currentRevision;
  const candidate = record.pendingRevision;
  const working = candidate ?? current;
  if (!working) {
    throw new Error(`STEM figure ${record.id} has no current or pending revision.`);
  }
  const latestAttempt = working?.attempts[0] ?? null;
  const diagnosticBatch = parseStemFigureDiagnosticBatch(latestAttempt?.diagnosticBatch);
  const status =
    candidate?.status === "DRAFT_READY" && current?.status === "SUCCEEDED"
      ? "SUCCEEDED"
      : record.status;
  const currentAssetFile = current?.deliveryFile ?? null;
  const assetUrl = await filesService.resolveAccessUrl(currentAssetFile);
  const currentOpenAiUsage = summarizeCurrentOpenAiUsage(current);
  const latestProviderSnapshots = (record.revisions ?? [])
    .map((revision) =>
      readProviderRequestSnapshots(revision.providerRequestSnapshotsJson),
    )
    .find((snapshot) => snapshot?.calls.some((call) => call.callKind === "CREATE_NEW"));
  const providerRequestSnapshots = includeSource
    ? await serializeProviderRequestSnapshots(
        latestProviderSnapshots ?? working.providerRequestSnapshotsJson,
        storage,
      )
    : null;
  const hidesDetachedAdminReferences =
    record.currentRevisionId === null &&
    working.origin === "ADMIN_EDIT" &&
    working.status === "DRAFT_READY";
  const sourceReferenceRevision = [working, ...(record.revisions ?? [])].find(
    (revision) =>
      Boolean(revision.referenceSnapshotHash) &&
      readReferenceSnapshot(revision.referenceSnapshotJson) !== null,
  );
  const sourceReferenceImages =
    includeSource && !hidesDetachedAdminReferences
      ? await serializeSourceReferenceImages(
          sourceReferenceRevision?.referenceSnapshotJson,
          storage,
        )
      : [];

  return {
    id: record.id,
    lessonId: record.lessonId,
    lessonSummaryId: record.lessonSummaryId,
    aiGenerationId: record.aiGenerationId,
    blockPath: record.blockPath,
    figureIndex: record.figureIndex,
    localPlanId: record.localPlanId,
    planJson: record.planJson,
    figureOrigin: readStemFigureOrigin(record.planJson) ?? null,
    subject: {
      key: record.subjectKey,
      name: record.subjectName,
      slug: record.subjectSlug,
    },
    status,
    theme: "LIGHT" as const,
    currentRevisionId: record.currentRevisionId,
    pendingRevisionId: record.pendingRevisionId,
    hasCurrentAsset: Boolean(assetUrl),
    sourceKind: current?.sourceKind ?? working.sourceKind,
    currentAssetKind: resolveStemFigureCurrentAssetKind(current),
    currentRevisionOrigin: current?.origin ?? null,
    openAiGenerationCostVnd: currentOpenAiUsage?.costVnd ?? null,
    openAiCachedInputTokens: currentOpenAiUsage?.cachedInputTokens ?? null,
    displayScale: readStemFigureDisplayScale(current?.latexSource),
    ...(includeSource ? { latexSource: working.latexSource } : {}),
    sourceHash: working.sourceHash,
    sourceVersion: working.sourceVersion,
    // The visible asset always uses metadata from the current revision. Candidate
    // source/diagnostics may advance independently while the old asset stays live.
    altText: current?.altText ?? working.altText,
    caption: current?.caption ?? working.caption,
    ...(includeSource ? { previewSvg: working.previewSvg } : {}),
    assetUrl,
    sanitizedSvgHash: working.sanitizedSvgHash,
    rendererVersion: working.rendererVersion,
    validatorVersion: working.validatorVersion,
    repairCount: working.repairCount,
    maxRepairAttempts: working.maxRepairAttempts,
    ...(includeSource
      ? {
          // Error metadata and diagnostics must always belong to the same revision.
          // Falling back to the logical figure can combine a stale failed draft with
          // the empty diagnostic batch of a newer successful draft.
          lastErrorCategory: working.lastErrorCategory,
          lastErrorCode: working.lastErrorCode,
          lastErrorMessage: working.lastErrorMessage,
          diagnosticBatch,
          retryUsesAi:
            (!working?.latexSource?.trim() &&
              !working?.sourceHash &&
              (working?.lastErrorCategory === "BUDGET" ||
                working?.lastErrorCategory === "PROVIDER_OUTPUT" ||
                working?.lastErrorCategory === "INFRASTRUCTURE")) ||
            diagnosticBatch?.category === "COMPILER" ||
            diagnosticBatch?.category === "VALIDATOR",
          retryIssueCount: diagnosticBatch?.issues.length ?? 0,
          latestAttemptId: latestAttempt?.id ?? null,
          providerRequestSnapshots,
          sourceReferenceSnapshotHash: hidesDetachedAdminReferences
            ? null
            : (sourceReferenceRevision?.referenceSnapshotHash ?? null),
          sourceReferenceImages,
        }
      : {}),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function summarizeCurrentOpenAiUsage(
  revision: StemFigureRecord["currentRevision"],
) {
  if (!revision?.deliveryFileId) return null;

  const eventIds = new Set<string>();
  let cachedInputTokens = 0;
  let costVnd = 0;

  for (const attempt of revision.attempts) {
    for (const event of attempt.backgroundJob?.providerUsageEvents ?? []) {
      if (eventIds.has(event.id)) continue;
      eventIds.add(event.id);
      cachedInputTokens += event.cachedInputTokens;
      costVnd += event.costVnd;
    }
  }

  return eventIds.size > 0 ? { cachedInputTokens, costVnd } : null;
}

export function resolveStemFigureCurrentAssetKind(
  revision: StemFigureRecord["currentRevision"],
): "AI_TEX" | "ADMIN_UPLOAD" | "TEXTBOOK_SOURCE" | null {
  if (!revision) return null;
  if (revision.sourceKind === "AI_TEX") return "AI_TEX";
  const metadata = revision.deliveryFile?.metadataJson;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "ADMIN_UPLOAD";
  }

  const record = metadata as Record<string, unknown>;
  const textbookSourceObjectKey = record.textbookSourceObjectKey;
  const uploadSource = record.uploadSource;
  const hasTextbookProvenance =
    (typeof textbookSourceObjectKey === "string" &&
      textbookSourceObjectKey.trim().length > 0) ||
    uploadSource === "stem-figure.use-source-crop" ||
    uploadSource === "lesson-summary.auto-source-crop";

  return hasTextbookProvenance ? "TEXTBOOK_SOURCE" : "ADMIN_UPLOAD";
}

async function serializeSourceReferenceImages(
  value: unknown,
  storage: ObjectStorageService,
) {
  const snapshot = readReferenceSnapshot(value);
  if (!snapshot) return [];
  return Promise.all(
    snapshot.assets.map(async (asset, index) => ({
      index,
      objectKey: asset.objectKey,
      mimeType: asset.mimeType,
      label: asset.label,
      packetPageNumber: asset.packetPageNumber,
      source: asset.source,
      canUseAsFigure: asset.source === "OCR_CROP",
      accessUrl: await storage.createSignedGetUrl(asset.objectKey).catch(() => null),
    })),
  );
}

function readReferenceSnapshot(value: unknown): FigureReferenceSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const snapshot = value as Partial<FigureReferenceSnapshot>;
  if (snapshot.version !== 1 || !Array.isArray(snapshot.assets)) return null;
  return snapshot as FigureReferenceSnapshot;
}

async function serializeProviderRequestSnapshots(
  value: unknown,
  storage: ObjectStorageService,
) {
  const collection = readProviderRequestSnapshots(value);
  if (!collection) return null;
  return {
    version: 1 as const,
    calls: await Promise.all(
      collection.calls.map(async (call) => ({
        ...call,
        referenceImages: await Promise.all(
          call.referenceImages.map(async (image) => ({
            order: image.order,
            objectKey: image.objectKey,
            mimeType: image.mimeType,
            label: image.label,
            packetPageNumber: image.packetPageNumber,
            source: image.source,
            detail: image.detail,
            byteLength: image.byteLength,
            sha256: image.sha256,
            accessUrl: await storage
              .createSignedGetUrl(image.objectKey)
              .catch(() => null),
          })),
        ),
      })),
    ),
  };
}

function readProviderRequestSnapshots(
  value: unknown,
): StemFigureProviderRequestSnapshotCollection | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const calls = (value as Record<string, unknown>).calls;
  if (!Array.isArray(calls)) return null;
  return { version: 1, calls } as StemFigureProviderRequestSnapshotCollection;
}
