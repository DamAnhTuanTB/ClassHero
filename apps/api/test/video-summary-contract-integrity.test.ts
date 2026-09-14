import { AiGenerationType } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import type { AiGenerationExecutionContext } from "#api/modules/ai/types/ai-generation.types";
import { VideoSummariesService } from "#api/modules/learning-paths/services/video-summaries.service";
import { buildVideoSummaryProviderContract } from "#api/modules/learning-paths/utils/video-summary-provider-contract";
import { buildVideoSummarySource } from "#api/modules/learning-paths/utils/video-summary-source";
import { VideoSummaryGenerationService } from "#api/workers/services/video-summary-generation.service";

const lessonId = "00000000-0000-4000-8000-000000000001";
const actorUserId = "00000000-0000-4000-8000-000000000002";
const requestDraftId = "00000000-0000-4000-8000-000000000003";
const backgroundJobId = "00000000-0000-4000-8000-000000000004";
const aiGenerationId = "00000000-0000-4000-8000-000000000005";
const requestHash = "a".repeat(64);

const route = {
  feature: AiGenerationType.VIDEO_SUMMARY,
  version: 1,
  model: "gpt-5.6",
  temperature: null,
  reasoningEffort: "high",
  maxOutputTokens: 1_200,
  candidates: [],
  hasConfiguration: true,
};

const lesson = {
  id: lessonId,
  title: "Phân số",
  videoUrl: "https://example.com/video.mp4",
  customVideoSettings: {
    transcriptLanguage: "vi",
    transcript: [{ time: 0, text: "Phân số biểu diễn một phần của đơn vị." }],
    chapters: [],
  },
  learningPath: {
    domain: { name: "Toán", slug: "toan" },
    targetAudiences: [{ targetAudience: { grade: 6 } }],
  },
};

function currentFixture() {
  const source = buildVideoSummarySource(lesson);
  if (!source) throw new Error("Expected a valid video source fixture.");
  const contract = buildVideoSummaryProviderContract(source.chapters);
  const draft = {
    id: requestDraftId,
    lessonId,
    createdById: actorUserId,
    requestHash,
    sourceSnapshotJson: { hashes: source.hashes },
    systemInstructions: "STABLE VIDEO SUMMARY CONTRACT",
    userPrompt: "Tóm tắt video.",
    schemaName: contract.schemaName,
    schemaVersion: contract.schemaVersion,
    schemaHash: contract.schemaHash,
    schemaJson: contract.schemaJson,
    modelConfigJson: {
      routeSnapshot: route,
      promptVersion: contract.promptVersion,
    },
    costEstimateJson: null,
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
    createdAt: new Date(),
  };
  const jobInput = {
    requestDraftId,
    requestHash,
    sourceHash: source.hashes.source,
    schemaName: contract.schemaName,
    schemaVersion: contract.schemaVersion,
    schemaHash: contract.schemaHash,
    promptVersion: contract.promptVersion,
  };
  return { contract, draft, jobInput, source };
}

