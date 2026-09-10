import type { AiReasoningEffort, TiptapTextDocument } from "@learning-path/shared";
import type { AdminJobErrorDetails } from "@/lib/admin-job-error";

export type AdminAiGenerationType = "SUMMARY" | "QUIZ" | "FLASHCARD" | "TEST";
export type AdminAiGenerationDialogRequest = {
  type: AdminAiGenerationType;
  mode: "CREATE" | "EDIT";
};
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
  canUseForQuiz: boolean;
  canUseForFlashcard: boolean;
  unavailableReason: string | null;
  quizUnavailableReason: string | null;
  flashcardUnavailableReason: string | null;
}

export interface AdminAiModelConfiguration {
  isDefaultConfigured: boolean;
  resolvedProvider: string | null;
  resolvedModel: string | null;
  temperature: number | null;
  reasoningEffort: string | null;
  maxOutputTokens: number | null;
  schemaReferenceStrategy?: string;
  resolvedSchemaReferenceStrategy?: string;
  schemaBytes?: number;
  modelOptions: Array<{
    provider: string;
    model: string;
    available: boolean;
    capabilities?: {
      aiConfiguration?: AdminAiConfigurationCapability;
      reasoningEffortLevels?: string[];
      pdfInput?: boolean;
      pdfDetailLevels?: string[];
      [key: string]: unknown;
    };
  }>;
}

export interface AdminAiPanelJob {
  aiGenerationId: string;
  type: AdminAiGenerationType | "VIDEO_SUMMARY";
  jobId: string | null;
  status: AdminAiJobStatus;
  resourceType: string | null;
  resourceId: string | null;
  reviewStatus: AdminLessonSummaryReviewStatus | null;
  error: string | null;
  errorDetails: AdminJobErrorDetails | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
  model?: string | null;
  latencyMs?: number | null;
  estimatedCostVnd?: number | null;
  usageEventCount?: number;
  inputMetaJson?: {
    temperature?: number;
    reasoningEffort?: string;
    [key: string]: unknown;
  } | null;
}

export interface AdminAiGenerationPanelData {
  lesson: {
    id: string;
    title: string;
    subjectKey: "MATH" | "PHYSICS" | "CHEMISTRY" | "GENERAL";
    targetGrade: number | null;
  };
  readiness: {
    summaryReady: boolean;
    generationReady: boolean;
    quizReady: boolean;
    readyDocumentCount: number;
    embeddedDocumentCount: number;
    reason: string | null;
    quizReason: string | null;
  };
  documents: AdminAiPanelDocument[];
  summaryConfiguration: AdminAiModelConfiguration;
  summaryFigureConfiguration: AdminAiModelConfiguration;
  quizConfiguration: AdminAiModelConfiguration;
  quizFigureConfiguration: AdminAiModelConfiguration;
  testConfiguration: AdminAiModelConfiguration;
  testFigureConfiguration: AdminAiModelConfiguration;
  flashcardConfiguration: AdminAiModelConfiguration;
  flashcardFigureConfiguration: AdminAiModelConfiguration;
  videoSummaryConfiguration?: AdminAiModelConfiguration;
  jobs: Record<AdminAiGenerationType, AdminAiPanelJob | null>;
  videoSummaryJob: AdminAiPanelJob | null;
}

export interface AdminAiJobData {
  jobId: string;
  status: AdminAiJobStatus;
  resourceType: string | null;
  resourceId: string | null;
  result?: unknown;
  error: string | null;
  errorDetails: AdminJobErrorDetails | null;
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
  useTextbookSourceImages?: boolean;
  autoEnhanceTextbookSourceImages?: boolean;
  style: AdminSummaryStyle;
  styleInstructions?: string;
  length: AdminSummaryLength;
  targetWordCount?: number;
  standardExerciseCount: number;
  realWorldExerciseCount: number;
  extraInstructions?: string;
  systemInstructions?: string;
  userPrompt?: string;
  model?: string;
  temperature?: number;
  reasoningEffort?: AiReasoningEffort;
  maxOutputTokens?: number;
  figureModel?: string;
  figureTemperature?: number;
  figureReasoningEffort?: AiReasoningEffort;
  figureMaxOutputTokens?: number;
  requestDraftId?: string;
  requestHash?: string;
};

