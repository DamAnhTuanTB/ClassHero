import "dotenv/config";
import { ConfigService } from "@nestjs/config";
import {
  AiGenerationStatus,
  AiGenerationType,
  AiProviderName,
  BackgroundJobQueue,
  BackgroundJobStatus,
} from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";
import { AiGenerationLifecycleService } from "#api/modules/ai/services/ai-generation-lifecycle.service";

describe("M9.1 AI generation PostgreSQL lifecycle", () => {
  let prisma: PrismaService;
  let lifecycle: AiGenerationLifecycleService;
  let backgroundJobId: string;
  let aiGenerationId: string;

  beforeAll(async () => {
    prisma = new PrismaService(
      new ConfigService() as ConfigService<EnvConfig, true>,
    );
    await prisma.$connect();
    const backgroundJob = await prisma.backgroundJob.create({
      data: {
        queue: BackgroundJobQueue.AI_GENERATION,
        status: BackgroundJobStatus.QUEUED,
        maxAttempts: 3,
        inputMeta: { action: "M9_1_LIFECYCLE_TEST" },
      },
      select: { id: true },
    });
    const aiGeneration = await prisma.aiGeneration.create({
      data: {
        type: AiGenerationType.SUMMARY,
        status: AiGenerationStatus.QUEUED,
        backgroundJobId: backgroundJob.id,
        promptVersion: "m9.1-test-v1",
        schemaVersion: "m9.1-test-v1",
      },
      select: { id: true },
    });
    backgroundJobId = backgroundJob.id;
    aiGenerationId = aiGeneration.id;
    lifecycle = new AiGenerationLifecycleService(prisma);
  });

  afterAll(async () => {
    if (aiGenerationId) {
      await prisma.aiGeneration.deleteMany({ where: { id: aiGenerationId } });
    }
    if (backgroundJobId) {
      await prisma.backgroundJob.deleteMany({ where: { id: backgroundJobId } });
    }
    await prisma.$disconnect();
  });

  it("updates background_jobs and ai_generations through one durable lifecycle", async () => {
    const record = await lifecycle.load(backgroundJobId);
    const context = {
      backgroundJobId,
      aiGenerationId,
      type: record.aiGeneration.type,
      ownerUserId: null,
      lessonId: null,
      targetType: null,
      targetId: null,
      inputMeta: record.inputMeta,
      attempt: 1,
      maxAttempts: 3,
    };
    await lifecycle.markRunning(context, "bullmq-m9-1-test");
    const running = await prisma.backgroundJob.findUniqueOrThrow({
      where: { id: backgroundJobId },
      select: {
        status: true,
        attempts: true,
        aiGenerations: { select: { status: true } },
      },
    });
    expect(running.status).toBe(BackgroundJobStatus.RUNNING);
    expect(running.attempts).toBe(1);
    expect(running.aiGenerations[0]?.status).toBe(AiGenerationStatus.RUNNING);

    await lifecycle.markSucceeded(
      context,
      {
        action: "M9_1_LIFECYCLE_TEST",
        output: {
          data: { status: "ok" },
          provider: AiProviderName.OPENAI,
          model: "gpt-4.1-mini",
          providerRequestId: "test-request",
          usage: { promptTokens: 10, completionTokens: 4, totalTokens: 14 },
          latencyMs: 25,
        },
      },
      {
        resourceType: null,
        resourceId: null,
        message: "Lifecycle verified.",
      },
    );
    const succeeded = await prisma.backgroundJob.findUniqueOrThrow({
      where: { id: backgroundJobId },
      select: {
        status: true,
        result: true,
        aiGenerations: {
          select: {
            status: true,
            provider: true,
            model: true,
            totalTokens: true,
            outputHash: true,
            outputJson: true,
          },
        },
      },
    });
    expect(succeeded.status).toBe(BackgroundJobStatus.SUCCEEDED);
    expect(succeeded.result).toMatchObject({ status: "SUCCEEDED" });
    expect(succeeded.aiGenerations[0]).toMatchObject({
      status: AiGenerationStatus.SUCCEEDED,
      provider: AiProviderName.OPENAI,
      model: "gpt-4.1-mini",
      totalTokens: 14,
      outputHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      outputJson: { status: "ok" },
    });
  });
});
