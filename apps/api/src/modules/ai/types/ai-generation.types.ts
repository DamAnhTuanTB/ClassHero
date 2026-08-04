import type {
  AiGenerationType,
  AiProviderName,
  BackgroundJobStatus,
} from "@prisma/client";

import type { AiStructuredOutput } from "#api/modules/ai/types/ai-text.types";
import type { AiFeatureRoute } from "#api/modules/provider-operations/types/provider-operations.types";

export interface CreateAiGenerationJobInput {
  type: AiGenerationType;
  createdByUserId?: string;
  lessonId?: string;
  targetType?: string;
  targetId?: string;
  promptVersion: string;
  schemaVersion: string;
  inputFingerprint: unknown;
  inputMeta?: unknown;
  routeSnapshot?: AiFeatureRoute;
  idempotencyKey?: string;
  deduplicateActive?: boolean;
  maxAttempts?: number;
}

export interface AiGenerationExecutionContext {
  backgroundJobId: string;
  aiGenerationId: string;
  type: AiGenerationType;
  ownerUserId: string | null;
  lessonId: string | null;
  targetType: string | null;
  targetId: string | null;
  inputMeta: unknown;
  attempt: number;
  maxAttempts: number;
  providerRouteSnapshot?: AiFeatureRoute;
}

export interface AiGenerationPreparedOutput<TOutput = unknown> {
  action: string;
  output: AiStructuredOutput<TOutput>;
  contextMetadata?: unknown;
}

export interface AiGenerationPersistenceResult {
  resourceType: string | null;
  resourceId: string | null;
  message: string;
  result?: unknown;
}

export interface AiGenerationLifecycleRecord {
  id: string;
  queue: "AI_GENERATION";
  status: BackgroundJobStatus;
  ownerUserId: string | null;
  lessonId: string | null;
  inputMeta: unknown;
  resourceType: string | null;
  resourceId: string | null;
  maxAttempts: number;
  aiGeneration: {
    id: string;
    type: AiGenerationType;
    status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
    targetType: string | null;
    targetId: string | null;
  };
}

export interface AiGenerationCompletionMetadata {
  provider: AiProviderName;
  model: string;
  providerRequestId?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
}
