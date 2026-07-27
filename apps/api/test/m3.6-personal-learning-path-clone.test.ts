import "reflect-metadata";
import {
  BackgroundJobQueue,
  BackgroundJobStatus,
  EnrollmentStatus,
  LearningPathKind,
  PublishStatus,
  Subject,
} from "@prisma/client";
import { Job } from "bullmq";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "#api/common/prisma/prisma.service";
import type {
  BackgroundJobBullmqData,
  BackgroundJobBullmqResult,
} from "#api/jobs/background-job-queues";
import { getBullmqQueueName } from "#api/jobs/background-job-queues";
import type { BackgroundJobQueueService } from "#api/modules/jobs/services/background-job-queue.service";
import type { AiService } from "#api/modules/ai/services/ai.service";
import { PersonalLearningPathsService } from "#api/modules/learning-paths/services/personal-learning-paths.service";
import { PersonalLearningPathCloneProcessor } from "#api/workers/processors/personal-learning-path-clone.processor";
import type { EmbeddingJobEnqueuer } from "#api/workers/services/embedding-job-enqueuer.service";
import type { PersonalLearningPathClonerService } from "#api/workers/services/personal-learning-path-cloner.service";

describe("M3.6 personal learning-path clone foundation", () => {
  it("maps the personal clone queue to a dedicated BullMQ queue", () => {
    expect(getBullmqQueueName(BackgroundJobQueue.PERSONAL_LEARNING_PATH_CLONE)).toBe(
      "personal-learning-path-clone",
    );
  });

  it("returns the existing job for an identical idempotency key", async () => {
    const enrollment = createEnrollmentRecord();
    const existingJob = createJobRecord();
    const prisma = {
      enrollment: {
        findFirst: vi.fn(async () => enrollment),
      },
      backgroundJob: {
        findUnique: vi.fn(async () => existingJob),
        findFirst: vi.fn(),
      },
    } as unknown as PrismaService;
    const queue = {
      enqueue: vi.fn(),
    } as unknown as BackgroundJobQueueService;
    const service = new PersonalLearningPathsService(prisma, queue);

    await expect(
      service.createCloneJob(
        enrollment.id,
        "admin-1",
        { idempotencyKey: existingJob.idempotencyKey! },
        {},
      ),
    ).resolves.toMatchObject({
      mode: "QUEUED",
      jobId: existingJob.id,
      status: BackgroundJobStatus.QUEUED,
    });
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("creates one durable clone job, audits it, and enqueues it", async () => {
    const enrollment = createEnrollmentRecord();
    const createdJob = createJobRecord();
    const tx = {
      backgroundJob: {
        create: vi.fn(async () => createdJob),
      },
      auditLog: {
        create: vi.fn(async () => ({ id: "audit-1" })),
      },
    };
    const prisma = {
      enrollment: {
        findFirst: vi.fn(async () => enrollment),
      },
      backgroundJob: {
        findUnique: vi.fn(async () => null),
        findFirst: vi.fn(async () => null),
      },
      $transaction: vi.fn(
        async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
      ),
    } as unknown as PrismaService;
    const queue = {
      enqueue: vi.fn(async () => ({ jobId: createdJob.id })),
    } as unknown as BackgroundJobQueueService;
    const service = new PersonalLearningPathsService(prisma, queue);

    const result = await service.createCloneJob(
      enrollment.id,
      "admin-1",
      { idempotencyKey: createdJob.idempotencyKey! },
      { ipAddress: "127.0.0.1", userAgent: "vitest" },
    );

    expect(result).toMatchObject({
      mode: "QUEUED",
      jobId: createdJob.id,
    });
    expect(tx.backgroundJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          queue: BackgroundJobQueue.PERSONAL_LEARNING_PATH_CLONE,
          resourceType: "ENROLLMENT",
          resourceId: enrollment.id,
        }),
      }),
    );
    expect(tx.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "PERSONAL_LEARNING_PATH_CLONE_REQUESTED",
          entityId: enrollment.id,
        }),
      }),
    );
    expect(queue.enqueue).toHaveBeenCalledWith(createdJob.id);
  });

  it("activates the clone only after the cloner succeeds", async () => {
    const durableJob = {
      ...createJobRecord(),
      ownerUserId: "admin-1",
      inputMeta: { action: "PERSONAL_LEARNING_PATH_CLONE" },
      result: null,
      attempts: 0,
      maxAttempts: 3,
    };
    const prisma = {
      backgroundJob: {
        findUnique: vi.fn(async () => durableJob),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          ...durableJob,
          ...data,
        })),
      },
      $queryRaw: vi.fn(async () => [
        {
          lessonDocumentId: "lesson-document-1",
          lessonId: "lesson-1",
        },
      ]),
    } as unknown as PrismaService;
    const cloner = {
      cloneForEnrollment: vi.fn(async () => ({
        personalLearningPathId: "personal-path-1",
        sourceLearningPathId: "base-path-1",
        enrollmentId: "enrollment-1",
        alreadyActivated: false,
        counts: { chapters: 1, lessons: 2 },
      })),
    } as unknown as PersonalLearningPathClonerService;
    const aiService = createAiServiceMock();
    const embeddingEnqueuer = {
      enqueueEmbeddingJob: vi.fn(async () => ({ jobId: "embedding-job-1" })),
    } as unknown as EmbeddingJobEnqueuer;
    const processor = new PersonalLearningPathCloneProcessor(
      prisma,
      cloner,
      aiService,
      embeddingEnqueuer,
    );

    const result = await processor.process(createBullmqJob());

    expect(cloner.cloneForEnrollment).toHaveBeenCalledWith({
      enrollmentId: "enrollment-1",
      actorUserId: "admin-1",
      backgroundJobId: durableJob.id,
    });
    expect(result).toMatchObject({
      status: "SUCCEEDED",
      details: {
        personalLearningPathId: "personal-path-1",
        embeddingJobsQueued: 1,
      },
    });
    expect(embeddingEnqueuer.enqueueEmbeddingJob).toHaveBeenCalledWith({
      lessonId: "lesson-1",
      lessonDocumentId: "lesson-document-1",
      ownerUserId: "admin-1",
    });
    expect(prisma.backgroundJob.update).toHaveBeenLastCalledWith({
      where: { id: durableJob.id },
      data: expect.objectContaining({
        status: BackgroundJobStatus.SUCCEEDED,
        errorMessage: null,
      }),
    });
  });

  it("marks the durable job failed without activating an enrollment on final error", async () => {
    const durableJob = {
      ...createJobRecord(),
      ownerUserId: "admin-1",
      inputMeta: { action: "PERSONAL_LEARNING_PATH_CLONE" },
      result: null,
      attempts: 0,
      maxAttempts: 1,
    };
    const prisma = {
      backgroundJob: {
        findUnique: vi.fn(async () => durableJob),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          ...durableJob,
          ...data,
        })),
      },
      enrollment: {
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    } as unknown as PrismaService & {
      enrollment: {
        update: ReturnType<typeof vi.fn>;
        updateMany: ReturnType<typeof vi.fn>;
      };
    };
    const cloner = {
      cloneForEnrollment: vi.fn(async () => {
        throw new Error("Clone failed");
      }),
    } as unknown as PersonalLearningPathClonerService;
    const processor = new PersonalLearningPathCloneProcessor(
      prisma,
      cloner,
      createAiServiceMock(),
      {
        enqueueEmbeddingJob: vi.fn(),
      } as unknown as EmbeddingJobEnqueuer,
    );

    await expect(processor.process(createBullmqJob({ attempts: 1 }))).rejects.toThrow(
      "Clone failed",
    );

    expect(prisma.backgroundJob.update).toHaveBeenLastCalledWith({
      where: { id: durableJob.id },
      data: expect.objectContaining({
        status: BackgroundJobStatus.FAILED,
        errorMessage: "Clone failed",
      }),
    });
    expect(prisma.enrollment.update).not.toHaveBeenCalled();
    expect(prisma.enrollment.updateMany).not.toHaveBeenCalled();
  });
});

