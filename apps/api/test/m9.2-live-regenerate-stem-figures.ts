/**
 * Paid, mutating live harness for regenerating a small explicit set of figures.
 *
 * The guard env var and explicit UUID list make accidental bulk regeneration
 * impossible. Each figure keeps its optimistic-concurrency head and uses its
 * exact textbook crop through the production create-new-AI service.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { NestFactory } from "@nestjs/core";
import { UserRole } from "@prisma/client";

import { AppModule } from "#api/app.module";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { StemFigureReferenceImageMode } from "#api/modules/stem-figures/dto/stem-figure-mutation-guard.dto";
import { StemFiguresService } from "#api/modules/stem-figures/services/stem-figures.service";

const TERMINAL_JOB_STATUSES = new Set(["SUCCEEDED", "FAILED", "CANCELLED"]);

async function main() {
  if (process.env.RUN_M9_2_LIVE_REGENERATE_FIGURES !== "1") {
    throw new Error(
      "Set RUN_M9_2_LIVE_REGENERATE_FIGURES=1 to authorize paid persisted regeneration.",
    );
  }
  const lessonId = requiredEnv("M9_2_LIVE_LESSON_ID");
  const figureIds = requiredEnv("M9_2_LIVE_FIGURE_IDS")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (figureIds.length === 0 || figureIds.length > 5) {
    throw new Error("M9_2_LIVE_FIGURE_IDS must contain between 1 and 5 UUIDs.");
  }
  const outputDirectory = resolve(
    process.cwd(),
    process.env.M9_2_LIVE_OUTPUT_DIRECTORY ??
      "../../.codex/artifacts/m9-2-terra-live-b15/persisted-label-clearance-v32",
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });
  const prisma = app.get(PrismaService);
  const figures = app.get(StemFiguresService);

  try {
    const actor = await prisma.user.findFirst({
      where: { role: UserRole.ADMIN, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!actor) throw new Error("No active ADMIN user is available for the audit trail.");

    const queued = [];
    for (const figureId of figureIds) {
      const figure = await prisma.stemFigure.findFirstOrThrow({
        where: { id: figureId, lessonId, deletedAt: null },
        select: {
          id: true,
          status: true,
          currentRevisionId: true,
          pendingRevisionId: true,
          currentRevision: { select: { sourceVersion: true } },
          pendingRevision: { select: { sourceVersion: true } },
        },
      });
      if (["QUEUED", "RENDERING", "REPAIRING"].includes(figure.status)) {
        throw new Error(`Figure ${figure.id} is busy (${figure.status}).`);
      }
      const working = figure.pendingRevision ?? figure.currentRevision;
      if (!working) throw new Error(`Figure ${figure.id} has no revision head.`);
      const job = await figures.createNewAi(lessonId, figure.id, actor.id, {
        baseCurrentRevisionId: figure.currentRevisionId,
        basePendingRevisionId: figure.pendingRevisionId,
        baseSourceVersion: working.sourceVersion,
        referenceImageMode: StemFigureReferenceImageMode.SOURCE_CROP_ONLY,
        adminInstructions: null,
      });
      queued.push({ figureId: figure.id, jobId: job.jobId });
    }

    const deadline = Date.now() + 5 * 60_000;
    while (Date.now() < deadline) {
      const jobs = await prisma.backgroundJob.findMany({
        where: { id: { in: queued.map((item) => item.jobId) } },
        select: { id: true, status: true, errorMessage: true },
      });
      if (
        jobs.length === queued.length &&
        jobs.every((job) => TERMINAL_JOB_STATUSES.has(job.status))
      ) {
        break;
      }
      await sleep(1_000);
    }

    const jobs = await prisma.backgroundJob.findMany({
      where: { id: { in: queued.map((item) => item.jobId) } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        status: true,
        errorMessage: true,
        providerUsageEvents: {
          select: {
            status: true,
            promptTokens: true,
            cachedInputTokens: true,
            completionTokens: true,
            totalTokens: true,
            costVnd: true,
            catalogItem: { select: { displayName: true } },
          },
        },
      },
    });
    const persisted = await prisma.stemFigure.findMany({
      where: { id: { in: figureIds } },
      orderBy: [{ blockPath: "asc" }, { figureIndex: "asc" }],
      select: {
        id: true,
        status: true,
        currentRevisionId: true,
        pendingRevisionId: true,
        currentRevision: {
          select: {
            id: true,
            sourceVersion: true,
            status: true,
            origin: true,
            repairCount: true,
            providerRequestSnapshotsJson: true,
            deliveryFile: { select: { objectKey: true } },
            attempts: {
              orderBy: { attemptNumber: "asc" },
              select: {
                attemptNumber: true,
                kind: true,
                status: true,
                errorCategory: true,
                errorCode: true,
              },
            },
          },
        },
      },
    });
    const result = {
      lessonId,
      queued,
      jobs,
      figures: persisted,
      totalCostVnd: jobs.reduce(
        (sum, job) =>
          sum + job.providerUsageEvents.reduce((jobSum, usage) => jobSum + usage.costVnd, 0),
        0,
      ),
    };
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(
      resolve(outputDirectory, "regeneration-result.json"),
      `${JSON.stringify(result, null, 2)}\n`,
      "utf8",
    );
    process.stdout.write(
      `${JSON.stringify({
        jobStatuses: jobs.map((job) => job.status),
        figureStatuses: persisted.map((figure) => figure.status),
        totalCostVnd: result.totalCostVnd,
        outputDirectory,
      })}\n`,
    );
    if (
      jobs.some((job) => job.status !== "SUCCEEDED") ||
      persisted.some(
        (figure) =>
          figure.status !== "SUCCEEDED" ||
          figure.pendingRevisionId !== null ||
          figure.currentRevision?.repairCount !== 0 ||
          figure.currentRevision.attempts.length !== 1 ||
          figure.currentRevision.attempts[0]?.kind !== "ADMIN_REGENERATE" ||
          figure.currentRevision.attempts[0]?.status !== "SUCCEEDED",
      )
    ) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function sleep(milliseconds: number) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

void main();