export type AdminQuizGenerationPayload = {
  type: "QUIZ";
  targetQuizSetId?: string;
  documentIds: string[];
  questionCount: number;
  realWorldQuestionCount?: number;
  difficulty: AdminAiDifficulty;
  difficultyCounts?: { easy: number; medium: number; hard: number };
  questionTypes: AdminAiQuestionType[];
  style: AdminSummaryStyle;
  styleInstructions?: string;
  extraInstructions?: string;
  systemInstructions?: string;
  userPrompt?: string;
  model?: string;
  temperature?: number;
  reasoningEffort?: AiReasoningEffort;
  maxOutputTokens?: number;
  figureModel?: string;
  figureTemperature?: number;
  figureReasoningEffort?: AiReasoningEffort;
  figureMaxOutputTokens?: number;
  requestDraftId?: string;
  requestHash?: string;
};

/**
 * Test uses the identical Quiz generation contract. The optional target is the
 * only Test-specific input at the transport boundary; when omitted for an empty
 * lesson, the API creates the first Test set with the default duration.
 */
export type AdminTestGenerationPayload = Omit<
  AdminQuizGenerationPayload,
  "type" | "targetQuizSetId"
> & {
  type: "TEST";
  targetTestSetId?: string;
};

export type AdminFlashcardGenerationPayload = {
  type: "FLASHCARD";
  targetFlashcardSetId?: string;
  documentIds: string[];
  cardCount: number;
  realWorldCardCount?: number;
  difficulty: AdminAiDifficulty;
  difficultyCounts?: { easy: number; medium: number; hard: number };
  style: AdminSummaryStyle;
  styleInstructions?: string;
  extraInstructions?: string;
  systemInstructions?: string;
  userPrompt?: string;
  model?: string;
  temperature?: number;
  reasoningEffort?: AiReasoningEffort;
  maxOutputTokens?: number;
  figureModel?: string;
  figureTemperature?: number;
  figureReasoningEffort?: AiReasoningEffort;
  figureMaxOutputTokens?: number;
  requestDraftId?: string;
  requestHash?: string;
};

export type AdminAiGenerationPayload =
  | AdminSummaryGenerationPayload
  | AdminQuizGenerationPayload
  | AdminFlashcardGenerationPayload
  | AdminTestGenerationPayload;