function buildApplicationService(draft: ReturnType<typeof currentFixture>["draft"]) {
  const prisma = {
    lessonVideoSummaryRequestDraft: {
      findFirst: vi.fn().mockResolvedValue(draft),
      update: vi.fn().mockResolvedValue({}),
    },
    lesson: { findFirst: vi.fn().mockResolvedValue(lesson) },
  };
  const jobs = {
    createAndEnqueue: vi.fn().mockResolvedValue({
      backgroundJobId,
      status: "QUEUED",
    }),
  };
  const service = new VideoSummariesService(
    prisma as never,
    jobs as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { jobs, prisma, service };
}

function buildWorker(
  draft: ReturnType<typeof currentFixture>["draft"],
  jobInput: ReturnType<typeof currentFixture>["jobInput"],
) {
  const contract = buildVideoSummaryProviderContract([]);
  const prisma = {
    lessonVideoSummaryRequestDraft: {
      findFirst: vi.fn().mockResolvedValue(draft),
    },
    lesson: { findFirst: vi.fn().mockResolvedValue(lesson) },
    aiGeneration: {
      findFirst: vi.fn().mockResolvedValue({
        promptVersion: contract.promptVersion,
        schemaVersion: contract.schemaVersion,
      }),
    },
  };
  const provider = {
    generateStructured: vi.fn().mockResolvedValue({
      provider: "OPENAI",
      model: "gpt-5.6",
      data: {
        title: "Phân số",
        objectives: ["Nhận biết phân số."],
        sections: [
          {
            order: 1,
            displayHeading: "Khái niệm",
            startSeconds: 0,
            blocks: [
              {
                type: "knowledge",
                title: "Phân số",
                startSeconds: 0,
                content: "Phân số biểu diễn một phần của đơn vị.",
              },
            ],
          },
        ],
      },
    }),
  };
  const service = new VideoSummaryGenerationService(
    prisma as never,
    provider as never,
    {} as never,
    {} as never,
  );
  const context: AiGenerationExecutionContext = {
    backgroundJobId,
    aiGenerationId,
    type: AiGenerationType.VIDEO_SUMMARY,
    ownerUserId: actorUserId,
    lessonId,
    targetType: "LESSON_VIDEO_SUMMARY",
    targetId: lessonId,
    inputMeta: { ...jobInput, providerRouteSnapshot: route },
    attempt: 1,
    maxAttempts: 1,
    providerRouteSnapshot: route,
  };
  return { context, prisma, provider, service };
}

describe("Video Summary preview/job contract integrity", () => {
  it("rejects a schema-v8 preview before enqueueing under schema v9", async () => {
    const fixture = currentFixture();
    const { jobs, prisma, service } = buildApplicationService({
      ...fixture.draft,
      schemaVersion: "8",
    });

    await expect(
      service.generate(lessonId, actorUserId, { requestDraftId, requestHash }),
    ).rejects.toMatchObject({
      response: { code: "AI_INPUT_SNAPSHOT_STALE" },
    });
    expect(jobs.createAndEnqueue).not.toHaveBeenCalled();
    expect(prisma.lessonVideoSummaryRequestDraft.update).not.toHaveBeenCalled();
  });

  it("enqueues a valid schema-v9 preview with one matching audit contract", async () => {
    const fixture = currentFixture();
    const { jobs, service } = buildApplicationService(fixture.draft);

    await expect(
      service.generate(lessonId, actorUserId, { requestDraftId, requestHash }),
    ).resolves.toMatchObject({ mode: "QUEUED", jobId: backgroundJobId });
    expect(jobs.createAndEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        promptVersion: fixture.contract.promptVersion,
        schemaVersion: fixture.contract.schemaVersion,
        inputMeta: expect.objectContaining({
          schemaName: fixture.contract.schemaName,
          schemaVersion: fixture.contract.schemaVersion,
          schemaHash: fixture.contract.schemaHash,
          promptVersion: fixture.contract.promptVersion,
        }),
      }),
    );
  });

  it("blocks a tampered draft hash in the worker before any provider call", async () => {
    const fixture = currentFixture();
    const { context, provider, service } = buildWorker(
      { ...fixture.draft, schemaHash: "0".repeat(64) },
      fixture.jobInput,
    );

    await expect(service.generate(context)).rejects.toThrow(/AI_INPUT_SNAPSHOT_STALE/u);
    expect(provider.generateStructured).not.toHaveBeenCalled();
  });

  it("passes a valid schema-v9 contract to the provider unchanged", async () => {
    const fixture = currentFixture();
    const { context, provider, service } = buildWorker(fixture.draft, fixture.jobInput);

    await expect(service.generate(context)).resolves.toMatchObject({
      action: "VIDEO_SUMMARY",
    });
    expect(provider.generateStructured).toHaveBeenCalledOnce();
    expect(provider.generateStructured.mock.calls[0]?.[1]).toMatchObject({
      outputName: fixture.contract.schemaName,
      schemaVersion: fixture.contract.schemaVersion,
      promptVersion: fixture.contract.promptVersion,
    });
  });
});
