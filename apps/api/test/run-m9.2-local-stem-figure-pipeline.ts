import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NestFactory } from "@nestjs/core";
import { BackgroundJobStatus, StemFigureStatus, UserRole } from "@prisma/client";

import { AppModule } from "#api/app.module";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";
import { StemFigureJobService } from "#api/modules/stem-figures/services/stem-figure-job.service";

const latexSource = String.raw`\begin{tikzpicture}[scale=1.05]
  \draw[->,thick] (-0.3,0) -- (4.5,0) node[right] {$x$};
  \draw[->,thick] (0,-0.3) -- (0,3.5) node[above] {$y$};
  \draw[very thick,blue] (0.4,0.5) -- (3.8,2.9);
  \fill (0.4,0.5) circle (2pt) node[below right] {$A$};
  \fill (3.8,2.9) circle (2pt) node[above left] {$B$};
  \draw[dashed] (3.8,0) -- (3.8,2.9);
\end{tikzpicture}`;

async function main() {
  const application = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });
  const prisma = application.get(PrismaService, { strict: false });
  const jobs = application.get(StemFigureJobService, { strict: false });
  const storage = application.get(ObjectStorageService, { strict: false });
  let figureId: string | null = null;
  let jobId: string | null = null;

  try {
    const [lesson, admin] = await Promise.all([
      prisma.lesson.findFirst({
        where: {
          deletedAt: null,
          learningPath: { deletedAt: null, domain: { slug: { contains: "toan" } } },
        },
        select: { id: true },
      }),
      prisma.user.findFirst({
        where: { role: UserRole.ADMIN, deletedAt: null },
        select: { id: true },
      }),
    ]);
    if (!lesson || !admin) {
      throw new Error("Local seed must contain one Math lesson and one admin user.");
    }

    const sourceHash = StemFigureJobService.sourceHash(latexSource);
    const created = await prisma.$transaction(async (transaction) => {
      const figure = await transaction.stemFigure.create({
        data: {
          lessonId: lesson.id,
          blockPath: "__m9.2_local_pipeline__",
          subjectKey: "MATH",
          subjectName: "Toán",
          subjectSlug: "toan",
          status: "QUEUED",
          theme: "LIGHT",
          createdById: admin.id,
        },
        select: { id: true },
      });
      const revision = await transaction.stemFigureRevision.create({
        data: {
          stemFigureId: figure.id,
          sourceKind: "AI_TEX",
          origin: "INITIAL_AI",
          status: "QUEUED",
          latexSource,
          sourceHash,
          sourceVersion: 1,
          altText: "Đoạn thẳng AB trên hệ trục tọa độ",
          caption: "Pipeline local M9.2",
          createdById: admin.id,
        },
        select: { id: true },
      });
      await transaction.stemFigure.update({
        where: { id: figure.id },
        data: { pendingRevisionId: revision.id },
      });
      return { figureId: figure.id, revisionId: revision.id, adminId: admin.id };
    });
    figureId = created.figureId;
    const job = await jobs.enqueue(created.figureId, created.adminId, {
      revisionId: created.revisionId,
      trigger: "INITIAL",
    });
    jobId = job.id;

    const durableJob = await waitForJob(prisma, job.id);
    if (durableJob.status !== BackgroundJobStatus.SUCCEEDED) {
      throw new Error(`Local render job failed: ${durableJob.errorMessage ?? "unknown"}`);
    }
    const figure = await prisma.stemFigure.findUniqueOrThrow({
      where: { id: created.figureId },
      select: {
        status: true,
        currentRevisionId: true,
        pendingRevisionId: true,
        currentRevision: {
          select: {
            status: true,
            deliveryFile: { select: { id: true, objectKey: true } },
          },
        },
      },
    });
    if (
      figure.status !== StemFigureStatus.SUCCEEDED ||
      figure.currentRevision?.status !== "SUCCEEDED" ||
      !figure.currentRevision.deliveryFile ||
      figure.pendingRevisionId !== null
    ) {
      throw new Error(`Unexpected promoted figure state: ${JSON.stringify(figure)}`);
    }
    const svg = await storage.downloadObject(
      figure.currentRevision.deliveryFile.objectKey,
    );
    if (!svg.toString("utf8").includes("<svg")) {
      throw new Error("Promoted delivery object is not an SVG.");
    }
    const outputDirectory = process.env.M9_2_LOCAL_OUTPUT_DIR;
    if (outputDirectory) {
      await mkdir(outputDirectory, { recursive: true });
      await writeFile(join(outputDirectory, "local-worker-pipeline.svg"), svg);
    }
    process.stdout.write(
      `${JSON.stringify({
        figureId: created.figureId,
        revisionId: figure.currentRevisionId,
        jobId: job.id,
        status: figure.status,
        svgBytes: svg.length,
      })}\n`,
    );
  } finally {
    if (process.env.M9_2_KEEP_FIXTURE !== "true") {
      await cleanup(prisma, storage, figureId, jobId);
    }
    await application.close();
  }
}

async function waitForJob(prisma: PrismaService, jobId: string) {
  const deadline = Date.now() + 60_000;
  for (;;) {
    const job = await prisma.backgroundJob.findUniqueOrThrow({
      where: { id: jobId },
      select: { status: true, errorMessage: true },
    });
    if (
      job.status === BackgroundJobStatus.SUCCEEDED ||
      job.status === BackgroundJobStatus.FAILED ||
      job.status === BackgroundJobStatus.CANCELLED
    ) {
      return job;
    }
    if (Date.now() >= deadline) throw new Error("Timed out waiting for render job.");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

async function cleanup(
  prisma: PrismaService,
  storage: ObjectStorageService,
  figureId: string | null,
  jobId: string | null,
) {
  if (!figureId) return;
  const files = await prisma.file.findMany({
    where: {
      metadataJson: { path: ["figureId"], equals: figureId },
    },
    select: { id: true, objectKey: true },
  });
  if (jobId) {
    await prisma.backgroundJob.deleteMany({ where: { id: jobId } });
  }
  await prisma.stemFigure.deleteMany({ where: { id: figureId } });
  await Promise.all(files.map((file) => storage.deleteObject(file.objectKey)));
  await prisma.file.deleteMany({ where: { id: { in: files.map((file) => file.id) } } });
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
