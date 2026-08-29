import { apiRequest, type ApiRequestOptions } from "@/lib/api-client";
import type {
  AdminAiModelConfiguration,
  AdminAiJobData,
  AdminStemFigureCreateAiPreview,
} from "@/features/admin/ai-generation/types/admin-ai-generation.types";
import type { AiReasoningEffort, TiptapTextDocument } from "@learning-path/shared";

export type QuizDifficulty = "EASY" | "MEDIUM" | "HARD" | "MIXED";
export type QuizQuestionType =
  "MULTIPLE_CHOICE" | "TRUE_FALSE" | "MULTI_STATEMENT_TRUE_FALSE" | "TEXT_INPUT";

export interface AdminQuizOption {
  id: string;
  richText: TiptapTextDocument;
}

export interface AdminMultiStatementAnswer {
  statementId: string;
  value: boolean;
}

export interface AdminQuizQuestionPayload {
  questionType: QuizQuestionType;
  difficulty: Exclude<QuizDifficulty, "MIXED">;
  questionJson: TiptapTextDocument;
  optionsJson?: AdminQuizOption[];
  correctAnswerJson: string[] | boolean | AdminMultiStatementAnswer[];
  hintJson?: TiptapTextDocument | null;
  explanationJson?: TiptapTextDocument | null;
}

export interface AdminQuizGenerationIssue {
  classification?: "VALID" | "AUTO_FIXED" | "REVIEWABLE";
  code: string;
  message: string;
  questionIndex?: number;
  blocking?: boolean;
  technicalDetails?: string;
}

export interface AdminQuizGenerationMetadata {
  generationAudit?: {
    requestedCount: number;
    initialGeneratedCount: number;
    deletedCount: number;
    currentActiveCount: number;
  };
  generationIssues?: AdminQuizGenerationIssue[];
  [key: string]: unknown;
}

export type AdminQuizQuestionUpdatePayload = Partial<AdminQuizQuestionPayload> & {
  quizExplanationBlock?: unknown;
};

