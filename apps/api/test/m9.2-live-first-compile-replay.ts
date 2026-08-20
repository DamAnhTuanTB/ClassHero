/**
 * Read-only live replay for raw AI TeX sources.
 *
 * It sends each untouched model source to the real isolated renderer exactly
 * once through the snippet-only renderer contract. It never mutates the DB and
 * never calls an AI provider.
 *
 * Usage:
 *   STEM_FIGURE_LIVE_GENERATION_ID=<uuid> \
 *   pnpm --filter @learning-path/api exec tsx test/m9.2-live-first-compile-replay.ts
 */
import { resolve } from "node:path";
import { ConfigService } from "@nestjs/config";
import { config } from "dotenv";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { validateEnv, type EnvConfig } from "#api/config/env.validation";
import { lessonSummarySubjectKeySchema } from "#api/modules/ai/types/lesson-summary-subject.types";
import { TexRendererClientService } from "#api/modules/stem-figures/services/tex-renderer-client.service";

async function main() {
  config({ path: resolve(process.cwd(), ".env"), quiet: true });
  process.env.TEX_RENDERER_URL ??= "http://127.0.0.1:8080";
  const generationId = process.env.STEM_FIGURE_LIVE_GENERATION_ID;
  if (!generationId) {
    throw new Error("STEM_FIGURE_LIVE_GENERATION_ID is required.");
  }

  const env = validateEnv(process.env);
  const configService = new ConfigService<EnvConfig, true>(env, true);
  const prisma = new PrismaService(configService);
  const renderer = new TexRendererClientService(configService);
  try {
    const figures = await prisma.stemFigure.findMany({
      where: { aiGenerationId: generationId },
      orderBy: [{ blockPath: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        blockPath: true,
        subjectKey: true,
        pendingRevision: { select: { latexSource: true } },
        currentRevision: { select: { latexSource: true } },
      },
    });
    if (figures.length === 0) {
      throw new Error(`No STEM figures found for generation ${generationId}.`);
    }

    const results = [];
    for (const figure of figures) {
      const source =
        figure.pendingRevision?.latexSource ?? figure.currentRevision?.latexSource;
      if (!source) {
        results.push({
          figureId: figure.id,
          blockPath: figure.blockPath,
          ok: false,
          code: "SOURCE_MISSING",
        });
        continue;
      }
      const subjectKey = lessonSummarySubjectKeySchema.parse(figure.subjectKey);
      const rendered = await renderer.render(source, subjectKey);
      results.push({
        figureId: figure.id,
        blockPath: figure.blockPath,
        ok: rendered.ok,
        code: rendered.ok ? null : rendered.code,
        issueCount: rendered.ok ? 0 : rendered.issues.length,
      });
    }

    const failed = results.filter((result) => !result.ok);
    console.log(
      JSON.stringify(
        {
          generationId,
          total: results.length,
          firstCompileSucceeded: results.length - failed.length,
          firstCompileFailed: failed.length,
          firstCompileSuccessRate:
            results.length === 0 ? 0 : (results.length - failed.length) / results.length,
          results,
        },
        null,
        2,
      ),
    );
    if (failed.length > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