export interface AdminLessonSummaryPromptPreview {
  requestDraftId?: string;
  requestHash?: string;
  expiresAt?: string;
  promptVersion: string;
  schemaVersion: string;
  systemPrompt: string;
  userPrompt: string;
  inputPrompt: string;
  openAiFileUploadRequest?: {
    purpose: "user_data";
    file: string;
  };
  openAiRequest: {
    model: string | null;
    instructions?: string;
    input: unknown;
    text: {
      format: Record<string, unknown>;
    };
    temperature?: number;
    reasoning?: { effort: string };
    max_output_tokens: number;
    prompt_cache_key?: string;
    prompt_cache_options?: { mode: "explicit"; ttl: "30m" };
    prompt_cache_retention?: "24h";
  };
  context: {
    lessonTitle: string;
    documentCount: number;
    chunkCount: number;
    estimatedTokens: number;
    textInputTokens: number;
    pdfInputTokens: number;
    promptTokens?: number;
    schemaTokens?: number;
    contextTokens: number;
    maxContextTokens: number | null;
    packet?: {
      filename: string;
      sizeBytes: number;
      pageCount: number;
      packetHash: string;
      manifestHash: string;
      detail: "high";
      manifest: {
        version: 1;
        lessonId: string;
        packetHash: string;
        pageCount: number;
        pages: Array<{
          packetPageNumber: number;
          sourceKey: string;
          lessonDocumentId: string;
          sourceDocumentId: string | null;
          sourceFileId: string;
          sourcePdfPageNumber: number;
          printedPageLabel: string | null;
          pageRangeId: string | null;
          documentTitle: string;
          segmentOrder: number;
        }>;
      };
    };
    chunks?: Array<{
      id: string;
      documentId: string;
      documentTitle: string;
      chunkIndex: number;
      tokenCount: number;
      pageRange: { pageStart: number; pageEnd: number } | null;
      content: string;
    }>;
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
  configuration: AdminAiModelConfiguration & {
    targetQuizSet?: { id: string; title: string } | null;
    selectedModel: string | null;
    temperature: number;
    maxOutputTokens: number;
  };
  estimatedCost: {
    available: boolean;
    inputUpperBoundUsd: number | null;
    inputUpperBoundVnd: number | null;
    outputUpperBoundUsd: number | null;
    outputUpperBoundVnd: number | null;
    upperBoundUsd: number | null;
    upperBoundVnd: number | null;
    fxRateVndPerUsd: number;
  };
}

export interface AdminQuizPromptPreview {
  requestDraftId: string;
  requestHash: string;
  expiresAt: string;
  promptVersion: string;
  schemaVersion: string;
  systemPrompt: string;
  userPrompt: string;
  inputPrompt: string;
  openAiFileUploadRequest: {
    purpose: "user_data";
    file: string;
  };
  openAiRequest: {
    model: string | null;
    instructions?: string;
    input: unknown;
    text: { format: Record<string, unknown> };
    temperature?: number;
    reasoning?: { effort: string };
    max_output_tokens: number;
    prompt_cache_key?: string;
    prompt_cache_options?: { mode: "explicit"; ttl: "30m" };
    prompt_cache_retention?: "24h";
  };
  context: {
    lessonTitle: string;
    documentCount: number;
    chunkCount: number;
    estimatedTokens: number;
    textInputTokens: number;
    pdfInputTokens: number;
    promptTokens?: number;
    schemaTokens?: number;
    contextTokens: number;
    maxContextTokens: number | null;
    packet: NonNullable<AdminLessonSummaryPromptPreview["context"]["packet"]>;
    chunks: [];
  };
  configuration: AdminAiModelConfiguration & {
    targetQuizSet?: { id: string; title: string } | null;
    selectedModel?: string | null;
  };
  estimatedCost: {
    available: boolean;
    inputUpperBoundUsd: number | null;
    inputUpperBoundVnd: number | null;
    outputUpperBoundUsd: number | null;
    outputUpperBoundVnd: number | null;
    upperBoundUsd: number | null;
    upperBoundVnd: number | null;
    fxRateVndPerUsd: number;
  };
}

export type AdminTestPromptPreview = Omit<AdminQuizPromptPreview, "configuration"> & {
  configuration: AdminQuizPromptPreview["configuration"] & {
    targetTestSet?: { id: string; title: string; durationSeconds: number } | null;
  };
};

export interface AdminFlashcardPromptPreview {
  requestDraftId: string;
  requestHash: string;
  expiresAt: string;
  promptVersion: string;
  schemaVersion: string;
  systemPrompt: string;
  userPrompt: string;
  inputPrompt: string;
  openAiFileUploadRequest: AdminQuizPromptPreview["openAiFileUploadRequest"];
  openAiRequest: AdminLessonSummaryPromptPreview["openAiRequest"];
  context: Omit<AdminLessonSummaryPromptPreview["context"], "packet"> & {
    packet: NonNullable<AdminLessonSummaryPromptPreview["context"]["packet"]>;
    chunks: [];
  };
  configuration: AdminAiModelConfiguration & {
    targetFlashcardSet?: { id: string; title: string } | null;
    selectedModel?: string | null;
  };
  estimatedCost: AdminLessonSummaryPromptPreview["estimatedCost"];
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
  phaseOneBlockJsonByPath?: Record<string, unknown> | null;
  source: "ADMIN" | "AI";
  reviewStatus: AdminLessonSummaryReviewStatus;
  aiGenerationId: string | null;
  sourcePages?: AdminLessonSummarySourcePage[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminLessonSummarySourcePage {
  packetPageNumber: number;
  sourceFileId: string;
  sourcePdfPageNumber: number;
  printedPageLabel: string | null;
  documentTitle: string;
}

export type AdminStemFigureStatus =
  "QUEUED" | "RENDERING" | "REPAIRING" | "SUCCEEDED" | "NEEDS_REVIEW" | "FAILED";

export interface AdminStemFigureDiagnosticBatch {
  attemptId: string;
  sourceVersion: number;
  sourceHash: string;
  category: "COMPILER" | "SOURCE_POLICY" | "VALIDATOR" | "INFRASTRUCTURE";
  issues: Array<{
    code: string;
    severity: "ERROR" | "WARNING";
    message: string;
    file: string | null;
    line: number | null;
    column: number | null;
    element: string | null;
    path: string | null;
  }>;
  rawLogExcerpt: string;
  collectionComplete: boolean;
  batchHash: string;
  createdAt: string;
}

export interface AdminStemFigureProviderRequestSnapshotCollection {
  version: 1;
  calls: Array<{
    version: 1;
    idempotencyKey: string;
    callKind: "CREATE_NEW" | "COMPILER_REPAIR" | "VALIDATOR_REPAIR";
    repairKind: "AUTO_COMPILER" | "MANUAL_COMPILER" | "MANUAL_VALIDATOR" | null;
    callSequence: number;
    createdAt: string;
    request: {
      provider: string;
      model: string;
      catalogItemId: string | null;
      category: string;
      temperature: number | null;
      reasoningEffort: string | null;
      maxOutputTokens: number | null;
      outputName: string;
      promptVersion: string;
      schemaVersion: string;
      schemaReferenceStrategy?: string;
      systemPrompt: string;
      userPrompt: string;
      inputTextItems?: unknown[];
      inputFiles: unknown[];
      inputImages: Array<{
        order: number;
        detail: string | null;
        mimeType: string | null;
        byteLength: number | null;
        sha256: string;
      }>;
      textFormat: Record<string, unknown>;
      promptCache?: unknown;
    };
    generationBrief: Record<string, unknown> | null;
    referenceImages: Array<{
      order: number;
      objectKey: string;
      mimeType: string;
      label: string;
      packetPageNumber: number;
      source: "OCR_CROP" | "PDF_PAGE";
      detail: "low" | "high" | "auto" | "original";
      byteLength: number | null;
      sha256: string;
      accessUrl: string | null;
    }>;
    latexSource: string | null;
    diagnosticBatch: AdminStemFigureDiagnosticBatch | null;
  }>;
}

export interface AdminStemFigure {
  id: string;
  lessonId: string;
  lessonSummaryId: string | null;
  aiGenerationId: string | null;
  blockPath: string;
  figureIndex: number;
  localPlanId: string;
  planJson: unknown;
  figureOrigin: "TEXTBOOK_SOURCE" | "GENERATED_FROM_BRIEF" | null;
  subject: {
    key: "MATH" | "PHYSICS" | "CHEMISTRY" | "GENERAL";
    name: string;
    slug: string;
  };
  status: AdminStemFigureStatus;
  theme: "LIGHT";
  currentRevisionId: string | null;
  pendingRevisionId: string | null;
  hasCurrentAsset: boolean;
  sourceKind: "AI_TEX" | "ADMIN_UPLOAD";
  currentAssetKind: "AI_TEX" | "ADMIN_UPLOAD" | "TEXTBOOK_SOURCE" | null;
  currentRevisionOrigin:
    | "INITIAL_AI"
    | "AUTO_REPAIR"
    | "ADMIN_EDIT"
    | "ADMIN_REGENERATE"
    | "ADMIN_UPLOAD"
    | "MANUAL_REPAIR"
    | null;
  openAiGenerationCostVnd?: number | null;
  openAiCachedInputTokens?: number | null;
  displayScale?: number | null;
  latexSource: string | null;
  sourceHash: string;
  sourceVersion: number;
  altText: string;
  caption: string | null;
  previewSvg: string | null;
  assetUrl: string | null;
  rendererVersion: string | null;
  validatorVersion: string | null;
  repairCount: number;
  maxRepairAttempts: number;
  lastErrorCategory: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  diagnosticBatch: AdminStemFigureDiagnosticBatch | null;
  retryUsesAi: boolean;
  retryIssueCount: number;
  latestAttemptId: string | null;
  providerRequestSnapshots: AdminStemFigureProviderRequestSnapshotCollection | null;
  sourceReferenceSnapshotHash: string | null;
  sourceReferenceImages: AdminStemFigureSourceReferenceImage[];
  updatedAt: string;
}

export interface AdminStemFigureSourceReferenceImage {
  index: number;
  objectKey: string;
  mimeType: string;
  label: string;
  packetPageNumber: number;
  source: "OCR_CROP" | "PDF_PAGE";
  canUseAsFigure: boolean;
  accessUrl: string | null;
}

export type AdminStemFigureReferenceImageMode =
  "SOURCE_CROP_ONLY" | "CURRENT_ONLY" | "NONE";

export type AdminStemFigureAiTargetMode = "QUESTION" | "SOLUTION";

interface AdminStemFigureCreateAiOptions {
  referenceImageMode: AdminStemFigureReferenceImageMode;
  targetMode?: AdminStemFigureAiTargetMode | null;
  adminInstructions: string | null;
  model?: string | null;
  temperature?: number | null;
  reasoningEffort?: AiReasoningEffort | null;
  systemPrompt?: string | null;
  userPrompt?: string | null;
}

export type AdminStemFigureCreateAiInput = AdminStemFigureCreateAiOptions &
  (
    | {
        figure: AdminStemFigure;
        blockPath?: never;
        figureIndex?: never;
      }
    | {
        figure?: never;
        blockPath: string;
        figureIndex?: number;
      }
  );

export interface AdminStemFigureCreateAiPreview {
  referenceImageMode: AdminStemFigureReferenceImageMode;
  adminInstructions: string | null;
  generationBrief: Record<string, unknown>;
  providerInput: Record<string, unknown>;
  systemPrompt: string;
  userPrompt: string;
  configuration: {
    resolvedProvider: string | null;
    resolvedModel: string | null;
    temperature: number | null;
    reasoningEffort: string | null;
    maxOutputTokens: number;
  };
  context: {
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
  estimatedCost: {
    available: boolean;
    inputUpperBoundUsd: number | null;
    inputUpperBoundVnd: number | null;
    outputUpperBoundUsd: number | null;
    outputUpperBoundVnd: number | null;
    upperBoundUsd: number | null;
    upperBoundVnd: number | null;
    fxRateVndPerUsd: number;
  };
  referenceImages: Array<{
    order: number;
    objectKey: string;
    mimeType: string;
    label: string;
    packetPageNumber: number | null;
    source: "OCR_CROP" | "PDF_PAGE" | "CURRENT_FIGURE";
    accessUrl: string | null;
  }>;
}

export interface AdminStemFigureCompileResult {
  revisionId: string;
  status: "DRAFT_READY" | "NEEDS_REVIEW" | "FAILED";
  sourceVersion?: number;
  previewSvg?: string;
  diagnosticBatch?: AdminStemFigureDiagnosticBatch;
}

export interface AdminStemFigureRasterEditOperations {
  enhance: boolean;
  removeSimpleDetails: boolean;
  pipelineVersion: "TEXTBOOK_RASTER_CLEANUP_V2";
}

export interface AdminStemFigureRasterEditInput {
  figure: AdminStemFigure;
  operations: AdminStemFigureRasterEditOperations;
  mask: Blob | null;
}

export interface AdminStemFigureRasterEditPreview {
  pipelineVersion: "TEXTBOOK_RASTER_CLEANUP_V2";
  previewDataUrl: string;
  width: number;
  height: number;
  maskCoverageRatio: number | null;
  backgroundVariance: number | null;
  warnings: string[];
}

export interface AdminStemFigureRasterEditApplyResult {
  figure: AdminStemFigure;
  auditId: string;
  revisionId: string;
}
