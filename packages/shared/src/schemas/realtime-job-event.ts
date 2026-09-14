import { z } from "zod";

export const realtimeBackgroundJobQueueSchema = z.enum([
  "DOCUMENT_PROCESSING",
  "EMBEDDING",
  "AI_GENERATION",
  "NOTIFICATION_DELIVERY",
  "EMAIL_DELIVERY",
  "ZALO_DELIVERY",
  "DIAGRAM_RENDERING",
  "QUIZ_FIGURE_RENDERING",
  "FLASHCARD_FIGURE_RENDERING",
  "PAYMENT_POSTPROCESS",
  "PERSONAL_LEARNING_PATH_CLONE",
]);

export const realtimeBackgroundJobStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
]);

export const backgroundJobStatusChangedEventSchema = z
  .object({
    schemaVersion: z.literal(1),
    eventId: z.string().uuid(),
    eventType: z.literal("background_job.status_changed"),
    occurredAt: z.string().datetime({ offset: true }),
    jobId: z.string().uuid(),
    lessonId: z.string().uuid().nullable(),
    ownerUserId: z.string().uuid().nullable(),
    queue: realtimeBackgroundJobQueueSchema,
    status: realtimeBackgroundJobStatusSchema,
    attempts: z.number().int().nonnegative(),
    resourceType: z.string().min(1).nullable(),
    resourceId: z.string().uuid().nullable(),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const lessonRealtimeSubscriptionSchema = z
  .object({
    schemaVersion: z.literal(1),
    lessonId: z.string().uuid(),
  })
  .strict();

export const lessonRealtimeSubscriptionAckSchema = z.discriminatedUnion("ok", [
  z
    .object({
      ok: z.literal(true),
      lessonId: z.string().uuid(),
      subscribedAt: z.string().datetime({ offset: true }),
    })
    .strict(),
  z
    .object({
      ok: z.literal(false),
      code: z.enum(["INVALID_PAYLOAD", "FORBIDDEN", "NOT_FOUND"]),
      message: z.string().min(1),
    })
    .strict(),
]);

export type BackgroundJobStatusChangedEvent = z.infer<
  typeof backgroundJobStatusChangedEventSchema
>;
export type LessonRealtimeSubscription = z.infer<typeof lessonRealtimeSubscriptionSchema>;
export type LessonRealtimeSubscriptionAck = z.infer<
  typeof lessonRealtimeSubscriptionAckSchema
>;

export const realtimeSocketEvents = {
  backgroundJobStatusChanged: "background_job.status_changed.v1",
  lessonSubscribe: "lesson.subscribe.v1",
  lessonUnsubscribe: "lesson.unsubscribe.v1",
} as const;
