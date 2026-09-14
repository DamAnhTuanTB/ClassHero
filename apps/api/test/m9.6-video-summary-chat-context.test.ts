import { AiChatResponsePolicy, AiChatScopeType, AiProviderName } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { AiChatRetrievalService } from "#api/modules/ai-chat/services/ai-chat-retrieval.service";
import {
  resolveAdminSimulationContext,
  resolveVideoSourceSeconds,
} from "#api/modules/ai-chat/services/ai-chat.service";
import { buildVideoSummaryIndex } from "#api/modules/learning-paths/utils/video-summary-index";

const PATH_ID = "11111111-1111-4111-8111-111111111111";
const LESSON_ID = "22222222-2222-4222-8222-222222222222";

describe("M9.6 video summary Chat AI context", () => {
  it("indexes only knowledge/example blocks and derives their source-time ranges", () => {
    const index = buildVideoSummaryIndex({
      type: "lesson_summary_blocks",
      version: 6,
      data: {
        title: "Định lý Pythagoras",
        objectives: ["Hiểu định lý", "Vận dụng định lý"],
        sections: [
          {
            order: 1,
            displayHeading: "Khái niệm",
            startSeconds: 10,
            blocks: [
              {
                type: "knowledge",
                title: "Tam giác vuông",
                content:
                  "Bình phương cạnh huyền bằng tổng bình phương hai cạnh góc vuông.",
                startSeconds: 12,
              },
              {
                type: "exercise",
                problem: "Nội dung không thuộc bản tóm tắt video.",
                startSeconds: 20,
              },
            ],
          },
          {
            order: 2,
            displayHeading: "Ví dụ",
            startSeconds: 30,
            blocks: [
              {
                type: "example",
                problem: "Hai cạnh góc vuông dài 3 và 4.",
                solution: "Tính căn bậc hai của 3^2 + 4^2.",
                answer: "5",
                startSeconds: 32,
              },
            ],
          },
        ],
      },
    });

    expect(index.chunks).toHaveLength(2);
    expect(index.chunks[0]).toMatchObject({
      startSeconds: 12,
      endSeconds: 32,
      metadataJson: { sourceType: "VIDEO_SUMMARY", timeline: "SOURCE" },
    });
    expect(index.chunks[0]?.content).toContain("Tam giác vuông");
    expect(index.chunks[0]?.content).not.toContain("Nội dung không thuộc");
    expect(index.chunks[1]).toMatchObject({ startSeconds: 32, endSeconds: null });
    expect(index.chunks[1]?.content).toContain("Đáp án: 5");
  });

  it("never indexes legacy transcript-like free text as a video summary block", () => {
    const index = buildVideoSummaryIndex({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Transcript gốc" }] },
      ],
    });

    expect(index.chunks).toEqual([]);
  });

  it("converts playback time to source-video time using the configured clip offset", () => {
    expect(resolveVideoSourceSeconds(15, { startTimeInSeconds: 20 })).toBe(35);
    expect(
      resolveVideoSourceSeconds(15.125, {
        isDisabled: true,
        startTimeInSeconds: 20,
      }),
    ).toBe(15.13);
    expect(resolveVideoSourceSeconds(15, null)).toBe(20);
  });

  it("requires a playback timestamp for Admin Video simulation and keeps FULL_ANSWER", () => {
    const scope = {
      scopeType: AiChatScopeType.COURSE,
      learningPathId: PATH_ID,
      learningPathIds: [PATH_ID],
      label: "Toán 9",
    };
    const base = {
      scopeType: AiChatScopeType.COURSE,
      learningPathIds: [PATH_ID],
      surfaceLessonId: LESSON_ID,
      simulationSurface: "VIDEO_SUMMARY" as const,
      message: "Tại sao bước này đúng?",
      attachmentFileIds: [],
    };

    expect(() => resolveAdminSimulationContext(base, scope, LESSON_ID)).toThrow(
      /mốc phát video/iu,
    );
    expect(
      resolveAdminSimulationContext(
        { ...base, videoPlaybackSeconds: 42 },
        scope,
        LESSON_ID,
      ),
    ).toEqual({
      simulationSurface: "VIDEO_SUMMARY",
      policy: AiChatResponsePolicy.FULL_ANSWER,
      answerAccess: "FULL_SCOPE",
    });
  });

  it("keeps the current video block first while retaining whole-summary search results", async () => {
    const currentBlock = {
      chunk_id: "current-block",
      source_type: "VIDEO_SUMMARY" as const,
      lesson_id: LESSON_ID,
      lesson_title: "Bài Pythagoras",
      learning_path_id: PATH_ID,
      learning_path_title: "Toán 9",
      content: "Khối đang phát ở mốc 02:00",
      token_count: 20,
      score: 2,
      start_seconds: 120,
      end_seconds: 150,
    };
    const otherBlock = {
      ...currentBlock,
      chunk_id: "other-block",
      content: "Khối khác ở mốc 08:00 nói về hệ quả",
      score: 0.92,
      start_seconds: 480,
      end_seconds: 510,
    };
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([currentBlock])
      .mockResolvedValueOnce([otherBlock]);
    const service = new AiChatRetrievalService(
      {
        lesson: { findMany: vi.fn(async () => []) },
        $queryRaw: queryRaw,
      } as never,
      {
        createEmbedding: vi.fn(async () => ({ vectors: [[0.1, 0.2]] })),
      } as never,
    );

    const sources = await service.retrieve({
      query: "Mốc 8 phút nói gì?",
      learningPathIds: [PATH_ID],
      surfaceLessonId: LESSON_ID,
      videoSourceSeconds: 135,
      embeddingIdempotencyKey: "video-summary-current-block",
      embeddingConfig: {
        provider: AiProviderName.OPENAI,
        model: "text-embedding-test",
        dimensions: 2,
      },
      maxChunks: 8,
      maxTokens: 1_000,
    });

    expect(sources.map((source) => source.chunkId)).toEqual([
      "current-block",
      "other-block",
    ]);
    expect(sources[0]?.isCurrentVideoBlock).toBe(true);
    expect(sources[1]?.isCurrentVideoBlock).toBeUndefined();
    expect(sources.every((source) => source.sourceType === "VIDEO_SUMMARY")).toBe(true);
    const keywordSql = queryRaw.mock.calls[0]?.[0] as readonly string[];
    expect(keywordSql.join(" ")).toContain("video_summary_chunks");
    const currentCandidateSql = queryRaw.mock.calls[0]?.[1] as {
      strings?: readonly string[];
    };
    expect(currentCandidateSql.strings?.join(" ")).toContain("chunk.start_seconds <=");
  });
});
