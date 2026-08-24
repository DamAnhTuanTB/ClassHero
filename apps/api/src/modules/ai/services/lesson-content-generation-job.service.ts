import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { AiGenerationType, Difficulty, QuestionType } from "@prisma/client";

import { badRequestException, notFoundException } from "#api/common/errors/api-exception";
import { AiGenerationJobService } from "#api/modules/ai/services/ai-generation-job.service";
import {
  LessonContentContextError,
  LessonContentGenerationContextService,
} from "#api/modules/ai/services/lesson-content-generation-context.service";
import {
  LESSON_CONTENT_PROMPT_VERSION,
  LESSON_CONTENT_SCHEMA_VERSION,
} from "#api/modules/ai/types/lesson-content-generation.types";

const ALL_QUESTION_TYPES = Object.values(QuestionType);

@Injectable()
export class LessonContentGenerationJobService {
  constructor(
    @Inject(AiGenerationJobService)
    private readonly jobs: AiGenerationJobService,
    @Inject(LessonContentGenerationContextService)
    private readonly context: LessonContentGenerationContextService,
  ) {}

  queueFlashcards(
    lessonId: string,
    actorUserId: string,
    input: {
      cardCount: number;
      difficulty: Difficulty;
    },
  ) {
    return this.queue(AiGenerationType.FLASHCARD, lessonId, actorUserId, input);
  }

  queueTest(
    lessonId: string,
    actorUserId: string,
    input: {
      questionCount: number;
      durationSeconds: number;
      difficultyRatio: { easy: number; medium: number; hard: number };
      questionTypes?: QuestionType[];
    },
  ) {
    const ratioTotal =
      input.difficultyRatio.easy +
      input.difficultyRatio.medium +
      input.difficultyRatio.hard;
    if (Math.abs(ratioTotal - 1) > 0.001) {
      throw badRequestException(
        "AI_TEST_DIFFICULTY_RATIO_INVALID",
        "Tổng tỷ lệ độ khó phải bằng 1",
      );
    }
    const questionTypes = unique(input.questionTypes ?? ALL_QUESTION_TYPES);
    return this.queue(AiGenerationType.TEST, lessonId, actorUserId, {
      ...input,
      questionTypes,
    });
  }

  private async queue(
    type: AiGenerationType,
    lessonId: string,
    actorUserId: string,
    request: Record<string, unknown>,
  ) {
    const snapshot = await this.loadSnapshot(lessonId);
    const inputMeta = {
      ...request,
      documentIds: snapshot.documentIds,
      sourceHash: snapshot.sourceHash,
      targetGrade: snapshot.targetGrade,
      subjectKey: snapshot.subject.key,
      subjectName: snapshot.subject.name,
      subjectSlug: snapshot.subject.slug,
    };
    const job = await this.jobs.createAndEnqueue({
      type,
      createdByUserId: actorUserId,
      lessonId,
      targetType: `${type}_SET`,
      promptVersion: LESSON_CONTENT_PROMPT_VERSION,
      schemaVersion: LESSON_CONTENT_SCHEMA_VERSION,
      inputFingerprint: { lessonId, ...inputMeta },
      inputMeta,
      idempotencyKey: [
        "ai-content",
        type,
        lessonId,
        snapshot.sourceHash,
        randomUUID(),
      ].join(":"),
      deduplicateActive: true,
      maxAttempts: 3,
    });
    return { mode: "QUEUED" as const, jobId: job.backgroundJobId, status: job.status };
  }

  private async loadSnapshot(lessonId: string, documentIds?: string[]) {
    try {
      return await this.context.snapshot(lessonId, documentIds);
    } catch (error) {
      if (!(error instanceof LessonContentContextError)) throw error;
      if (error.code === "LESSON_NOT_FOUND") {
        throw notFoundException("LESSON_NOT_FOUND", error.message);
      }
      throw badRequestException(error.code, error.message);
    }
  }

}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}
