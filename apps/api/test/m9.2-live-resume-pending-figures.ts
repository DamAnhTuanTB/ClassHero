/**
 * Explicit live-test recovery helper for an already persisted summary whose
 * INITIAL figure jobs were not enqueued. It does not call a provider itself;
 * it creates the durable jobs that the worker then processes normally.
 *
 * Usage:
 *   STEM_FIGURE_LIVE_LESSON_ID=<uuid> \
 *   pnpm --filter @learning-path/api exec tsx test/m9.2-live-resume-pending-figures.ts
 */
import { NestFactory } from "@nestjs/core";

import { AppModule } from "#api/app.module";
import { PrismaService } from "#api/common/prisma/prisma.service";
import {
  lessonSummaryOutputSchema,
  stemFigureRenderPlanSchema,
} from "#api/modules/ai/types/lesson-summary.types";
import type { FigureReferenceSnapshot } from "#api/modules/stem-figures/services/figure-reference-resolver.service";
import { StemFigureJobService } from "#api/modules/stem-figures/services/stem-figure-job.service";
import { buildStemFigureGenerationBrief } from "#api/modules/stem-figures/utils/stem-figure-generation-brief";

async function main() {
  const lessonId = process.env.STEM_FIGURE_LIVE_LESSON_ID;
  if (!lessonId) throw new Error("STEM_FIGURE_LIVE_LESSON_ID is required.");
  const application = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  const prisma = application.get(PrismaService, { strict: false });
  const jobs = application.get(StemFigureJobService, { strict: false });
  try {
    const summary = await prisma.lessonSummary.findUniqueOrThrow({
      where: { lessonId },
      select: { contentJson: true },
    });
    const envelope = asRecord(summary.contentJson);
    const output = lessonSummaryOutputSchema.parse(envelope.data);
    const figures = await prisma.stemFigure.findMany({
      where: {
        lessonId,
        deletedAt: null,
        status: "QUEUED",
        pendingRevision: { latexSource: null },
      },
      orderBy: [{ blockPath: "asc" }, { figureIndex: "asc" }],
      select: {
        id: true,
        blockPath: true,
        planJson: true,
        createdById: true,
        pendingRevision: {
          select: {
            id: true,
            referenceSnapshotJson: true,
            altText: true,
            caption: true,
          },
        },
      },
    });
    const queued = [];
    for (const figure of figures) {
      if (!figure.pendingRevision) continue;
      const plan = stemFigureRenderPlanSchema.parse(figure.planJson);
      const snapshot = figure.pendingRevision
        .referenceSnapshotJson as FigureReferenceSnapshot | null;
      const brief = buildStemFigureGenerationBrief({
        output,
        blockPath: figure.blockPath,
        plan,
        targetGrade: output.targetGrade ?? null,
        referenceAssets: snapshot?.assets ?? [],
        altText: figure.pendingRevision.altText,
        caption: figure.pendingRevision.caption,
      });
      const job = await jobs.enqueue(figure.id, figure.createdById, {
        revisionId: figure.pendingRevision.id,
        trigger: "INITIAL",
        generationBrief: brief,
      });
      queued.push({ figureId: figure.id, jobId: job.id, status: job.status });
    }
    console.log(JSON.stringify({ lessonId, queuedCount: queued.length, queued }, null, 2));
  } finally {
    await application.close();
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

void main();