function createAiServiceMock() {
  return {
    getEmbeddingConfig: vi.fn(() => ({
      provider: "OPENAI",
      model: "text-embedding-3-small",
      dimensions: 1536,
    })),
  } as unknown as AiService;
}

function createEnrollmentRecord() {
  return {
    id: "enrollment-1",
    status: EnrollmentStatus.ACTIVE,
    startsAt: new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    studentUserId: "student-1",
    studentUser: {
      id: "student-1",
      fullName: "Nguyễn An",
      username: "nguyen-an",
      email: "an@example.com",
      phone: null,
      studentProfile: {
        displayName: "An",
      },
    },
    learningPath: {
      id: "base-path-1",
      kind: LearningPathKind.CATALOG,
      sourceLearningPathId: null,
      title: "Toán 7",
      slug: "toan-7",
      subject: Subject.MATH,
      grade: 7,
      status: PublishStatus.PUBLISHED,
      totalChapterCount: 1,
      totalLessonCount: 2,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    deliveryLearningPath: null,
  };
}

function createJobRecord() {
  return {
    id: "clone-job-1",
    queue: BackgroundJobQueue.PERSONAL_LEARNING_PATH_CLONE,
    status: BackgroundJobStatus.QUEUED,
    idempotencyKey: "personal-enrollment-1",
    resourceType: "ENROLLMENT",
    resourceId: "enrollment-1",
    result: null,
    errorMessage: null,
    attempts: 0,
    maxAttempts: 3,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date("2026-07-23T00:00:00.000Z"),
    updatedAt: new Date("2026-07-23T00:00:00.000Z"),
  };
}

function createBullmqJob({ attempts = 3 }: { attempts?: number } = {}) {
  return {
    id: "bullmq-clone-job-1",
    data: {
      backgroundJobId: "clone-job-1",
    },
    attemptsMade: 0,
    opts: {
      attempts,
    },
  } as Job<BackgroundJobBullmqData, BackgroundJobBullmqResult>;
}
