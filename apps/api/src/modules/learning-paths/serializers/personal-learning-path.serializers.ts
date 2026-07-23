import { BackgroundJobStatus } from "@prisma/client";
import type {
  PersonalLearningPathEnrollmentRecord,
  PersonalLearningPathJobRecord,
} from "#api/modules/learning-paths/types/personal-learning-path.types";

export function serializePersonalLearningPathEnrollment(
  enrollment: PersonalLearningPathEnrollmentRecord,
  job: PersonalLearningPathJobRecord | null,
) {
  return {
    enrollmentId: enrollment.id,
    enrollmentStatus: enrollment.status,
    startsAt: enrollment.startsAt,
    expiresAt: enrollment.expiresAt,
    student: {
      id: enrollment.studentUser.id,
      name:
        enrollment.studentUser.studentProfile?.displayName ??
        enrollment.studentUser.fullName ??
        enrollment.studentUser.username ??
        enrollment.studentUser.email ??
        enrollment.studentUser.phone ??
        "Học sinh",
      email: enrollment.studentUser.email,
      phone: enrollment.studentUser.phone,
    },
    baseLearningPath: enrollment.learningPath,
    personalLearningPath: enrollment.deliveryLearningPath,
    personalizationStatus: getPersonalizationStatus(
      enrollment.deliveryLearningPath,
      job,
    ),
    cloneJob: job ? serializePersonalLearningPathJob(job) : null,
  };
}

export function serializePersonalLearningPathJob(job: PersonalLearningPathJobRecord) {
  return {
    jobId: job.id,
    queue: job.queue,
    status: job.status,
    idempotencyKey: job.idempotencyKey,
    resourceType: job.resourceType,
    resourceId: job.resourceId,
    result: job.result,
    error: job.errorMessage,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function getPersonalizationStatus(
  personalLearningPath: PersonalLearningPathEnrollmentRecord["deliveryLearningPath"],
  job: PersonalLearningPathJobRecord | null,
) {
  if (personalLearningPath) {
    return "PERSONALIZED" as const;
  }

  if (
    job?.status === BackgroundJobStatus.QUEUED ||
    job?.status === BackgroundJobStatus.RUNNING
  ) {
    return "CLONING" as const;
  }

  if (job?.status === BackgroundJobStatus.FAILED) {
    return "FAILED" as const;
  }

  return "BASE" as const;
}
