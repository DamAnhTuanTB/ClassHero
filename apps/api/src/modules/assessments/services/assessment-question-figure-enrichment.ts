import { BackgroundJobStatus, Prisma, ProviderUsageStatus } from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";
import type { FilesService } from "#api/modules/files/services/files.service";
import {
  quizFigureSelect,
  readQuizFigurePendingAiTargetMode,
  serializeQuizFigureAccessUrl,
} from "#api/modules/quiz-figures/services/quiz-figures.service";

type AssessmentFigure = Prisma.QuizFigureGetPayload<{
  select: typeof quizFigureSelect;
}>;

/**
 * Shared Admin presentation for Quiz and Test figures. Persistence ownership is
 * carried by the typed figure target; cost, pending mode and access URL must never
 * drift between the two assessment routes.
 */
export async function enrichAssessmentQuestionFigures(
  prisma: PrismaService,
  files: Pick<FilesService, "resolveAccessUrl"> | undefined,
  questions: Array<{ figures: AssessmentFigure[] }>,
) {
  const currentAssets = questions.flatMap((question) =>
    question.figures.flatMap((figure) => {
      const deliveryFileId = figure.currentRevision?.deliveryFile?.id;
      return deliveryFileId ? [{ figureId: figure.id, deliveryFileId }] : [];
    }),
  );
  const figureIds = [...new Set(currentAssets.map((asset) => asset.figureId))];
  const deliveryFileIds = [
    ...new Set(currentAssets.map((asset) => asset.deliveryFileId)),
  ];
  const activeFigureIds = [
    ...new Set(
      questions.flatMap((question) =>
        question.figures
          .filter((figure) =>
            ["QUEUED", "RENDERING", "REPAIRING"].includes(figure.status),
          )
          .map((figure) => figure.id),
      ),
    ),
  ];
  const [costAttempts, activeJobs] = await Promise.all([
    figureIds.length > 0
      ? prisma.quizFigureRenderAttempt.findMany({
          where: {
            quizFigureId: { in: figureIds },
            revision: { deliveryFileId: { in: deliveryFileIds } },
          },
          select: {
            quizFigureId: true,
            revision: { select: { deliveryFileId: true } },
            backgroundJob: {
              select: {
                providerUsageEvents: {
                  where: {
                    provider: "OPENAI",
                    status: ProviderUsageStatus.SUCCEEDED,
                  },
                  select: { id: true, cachedInputTokens: true, costVnd: true },
                },
              },
            },
          },
        })
      : Promise.resolve([]),
    activeFigureIds.length > 0
      ? prisma.backgroundJob.findMany({
          where: {
            resourceType: "QUIZ_FIGURE",
            resourceId: { in: activeFigureIds },
            status: {
              in: [BackgroundJobStatus.QUEUED, BackgroundJobStatus.RUNNING],
            },
          },
          orderBy: { createdAt: "desc" },
          select: { resourceId: true, inputMeta: true },
        })
      : Promise.resolve([]),
  ]);
  const usageByAsset = collectOpenAiFigureUsage(costAttempts);
  const pendingModeByFigureId = new Map<string, "QUESTION" | "SOLUTION">();
  for (const job of activeJobs) {
    if (!job.resourceId || pendingModeByFigureId.has(job.resourceId)) continue;
    const mode = readQuizFigurePendingAiTargetMode(job.inputMeta);
    if (mode) pendingModeByFigureId.set(job.resourceId, mode);
  }

  const result = new Map<string, Record<string, unknown>>();
  await Promise.all(
    questions.flatMap((question) =>
      question.figures.map(async (figure) => {
        const deliveryFileId = figure.currentRevision?.deliveryFile?.id;
        const usage = deliveryFileId
          ? usageByAsset.get(figureAssetKey(figure.id, deliveryFileId))
          : null;
        result.set(figure.id, {
          ...(await serializeQuizFigureAccessUrl(figure, files)),
          pendingAiTargetMode: pendingModeByFigureId.get(figure.id) ?? null,
          openAiGenerationCostVnd: usage?.costVnd ?? null,
          openAiCachedInputTokens: usage?.cachedInputTokens ?? null,
        });
      }),
    ),
  );
  return result;
}

function collectOpenAiFigureUsage(
  attempts: Array<{
    quizFigureId: string;
    revision: { deliveryFileId: string | null };
    backgroundJob: {
      providerUsageEvents: Array<{
        id: string;
        cachedInputTokens: number;
        costVnd: number;
      }>;
    } | null;
  }>,
) {
  const usage = new Map<string, { cachedInputTokens: number; costVnd: number }>();
  const eventIdsByAsset = new Map<string, Set<string>>();
  for (const attempt of attempts) {
    const deliveryFileId = attempt.revision.deliveryFileId;
    if (!deliveryFileId) continue;
    const key = figureAssetKey(attempt.quizFigureId, deliveryFileId);
    const seenEventIds = eventIdsByAsset.get(key) ?? new Set<string>();
    for (const event of attempt.backgroundJob?.providerUsageEvents ?? []) {
      if (seenEventIds.has(event.id)) continue;
      seenEventIds.add(event.id);
      const current = usage.get(key) ?? { cachedInputTokens: 0, costVnd: 0 };
      usage.set(key, {
        cachedInputTokens: current.cachedInputTokens + event.cachedInputTokens,
        costVnd: current.costVnd + event.costVnd,
      });
    }
    eventIdsByAsset.set(key, seenEventIds);
  }
  return usage;
}

function figureAssetKey(figureId: string, deliveryFileId: string) {
  return `${figureId}:${deliveryFileId}`;
}
