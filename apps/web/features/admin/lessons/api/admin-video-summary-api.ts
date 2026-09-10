import type { TiptapContent } from "@learning-path/shared";
import { apiRequest } from "@/lib/api-client";

export type VideoSummary = {
  id: string;
  lessonId: string;
  contentJson: TiptapContent;
  source: "AI" | "ADMIN";
  reviewStatus: "NEEDS_REVIEW" | "APPROVED" | "HIDDEN";
  aiGenerationId: string | null;
  staleAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type VideoSummaryRequest = {
  style: "student_friendly" | "concise" | "academic";
  styleInstructions?: string;
  length: "short" | "standard" | "detailed";
  targetWordCount?: number;
  extraInstructions?: string;
  systemInstructions?: string;
  userPrompt?: string;
  model?: string;
  temperature?: number;
  reasoningEffort?: string;
  maxOutputTokens?: number;
  requestDraftId?: string;
  requestHash?: string;
};
export type VideoSummaryPreview = {
  requestDraftId: string;
  requestHash: string;
  systemPrompt: string;
  userPrompt: string;
  sourcePacket: {
    videoUrl: string;
    transcript: Array<{ time: number; endTime?: number; text: string }>;
    chapters: Array<{ time: number; title: string }>;
    language: string | null;
    hashes: Record<string, string>;
  };
  schema: { name: string; version: string; json: unknown };
  model: {
    model: string;
    provider: string;
    temperature: number | null;
    reasoningEffort: string | null;
    maxOutputTokens: number | null;
    inputTokenEstimate: {
      textInputTokens: number;
      imageInputTokens: number;
      estimatedTokens: number;
      tokenBreakdown?: {
        systemInstructionsTokens: number;
        userPromptTokens: number;
        contextTokens: number;
        schemaTokens: number;
        textInputTokens: number;
        pdfInputTokens: number;
        estimatedTokens: number;
      };
    };
  };
  estimatedCost: {
    available: boolean;
    inputUpperBoundVnd: number | null;
    outputUpperBoundVnd: number | null;
    upperBoundVnd: number | null;
  };
};
export const getAdminVideoSummary = (lessonId: string, token: string) =>
  apiRequest<VideoSummary | null>(`/admin/lessons/${lessonId}/video-summary`, {
    method: "GET",
    token,
  });
export const previewAdminVideoSummary = (
  lessonId: string,
  body: VideoSummaryRequest,
  token: string,
) =>
  apiRequest<VideoSummaryPreview>(
    `/admin/lessons/${lessonId}/video-summary/prompt-preview`,
    { method: "POST", body, token },
  );
export const generateAdminVideoSummary = (
  lessonId: string,
  body: VideoSummaryRequest,
  token: string,
) =>
  apiRequest<{ jobId: string; status: string }>(
    `/admin/lessons/${lessonId}/video-summary/generate-ai`,
    { method: "POST", body, token },
  );
export const updateAdminVideoSummary = (
  lessonId: string,
  body: Pick<VideoSummary, "contentJson" | "source" | "reviewStatus">,
  token: string,
) =>
  apiRequest<VideoSummary>(`/admin/lessons/${lessonId}/video-summary`, {
    method: "PUT",
    body,
    token,
  });
export const deleteAdminVideoSummary = (lessonId: string, token: string) =>
  apiRequest<void>(`/admin/lessons/${lessonId}/video-summary`, {
    method: "DELETE",
    token,
  });
