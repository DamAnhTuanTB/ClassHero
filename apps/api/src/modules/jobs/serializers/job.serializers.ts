import type { JobRecord, JobResponse } from "#api/modules/jobs/types/job.types";
import { readJobErrorDetails } from "#api/jobs/job-error";

export function serializeJob(record: JobRecord): JobResponse {
  return {
    jobId: record.id,
    queue: record.queue,
    status: record.status,
    ownerUserId: record.ownerUserId,
    lessonId: record.lessonId,
    resourceType: record.resourceType,
    resourceId: record.resourceId,
    result: record.result,
    error: record.errorMessage,
    errorDetails: readJobErrorDetails(record.result),
    attempts: record.attempts,
    maxAttempts: record.maxAttempts,
    availableAt: record.availableAt,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
