import type { AiReasoningEffort } from "@learning-path/shared";
import type { TiptapTextDocument } from "@/types/rich-text";

export type AdminAiGenerationType = "SUMMARY" | "QUIZ" | "FLASHCARD" | "TEST";
export type AdminAiJobStatus =
  "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED";
export type AdminAiDifficulty = "EASY" | "MEDIUM" | "HARD" | "MIXED";
export type AdminAiQuestionType =
  "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MULTI_STATEMENT_TRUE_FALSE" | "TEXT_INPUT";
export type AdminSummaryStyle = "student_friendly" | "concise" | "academic";
export type AdminSummaryLength = "short" | "standard" | "detailed";
export type AdminAiConfigurationCapability =
  "TEMPERATURE" | "REASONING_EFFORT" | "NONE" | null;

export function supportsTemperature(
  modelName: string | null | undefined,
  aiConfiguration?: AdminAiConfigurationCapability,
): boolean {
  if (aiConfiguration === "TEMPERATURE") return true;
  if (aiConfiguration === "REASONING_EFFORT" || aiConfiguration === "NONE") return false;
  return true; // Backward compatibility for unconfigured models
}

export function supportsReasoningEffort(
  modelName: string | null | undefined,
  aiConfiguration?: AdminAiConfigurationCapability,
): boolean {
  if (aiConfiguration === "REASONING_EFFORT") return true;
  if (aiConfiguration === "TEMPERATURE" || aiConfiguration === "NONE") return false;
  return false; // Backward compatibility for unconfigured models
}

export interface AdminAiPanelDocument {
  id: string;
  title: string;
  kind: string;
  status: "UPLOADED" | "PROCESSING" | "READY" | "FAILED";
  chunkCount: number;
  pageRange: { pageStart: number; pageEnd: number } | null;
  embeddingReady: boolean;
  canUseForSummary: boolean;
  unavailableReason: string | null;
}

export interface AdminAiPanelJob {
  type: AdminAiGenerationType;
  jobId: string | null;
  status: AdminAiJobStatus;
  resourceType: string | null;
  resourceId: string | null;
  reviewStatus: AdminLessonSummaryReviewStatus | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
  model?: string | null;
  latencyMs?: number | null;
  estimatedCostVnd?: number | null;
  inputMetaJson?: {
    temperature?: number;
    reasoningEffort?: string;
    [key: string]: unknown;
  } | null;
}

export interface AdminAiGenerationPanelData {
  lesson: { id: string; title: string; targetGrade: number | null };
  readiness: {
    summaryReady: boolean;
    generationReady: boolean;
    readyDocumentCount: number;
    embeddedDocumentCount: number;
    reason: string | null;
  };
  documents: AdminAiPanelDocument[];
  jobs: Record<AdminAiGenerationType, AdminAiPanelJob | null>;
}

export interface AdminAiJobData {
  jobId: string;
  status: AdminAiJobStatus;
  resourceType: string | null;
  resourceId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface AdminAiQueuedJob {
  mode: "QUEUED";
  jobId: string;
  status: AdminAiJobStatus;
}

export type AdminSummaryGenerationPayload = {
  type: "SUMMARY";
  documentIds: string[];
  style: AdminSummaryStyle;
  styleInstructions?: string;
  length: AdminSummaryLength;
  targetWordCount?: number;
  extraInstructions?: string;
  systemInstructions?: string;
  userPrompt?: string;
  model?: string;
  temperature?: number;
  reasoningEffort?: AiReasoningEffort;
  maxOutputTokens?: number;
};

export type AdminAiGenerationPayload =
  | AdminSummaryGenerationPayload
  | {
      type: "QUIZ";
      questionCount: number;
      difficulty: AdminAiDifficulty;
      questionTypes: AdminAiQuestionType[];
    }
  | {
      type: "FLASHCARD";
      cardCount: number;
      difficulty: AdminAiDifficulty;
    }
  | {
      type: "TEST";
      questionCount: number;
      durationSeconds: number;
      difficultyRatio: { easy: number; medium: number; hard: number };
      questionTypes: AdminAiQuestionType[];
    };

export interface AdminLessonSummaryPromptPreview {
  promptVersion: string;
  schemaVersion: string;
  systemPrompt: string;
  userPrompt: string;
  inputPrompt: string;
  openAiRequest: {
    model: string | null;
    instructions: string;
    input: string;
    text: {
      format: Record<string, unknown>;
    };
    temperature: number;
    reasoning_effort?: string;
    max_output_tokens: number;
  };
  context: {
    documentCount: number;
    chunkCount: number;
    estimatedTokens: number;
    contextTokens: number;
    maxContextTokens: number;
  };
  configuration: {
    selectedModel: string | null;
    isDefaultConfigured: boolean;
    resolvedProvider: string | null;
    resolvedModel: string | null;
    temperature: number;
    reasoningEffort: string | null;
    maxOutputTokens: number;
    modelOptions: Array<{
      provider: string;
      model: string;
      available: boolean;
      capabilities?: {
        aiConfiguration?: AdminAiConfigurationCapability;
        reasoningEffortLevels?: string[];
        [key: string]: unknown;
      };
    }>;
  };
  estimatedCost: {
    available: boolean;
    upperBoundUsd: number | null;
    upperBoundVnd: number | null;
    fxRateVndPerUsd: number;
  };
}

export type AdminLessonSummaryReviewStatus =
  "DRAFT" | "NEEDS_REVIEW" | "APPROVED" | "HIDDEN";

export interface AdminLessonSummaryBlocksContent {
  type: "lesson_summary_blocks";
  version: number;
  data: Record<string, unknown>;
}

export type AdminLessonSummaryContent =
  TiptapTextDocument | AdminLessonSummaryBlocksContent;

export interface AdminLessonSummary {
  id: string;
  lessonId: string;
  contentJson: AdminLessonSummaryContent;
  source: "ADMIN" | "AI";
  reviewStatus: AdminLessonSummaryReviewStatus;
  aiGenerationId: string | null;
  createdAt: string;
  updatedAt: string;
}
