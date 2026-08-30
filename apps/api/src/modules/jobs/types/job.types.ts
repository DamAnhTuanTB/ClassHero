import { BackgroundJobQueue, BackgroundJobStatus, Prisma } from "@prisma/client";
import { jobSelect } from "#api/modules/jobs/selectors/job.selects";
import type { JobErrorDetails } from "#api/jobs/job-error";

export type JobRecord = Prisma.BackgroundJobGetPayload<{
  select: typeof jobSelect;
}>;

export type JobResponse = {
  jobId: string;
  queue: BackgroundJobQueue;
  status: BackgroundJobStatus;
  ownerUserId: string | null;
  lessonId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  result: unknown;
  error: string | null;
  errorDetails: JobErrorDetails | null;
  attempts: number;
  maxAttempts: number;
  availableAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
