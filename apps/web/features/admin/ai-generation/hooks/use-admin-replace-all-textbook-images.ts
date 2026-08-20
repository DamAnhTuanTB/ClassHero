"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  applyAdminStemFigureRasterEdit,
  promoteAdminStemFigureSourceCrop,
} from "@/features/admin/ai-generation/api/admin-ai-generation-api";
import { adminAiGenerationQueryKeys } from "@/features/admin/ai-generation/hooks/use-admin-ai-generation";
import type { AdminStemFigure } from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";

const BULK_REPLACE_CONCURRENCY = 3;

export interface TextbookImageBulkReplaceItem {
  figure: AdminStemFigure;
  sourceObjectKey: string;
}

export interface TextbookImageBulkReplacePlan {
  eligibleItems: TextbookImageBulkReplaceItem[];
  initialAiImageCount: number;
  skippedAmbiguousCount: number;
  skippedBusyCount: number;
  skippedMissingCount: number;
}

export interface TextbookImageBulkReplaceResult {
  failedCount: number;
  succeededCount: number;
}

export function createTextbookImageBulkReplacePlan(
  figures: AdminStemFigure[],
): TextbookImageBulkReplacePlan {
  const plan: TextbookImageBulkReplacePlan = {
    eligibleItems: [],
    initialAiImageCount: 0,
    skippedAmbiguousCount: 0,
    skippedBusyCount: 0,
    skippedMissingCount: 0,
  };

  for (const figure of figures) {
    if (
      !figure.hasCurrentAsset ||
      figure.currentAssetKind !== "AI_TEX" ||
      figure.currentRevisionOrigin !== "INITIAL_AI"
    ) {
      continue;
    }
    plan.initialAiImageCount += 1;

    if (
      figure.pendingRevisionId !== null ||
      ["QUEUED", "RENDERING", "REPAIRING"].includes(figure.status)
    ) {
      plan.skippedBusyCount += 1;
      continue;
    }

    const usableSourceImages = figure.sourceReferenceImages.filter(
      (image) => image.canUseAsFigure,
    );
    if (usableSourceImages.length === 0) {
      plan.skippedMissingCount += 1;
      continue;
    }
    if (usableSourceImages.length > 1) {
      plan.skippedAmbiguousCount += 1;
      continue;
    }
    const sourceImage = usableSourceImages[0];
    if (!sourceImage) {
      plan.skippedMissingCount += 1;
      continue;
    }

    plan.eligibleItems.push({
      figure,
      sourceObjectKey: sourceImage.objectKey,
    });
  }

  return plan;
}

export function useAdminReplaceAllTextbookImages(lessonId: string) {
  const session = useAuthSessionStore((state) => state.session);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      items,
      onProgress,
    }: {
      items: TextbookImageBulkReplaceItem[];
      onProgress?: (completedCount: number) => void;
    }): Promise<TextbookImageBulkReplaceResult> => {
      let completedCount = 0;
      let failedCount = 0;
      let succeededCount = 0;
      const token = session?.accessToken ?? "";

      await runWithConcurrency(items, BULK_REPLACE_CONCURRENCY, async (item) => {
        try {
          const sourceFigure = await promoteAdminStemFigureSourceCrop(
            lessonId,
            item.figure,
            item.sourceObjectKey,
            false,
            token,
          );
          await applyAdminStemFigureRasterEdit(
            lessonId,
            {
              figure: sourceFigure,
              operations: {
                enhance: true,
                removeSimpleDetails: false,
                pipelineVersion: "TEXTBOOK_RASTER_CLEANUP_V2",
              },
              mask: null,
            },
            token,
          );
          succeededCount += 1;
        } catch {
          failedCount += 1;
        } finally {
          completedCount += 1;
          onProgress?.(completedCount);
        }
      });

      return { failedCount, succeededCount };
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: adminAiGenerationQueryKeys.stemFigures(lessonId),
        }),
        queryClient.invalidateQueries({
          queryKey: adminAiGenerationQueryKeys.summary(lessonId),
        }),
        queryClient.invalidateQueries({
          queryKey: adminAiGenerationQueryKeys.panel(lessonId),
        }),
      ]);
    },
  });
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  runItem: (item: T) => Promise<void>,
) {
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  async function runWorker() {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      if (item === undefined) continue;
      await runItem(item);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
}