export interface AdminQuizSet {
  id: string;
  lessonId: string;
  title: string;
  source: string;
  reviewStatus: string;
  questionCount: number;
  sortOrder: number;
  _count?: {
    questions: number;
  };
  pendingReviewQuestionCount?: number;
  unpublishedApprovedQuestionCount?: number;
  aiGenerations?: Array<{
    id: string;
    createdAt: string;
    finishedAt: string | null;
    inputMetaJson: AdminQuizGenerationMetadata | null;
    model: string | null;
    startedAt: string | null;
    status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";
    totalCostVnd: number;
    usageEventCount: number;
  }>;
  aiGeneration?: {
    id: string;
    inputMetaJson: AdminQuizGenerationMetadata | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminQuizQuestion {
  id: string;
  quizSetId: string;
  questionType: QuizQuestionType;
  difficulty: Exclude<QuizDifficulty, "MIXED">;
  questionJson: TiptapTextDocument;
  optionsJson: AdminQuizOption[] | null;
  correctAnswerJson: string[] | boolean | AdminMultiStatementAnswer[];
  hintJson: TiptapTextDocument | null;
  gradingConfigJson: {
    caseSensitive?: boolean;
    exactMatch?: boolean;
    numericComparison?: boolean;
    keywords?: string[];
  } | null;
  explanation: {
    id: string;
    contentJson: TiptapTextDocument;
    reviewStatus: string;
    staleAt: string | null;
  } | null;
  sourceMetadataJson: {
    aiGenerationId?: string;
    generationQuestionIndex?: number;
    quizExplanationBlock?: unknown;
    [key: string]: unknown;
  } | null;
  generationQuestionJson?: Record<string, unknown> | null;
  reviewStatus: string;
  figures: AdminQuizFigure[];
}

export interface AdminQuizFigure {
  id: string;
  role: "QUESTION" | "SOLUTION";
  status: "QUEUED" | "RENDERING" | "REPAIRING" | "SUCCEEDED" | "NEEDS_REVIEW" | "FAILED";
  pendingAiTargetMode?: AdminQuizFigureAiTargetMode | null;
  openAiGenerationCostVnd?: number | null;
  openAiCachedInputTokens?: number | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  currentRevision: {
    id: string;
    origin:
      | "INITIAL_AI"
      | "AUTO_REPAIR"
      | "AI_REFINEMENT"
      | "ADMIN_EDIT"
      | "ADMIN_REGENERATE"
      | "ADMIN_UPLOAD"
      | "MANUAL_REPAIR";
    status:
      | "QUEUED"
      | "RENDERING"
      | "REPAIRING"
      | "DRAFT_READY"
      | "SUCCEEDED"
      | "NEEDS_REVIEW"
      | "FAILED";
    sourceKind: "AI_TEX" | "ADMIN_UPLOAD";
    sourceVersion: number;
    latexSource: string | null;
    previewSvg: string | null;
    altText: string;
    caption: string | null;
    displayScale?: number | null;
    deliveryFile: {
      id: string;
      mimeType: string;
      publicUrl: string | null;
    } | null;
  } | null;
}

export interface AdminQuizFigureCompileResult {
  revisionId: string;
  sourceVersion: number;
  status: "DRAFT_READY";
  previewSvg: string;
}

export interface AdminQuizFigureCreateAiInput {
  mode: "REGENERATE" | "EDIT_CURRENT";
  adminInstructions: string | null;
  model?: string | null;
  temperature?: number | null;
  reasoningEffort?: AiReasoningEffort | null;
  systemPrompt?: string | null;
  userPrompt?: string | null;
}

export type AdminQuizFigureAiTargetMode = "QUESTION" | "SOLUTION";

export interface AdminQuizQuestionFigureCreateAiInput extends AdminQuizFigureCreateAiInput {
  targetMode: AdminQuizFigureAiTargetMode;
  baseRevisionId: string | null;
}

export interface AdminQuizFigureCreateAiPreview extends Omit<
  AdminStemFigureCreateAiPreview,
  "referenceImageMode" | "generationBrief" | "referenceImages" | "configuration"
> {
  mode: AdminQuizFigureCreateAiInput["mode"];
  configuration: AdminAiModelConfiguration;
}

export interface AdminQuizFigureRefinementPreview extends Omit<
  AdminQuizFigureCreateAiPreview,
  "mode"
> {
  operation: "REFINE_CURRENT";
  currentImageDataUrl: string;
}

export interface AdminQuizSolutionRefinementPreview {
  mode: AdminQuizSolutionMode;
  includeCurrentSolutionAsRejected: boolean;
  requestHash: string;
  baseContentHash: string;
  questionImageDataUrl: string | null;
  providerInput: Record<string, unknown>;
  systemPrompt: string;
  userPrompt: string;
  configuration: AdminAiModelConfiguration;
  context: AdminStemFigureCreateAiPreview["context"];
  estimatedCost: AdminStemFigureCreateAiPreview["estimatedCost"];
}

export type AdminQuizSolutionMode = "REFINE" | "REGENERATE";

export interface AdminQuizInitialData {
  questions: AdminQuizQuestion[];
  questionSetId: string | null;
  sets: AdminQuizSet[];
}

export interface AdminQuizBulkReviewResult {
  approvedQuestionCount: number;
  pendingReviewQuestionCount: number;
}

type AdminQuizReadOptions = Pick<ApiRequestOptions, "cache">;

export async function getAdminQuizSets(
  lessonId: string,
  token: string,
  options: AdminQuizReadOptions = {},
) {
  return apiRequest<AdminQuizSet[]>(`/admin/lessons/${lessonId}/quiz-sets`, {
    cache: options.cache,
    method: "GET",
    token,
  });
}

export async function createAdminQuizSet(
  lessonId: string,
  data: { title: string },
  token: string,
) {
  return apiRequest<AdminQuizSet>(`/admin/lessons/${lessonId}/quiz-sets`, {
    method: "POST",
    body: data,
    token,
  });
}

export async function updateAdminQuizSet(
  setId: string,
  data: { title?: string },
  token: string,
) {
  return apiRequest<AdminQuizSet>(`/admin/quiz-sets/${setId}`, {
    method: "PATCH",
    body: data,
    token,
  });
}

export async function deleteAdminQuizSet(setId: string, token: string) {
  return apiRequest<{ success: boolean }>(`/admin/quiz-sets/${setId}`, {
    method: "DELETE",
    token,
  });
}

export async function getAdminQuizQuestions(
  setId: string,
  token: string,
  options: AdminQuizReadOptions = {},
) {
  return apiRequest<AdminQuizQuestion[]>(`/admin/quiz-sets/${setId}/questions`, {
    cache: options.cache,
    method: "GET",
    token,
  });
}

export async function createAdminQuizQuestion(
  setId: string,
  data: AdminQuizQuestionPayload,
  token: string,
) {
  return apiRequest<AdminQuizQuestion>(`/admin/quiz-sets/${setId}/questions`, {
    method: "POST",
    body: data,
    token,
  });
}

export async function updateAdminQuizQuestion(
  questionId: string,
  data: AdminQuizQuestionUpdatePayload,
  token: string,
) {
  return apiRequest<AdminQuizQuestion>(`/admin/quiz-questions/${questionId}`, {
    method: "PATCH",
    body: data,
    token,
  });
}

export async function updateAdminQuizGenerationQuestionJson(
  questionId: string,
  generationQuestionJson: Record<string, unknown>,
  token: string,
) {
  return apiRequest<AdminQuizQuestion>(
    `/admin/quiz-questions/${questionId}/generation-json`,
    {
      method: "PATCH",
      body: { generationQuestionJson },
      token,
    },
  );
}

export async function reviewAdminQuizQuestion(questionId: string, token: string) {
  return apiRequest<AdminQuizQuestion>(`/admin/quiz-questions/${questionId}/review`, {
    method: "POST",
    body: { reviewStatus: "APPROVED" },
    token,
  });
}

export async function reviewAllPendingAdminQuizQuestions(setId: string, token: string) {
  return apiRequest<AdminQuizBulkReviewResult>(
    `/admin/quiz-sets/${setId}/questions/review-all-ai`,
    {
      method: "POST",
      token,
    },
  );
}

export async function deleteAdminQuizQuestion(questionId: string, token: string) {
  return apiRequest<{ success: boolean }>(`/admin/quiz-questions/${questionId}`, {
    method: "DELETE",
    token,
  });
}

export async function uploadAdminQuizImage(file: File, token: string) {
  const formData = new FormData();
  formData.set("purpose", "QUESTION_IMAGE");
  formData.set("file", file);

  const uploadedFile = await apiRequest<{
    id: string;
    originalName: string;
    publicUrl: string | null;
  }>("/files/upload", {
    method: "POST",
    body: formData,
    token,
  });
  const imageUrl = uploadedFile.publicUrl
    ? uploadedFile.publicUrl
    : (
        await apiRequest<{ url: string }>(`/files/${uploadedFile.id}/signed-url`, {
          token,
        })
      ).url;

  return {
    fileId: uploadedFile.id,
    fileName: uploadedFile.originalName,
    imageUrl,
  };
}

export async function attachAdminQuizFigureUpload(
  questionId: string,
  data: {
    role: "QUESTION" | "SOLUTION";
    fileId: string;
    altText: string;
    caption?: string;
  },
  token: string,
) {
  return apiRequest<AdminQuizFigure>(
    `/admin/quiz-questions/${questionId}/figures/admin-upload`,
    { method: "POST", body: data, token },
  );
}

export function compileAdminQuizFigureDraft(
  questionId: string,
  figureId: string,
  data: {
    baseRevisionId: string | null;
    sourceVersion: number;
    latexSource: string;
    altText: string;
    caption: string | null;
  },
  token: string,
) {
  return apiRequest<AdminQuizFigureCompileResult>(
    `/admin/quiz-questions/${questionId}/figures/${figureId}/drafts/compile`,
    { method: "POST", body: data, token },
  );
}

export function applyAdminQuizFigureDraft(
  questionId: string,
  figureId: string,
  data: {
    baseRevisionId: string | null;
    revisionId: string;
    sourceVersion: number;
  },
  token: string,
) {
  return apiRequest<{ status: "SUCCEEDED"; revisionId: string }>(
    `/admin/quiz-questions/${questionId}/figures/${figureId}/drafts/apply`,
    { method: "POST", body: data, token },
  );
}

export function createNewAdminQuizFigureWithAi(
  questionId: string,
  figureId: string,
  data: AdminQuizFigureCreateAiInput & { baseRevisionId: string | null },
  token: string,
) {
  return apiRequest<{ jobId: string; status: string }>(
    `/admin/quiz-questions/${questionId}/figures/${figureId}/create-new-ai`,
    { method: "POST", body: data, token },
  );
}

export function createAdminQuizFigureForQuestionWithAi(
  questionId: string,
  data: AdminQuizQuestionFigureCreateAiInput,
  token: string,
) {
  return apiRequest<{ jobId: string; status: string }>(
    `/admin/quiz-questions/${questionId}/figures/create-ai`,
    { method: "POST", body: data, token },
  );
}

export function previewAdminQuizFigureForQuestionWithAi(
  questionId: string,
  data: AdminQuizQuestionFigureCreateAiInput,
  token: string,
) {
  return apiRequest<AdminQuizFigureCreateAiPreview>(
    `/admin/quiz-questions/${questionId}/figures/create-ai/preview`,
    { method: "POST", body: data, token },
  );
}

export function previewNewAdminQuizFigureWithAi(
  questionId: string,
  figureId: string,
  data: AdminQuizFigureCreateAiInput & { baseRevisionId: string | null },
  token: string,
) {
  return apiRequest<AdminQuizFigureCreateAiPreview>(
    `/admin/quiz-questions/${questionId}/figures/${figureId}/create-new-ai/preview`,
    { method: "POST", body: data, token },
  );
}

export function refineAdminQuizFigureWithAi(
  questionId: string,
  figureId: string,
  data: {
    baseRevisionId: string | null;
    adminInstructions: string | null;
  },
  token: string,
) {
  return apiRequest<{ jobId: string; status: string }>(
    `/admin/quiz-questions/${questionId}/figures/${figureId}/refine-ai`,
    { method: "POST", body: data, token },
  );
}

export function previewAdminQuizFigureRefinement(
  questionId: string,
  figureId: string,
  data: {
    baseRevisionId: string | null;
    adminInstructions: string | null;
  },
  token: string,
) {
  return apiRequest<AdminQuizFigureRefinementPreview>(
    `/admin/quiz-questions/${questionId}/figures/${figureId}/refine-ai/preview`,
    { method: "POST", body: data, token },
  );
}

export function updateAdminQuizFigureCaption(
  questionId: string,
  figureId: string,
  data: { baseRevisionId: string | null; caption: string | null },
  token: string,
) {
  return apiRequest<AdminQuizFigure>(
    `/admin/quiz-questions/${questionId}/figures/${figureId}/caption`,
    { method: "PATCH", body: data, token },
  );
}

export function deleteAdminQuizFigure(
  questionId: string,
  figureId: string,
  data: { baseRevisionId: string | null },
  token: string,
) {
  return apiRequest<{ deleted: true; figureId: string }>(
    `/admin/quiz-questions/${questionId}/figures/${figureId}`,
    { method: "DELETE", body: data, token },
  );
}

export function previewAdminQuizSolutionRefinement(
  questionId: string,
  data: {
    mode: AdminQuizSolutionMode;
    adminInstructions?: string;
    includeCurrentSolutionAsRejected: boolean;
  },
  token: string,
) {
  return apiRequest<AdminQuizSolutionRefinementPreview>(
    `/admin/quiz-questions/${questionId}/solution-refinement/preview`,
    { method: "POST", body: data, token },
  );
}

export function queueAdminQuizSolutionRefinement(
  questionId: string,
  data: {
    mode: AdminQuizSolutionMode;
    adminInstructions?: string;
    includeCurrentSolutionAsRejected: boolean;
    requestHash: string;
  },
  token: string,
) {
  return apiRequest<{ mode: "QUEUED"; jobId: string; status: string }>(
    `/admin/quiz-questions/${questionId}/solution-refinement`,
    { method: "POST", body: data, token },
  );
}

export function getAdminQuizSolutionRefinementJob(jobId: string, token: string) {
  return apiRequest<AdminAiJobData>(`/jobs/${jobId}`, { method: "GET", token });
}
