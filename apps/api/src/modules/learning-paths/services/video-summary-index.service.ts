import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { buildVideoSummaryIndex } from "#api/modules/learning-paths/utils/video-summary-index";

export type VideoSummaryIndexSyncResult = {
  changed: boolean;
  chunkCount: number;
  summaryHash: string;
  videoSummaryId: string;
};

@Injectable()
export class VideoSummaryIndexService {
  async syncInTransaction(
    transaction: Prisma.TransactionClient,
    input: {
      videoSummaryId: string;
      lessonId: string;
      contentJson: unknown;
    },
  ): Promise<VideoSummaryIndexSyncResult> {
    const index = buildVideoSummaryIndex(input.contentJson);
    const [current, currentCount] = await Promise.all([
      transaction.videoSummaryChunk.findFirst({
        where: { videoSummaryId: input.videoSummaryId },
        orderBy: { chunkIndex: "asc" },
        select: { summaryHash: true },
      }),
      transaction.videoSummaryChunk.count({
        where: { videoSummaryId: input.videoSummaryId },
      }),
    ]);

    if (
      current?.summaryHash === index.summaryHash &&
      currentCount === index.chunks.length
    ) {
      return {
        changed: false,
        chunkCount: currentCount,
        summaryHash: index.summaryHash,
        videoSummaryId: input.videoSummaryId,
      };
    }

    await transaction.videoSummaryChunk.deleteMany({
      where: { videoSummaryId: input.videoSummaryId },
    });
    if (index.chunks.length > 0) {
      await transaction.videoSummaryChunk.createMany({
        data: index.chunks.map((chunk) => ({
          videoSummaryId: input.videoSummaryId,
          lessonId: input.lessonId,
          ...chunk,
        })),
      });
    }

    return {
      changed: true,
      chunkCount: index.chunks.length,
      summaryHash: index.summaryHash,
      videoSummaryId: input.videoSummaryId,
    };
  }
}
