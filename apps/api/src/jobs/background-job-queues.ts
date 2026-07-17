import { BackgroundJobQueue } from "@prisma/client";

export const backgroundJobQueueNames = {
  [BackgroundJobQueue.DOCUMENT_PROCESSING]: "document-processing",
  [BackgroundJobQueue.EMBEDDING]: "embedding",
  [BackgroundJobQueue.AI_GENERATION]: "ai-generation",
  [BackgroundJobQueue.NOTIFICATION_DELIVERY]: "notification-delivery",
  [BackgroundJobQueue.EMAIL_DELIVERY]: "email-delivery",
  [BackgroundJobQueue.ZALO_DELIVERY]: "zalo-delivery",
  [BackgroundJobQueue.DIAGRAM_RENDERING]: "diagram-rendering",
  [BackgroundJobQueue.PAYMENT_POSTPROCESS]: "payment-postprocess",
} satisfies Record<BackgroundJobQueue, string>;

export type BackgroundJobBullmqData = {
  backgroundJobId: string;
};

export type BackgroundJobBullmqResult = {
  status: "SUCCEEDED" | "SKIPPED";
  queue: BackgroundJobQueue;
  resourceType: string | null;
  resourceId: string | null;
  action: string | null;
  message: string;
  handledAt: string;
};

export function getBullmqQueueName(queue: BackgroundJobQueue): string {
  return backgroundJobQueueNames[queue];
}

export function getBullmqJobName(queue: BackgroundJobQueue): string {
  return backgroundJobQueueNames[queue];
}
