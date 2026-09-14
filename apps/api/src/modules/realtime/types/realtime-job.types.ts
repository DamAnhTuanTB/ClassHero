import type { BackgroundJobQueue, BackgroundJobStatus } from "@prisma/client";

export type RealtimeJobRecord = {
  id: string;
  lessonId: string | null;
  ownerUserId: string | null;
  queue: BackgroundJobQueue;
  status: BackgroundJobStatus;
  attempts: number;
  resourceType: string | null;
  resourceId: string | null;
  updatedAt: Date;
};
