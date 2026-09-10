import { Inject, Injectable } from "@nestjs/common";
import { AiGenerationType } from "@prisma/client";
import { UnrecoverableError } from "bullmq";

import type {
  AiGenerationExecutionContext,
  AiGenerationPersistenceResult,
  AiGenerationPreparedOutput,
} from "#api/modules/ai/types/ai-generation.types";
import { LessonSummaryGenerationService } from "#api/workers/services/lesson-summary-generation.service";
import { LessonContentGenerationService } from "#api/workers/services/lesson-content-generation.service";
import { QuizGenerationService } from "#api/workers/services/quiz-generation.service";
import { FlashcardGenerationService } from "#api/workers/services/flashcard-generation.service";
import { VideoSummaryGenerationService } from "#api/workers/services/video-summary-generation.service";

/**
 * Dispatch boundary for M9 generation handlers.
 * M9.2-M9.7 add concrete generate/persist branches without changing lifecycle code.
 */
@Injectable()
export class AiGenerationExecutionService {
  constructor(
    @Inject(LessonSummaryGenerationService)
    private readonly lessonSummaryGeneration: LessonSummaryGenerationService,
    @Inject(LessonContentGenerationService)
    private readonly lessonContentGeneration: LessonContentGenerationService,
    @Inject(QuizGenerationService)
    private readonly quizGeneration: QuizGenerationService,
    @Inject(FlashcardGenerationService)
    private readonly flashcardGeneration: FlashcardGenerationService,
    @Inject(VideoSummaryGenerationService)
    private readonly videoSummaryGeneration: VideoSummaryGenerationService,
  ) {}

  async generate(
    context: AiGenerationExecutionContext,
  ): Promise<AiGenerationPreparedOutput> {
    if (context.type === AiGenerationType.SUMMARY) {
      return this.lessonSummaryGeneration.generate(context);
    }
    if (context.type === AiGenerationType.VIDEO_SUMMARY) {
      return this.videoSummaryGeneration.generate(context);
    }
    if (context.type === AiGenerationType.QUIZ) {
      return this.quizGeneration.generate(context);
    }
    if (context.type === AiGenerationType.FLASHCARD) {
      return this.flashcardGeneration.generate(context);
    }
    if (context.type === AiGenerationType.TEST) {
      if (usesAssessmentQuizPipeline(context.inputMeta)) {
        return this.quizGeneration.generate(context);
      }
      return this.lessonContentGeneration.generate(context);
    }
    throw new UnrecoverableError(
      `No AI generation handler is registered for ${context.type}.`,
    );
  }

  async persist(
    context: AiGenerationExecutionContext,
    prepared: AiGenerationPreparedOutput,
  ): Promise<AiGenerationPersistenceResult> {
    if (context.type === AiGenerationType.SUMMARY) {
      return this.lessonSummaryGeneration.persist(context, prepared);
    }
    if (context.type === AiGenerationType.VIDEO_SUMMARY) {
      return this.videoSummaryGeneration.persist(context, prepared);
    }
    if (context.type === AiGenerationType.QUIZ) {
      return this.quizGeneration.persist(context, prepared);
    }
    if (context.type === AiGenerationType.FLASHCARD) {
      return this.flashcardGeneration.persist(context, prepared);
    }
    if (context.type === AiGenerationType.TEST) {
      if (usesAssessmentQuizPipeline(context.inputMeta)) {
        return this.quizGeneration.persist(context, prepared);
      }
      return this.lessonContentGeneration.persist(context, prepared);
    }
    throw new UnrecoverableError("AI generation persistence handler is not registered.");
  }
}

/** Keep durable TEST jobs created before M6.6 on their original worker path. */
function usesAssessmentQuizPipeline(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    record.assessmentKind === "TEST" && record.pipelineVersion === "ASSESSMENT_QUIZ_V1"
  );
}
