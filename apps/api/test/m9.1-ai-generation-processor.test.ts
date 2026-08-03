import "reflect-metadata";
import { AiGenerationType, AiProviderName, BackgroundJobStatus } from "@prisma/client";
import { Job, UnrecoverableError } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  BackgroundJobBullmqData,
  BackgroundJobBullmqResult,
} from "#api/jobs/background-job-queues";
import type { AiGenerationLifecycleService } from "#api/modules/ai/services/ai-generation-lifecycle.service";
import { AiOutputValidationError } from "#api/modules/ai/utils/ai-output-validation";
import { AiGenerationProcessor } from "#api/workers/processors/ai-generation.processor";
import type { AiGenerationExecutionService } from "#api/workers/services/ai-generation-execution.service";

function makeJob(attemptsMade = 0, attempts = 3) {
  return {
    id: "bullmq-ai-1",
    data: { backgroundJobId: "background-ai-1" },
    attemptsMade,
    opts: { attempts },
  } as Job<BackgroundJobBullmqData, BackgroundJobBullmqResult>;
}

function makeRecord(status = BackgroundJobStatus.QUEUED) {
  return {
    id: "background-ai-1",
    queue: "AI_GENERATION" as const,
    status,
    ownerUserId: "user-1",
    lessonId: "lesson-1",
    inputMeta: { action: "SUMMARY" },
    resourceType: "LESSON",
    resourceId: "lesson-1",
    maxAttempts: 3,
    aiGeneration: {
      id: "ai-generation-1",
      type: AiGenerationType.SUMMARY,
      status: "QUEUED" as const,
      targetType: "LESSON",
      targetId: "lesson-1",
    },
  };
}

describe("M9.1 AI generation processor", () => {
  let lifecycle: {
    load: ReturnType<typeof vi.fn>;
    markRunning: ReturnType<typeof vi.fn>;
    markSucceeded: ReturnType<typeof vi.fn>;
    markFailed: ReturnType<typeof vi.fn>;
  };
  let execution: {
    generate: ReturnType<typeof vi.fn>;
    persist: ReturnType<typeof vi.fn>;
  };
  let processor: AiGenerationProcessor;

  beforeEach(() => {
    lifecycle = {
      load: vi.fn(async () => makeRecord()),
      markRunning: vi.fn(async () => undefined),
      markSucceeded: vi.fn(async () => ({
        status: "SUCCEEDED",
        queue: "AI_GENERATION",
        resourceType: "LESSON_SUMMARY",
        resourceId: "summary-1",
        action: "SUMMARY",
        message: "Summary generated.",
        handledAt: new Date().toISOString(),
      })),
      markFailed: vi.fn(async () => undefined),
    };
    execution = {
      generate: vi.fn(async () => ({
        action: "SUMMARY",
        output: {
          data: { title: "Validated summary" },
          provider: AiProviderName.OPENAI,
          model: "gpt-4.1-mini",
          usage: { promptTokens: 20, completionTokens: 10, totalTokens: 30 },
        },
      })),
      persist: vi.fn(async () => ({
        resourceType: "LESSON_SUMMARY",
        resourceId: "summary-1",
        message: "Summary generated.",
      })),
    };
    processor = new AiGenerationProcessor(
      lifecycle as unknown as AiGenerationLifecycleService,
      execution as unknown as AiGenerationExecutionService,
    );
  });

  it("persists only after generate returns validated structured output", async () => {
    await expect(processor.process(makeJob())).resolves.toMatchObject({
      status: "SUCCEEDED",
      resourceId: "summary-1",
    });
    expect(execution.generate).toHaveBeenCalledOnce();
    expect(execution.persist).toHaveBeenCalledOnce();
    expect(
      execution.generate.mock.invocationCallOrder[0],
    ).toBeLessThan(execution.persist.mock.invocationCallOrder[0] ?? 0);
    expect(lifecycle.markSucceeded).toHaveBeenCalledOnce();
  });

  it("never calls persistence and disables retry when output is invalid", async () => {
    execution.generate.mockRejectedValueOnce(
      new AiOutputValidationError("schema mismatch"),
    );

    await expect(processor.process(makeJob())).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
    expect(execution.persist).not.toHaveBeenCalled();
    expect(lifecycle.markSucceeded).not.toHaveBeenCalled();
    expect(lifecycle.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({ aiGenerationId: "ai-generation-1" }),
      expect.any(AiOutputValidationError),
      true,
    );
  });

  it("returns transient provider errors to QUEUED lifecycle for BullMQ retry", async () => {
    execution.generate.mockRejectedValueOnce(new Error("provider timeout"));

    await expect(processor.process(makeJob(0, 3))).rejects.toThrow(
      "provider timeout",
    );
    expect(execution.persist).not.toHaveBeenCalled();
    expect(lifecycle.markFailed).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Error),
      false,
    );
  });

  it("idempotently skips a job that already succeeded", async () => {
    lifecycle.load.mockResolvedValueOnce(makeRecord(BackgroundJobStatus.SUCCEEDED));

    await expect(processor.process(makeJob())).resolves.toMatchObject({
      status: "SKIPPED",
    });
    expect(lifecycle.markRunning).not.toHaveBeenCalled();
    expect(execution.generate).not.toHaveBeenCalled();
  });
});
