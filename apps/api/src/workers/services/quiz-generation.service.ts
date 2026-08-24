import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  AiExplanationTargetType,
  AiGenerationType,
  ContentSource,
  Prisma,
  ReviewStatus,
} from "@prisma/client";
import { UnrecoverableError } from "bullmq";

import { PrismaService } from "#api/common/prisma/prisma.service";
import { toJobJson } from "#api/jobs/job-json";
import { AiProviderCallService } from "#api/modules/ai/services/ai-provider-call.service";
import { AiService } from "#api/modules/ai/services/ai.service";
import type {
  AiGenerationExecutionContext,
  AiGenerationPersistenceResult,
  AiGenerationPreparedOutput,
} from "#api/modules/ai/types/ai-generation.types";
import { hashAiValue } from "#api/modules/ai/utils/ai-hash";
import { parseAiStructuredOutput } from "#api/modules/ai/utils/ai-output-validation";
import { buildAiStructuredTextFormat } from "#api/modules/ai/utils/ai-structured-output-format";
import { QuizFigureJobService } from "#api/modules/quiz-figures/services/quiz-figure-job.service";
import { QuizGenerationContextService } from "#api/modules/quiz/services/quiz-generation-context.service";
import {
  getGeneratedQuizOutputSchema,
  quizGenerationJobInputSchema,
  type GeneratedQuizQuestion,
} from "#api/modules/quiz/types/quiz-generation.types";
import {
  getGeneratedQuizSolutionText,
  mapGeneratedQuizQuestion,
} from "#api/modules/quiz/utils/quiz-generation-mapper";
import { normalizeGeneratedQuizQuestionContent } from "#api/modules/quiz/utils/quiz-generation-content-normalizer";
import { buildQuizStructuredInput } from "#api/modules/quiz/utils/quiz-generation-prompt";
import {
  type GenerationRecoveryIssue,
  validateQuizOutput,
} from "#api/modules/quiz/utils/quiz-generation-validation";

@Injectable()
export class QuizGenerationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiService) private readonly aiService: AiService,
    @Inject(QuizGenerationContextService)
    private readonly generationContext: QuizGenerationContextService,
    @Inject(QuizFigureJobService)
    private readonly quizFigureJobs: QuizFigureJobService,
    @Optional()
    @Inject(AiProviderCallService)
    private readonly providerCall?: AiProviderCallService,
  ) {}

  async generate(
    context: AiGenerationExecutionContext,
  ): Promise<AiGenerationPreparedOutput> {
    if (!context.lessonId || context.type !== AiGenerationType.QUIZ) {
      throw new UnrecoverableError("Quiz generation requires a QUIZ job with lessonId.");
    }
    const input = parseJobInput(quizGenerationJobInputSchema, context.inputMeta, "quiz");
    const draft = await this.prisma.quizGenerationRequestDraft.findFirst({
      where: { id: input.requestDraftId, lessonId: context.lessonId },
    });
    if (
      !draft ||
      draft.requestHash !== input.requestHash ||
      draft.packetHash !== input.packetHash ||
      draft.manifestHash !== input.manifestHash
    ) {
      throw new UnrecoverableError(
        "AI_INPUT_SNAPSHOT_STALE: Không tìm thấy request draft Quiz bất biến khớp với job.",
      );
    }
    const currentSourceHash = await this.generationContext.computeCurrentSourceHash(
      context.lessonId,
      input.documentIds,
    );
    if (currentSourceHash !== input.sourceHash) {
      throw new UnrecoverableError(
        "AI_SOURCE_CONTEXT_STALE: Tài liệu buổi học đã thay đổi sau khi job được tạo.",
      );
    }
    const packetBytes = await this.generationContext.downloadPacket(
      draft.packetObjectKey,
    );
    const packetHash = createHash("sha256").update(packetBytes).digest("hex");
    if (
      packetHash !== draft.packetHash ||
      BigInt(packetBytes.length) !== draft.packetSizeBytes
    ) {
      throw new UnrecoverableError(
        "AI_INPUT_PACKET_INVALID: Packet PDF Quiz không còn khớp snapshot.",
      );
    }
    const sourceSnapshot = asRecord(draft.sourceSnapshotJson);
    readQuizPacketManifest(draft.manifestJson);
    const request = buildQuizStructuredInput({
      lessonId: context.lessonId,
      lessonTitle: readRequiredText(sourceSnapshot.lessonTitle, "lessonTitle"),
      documentIds: input.documentIds,
      sourceHash: input.sourceHash,
      packet: {
        filename: draft.packetFilename,
        bytes: packetBytes,
      },
      configuration: {
        ...input,
        systemInstructions: draft.systemInstructions,
        userPrompt: draft.userPrompt,
      },
    });
    const providerSchema = getGeneratedQuizOutputSchema({
      subjectKey: input.subjectKey,
      targetGrade: input.targetGrade,
      questionCount: input.questionCount,
      questionTypes: input.questionTypes,
      difficulty: input.difficulty,
    });
    const schemaHash = hashAiValue(
      buildAiStructuredTextFormat(
        providerSchema,
        request.outputName,
        request.schemaReferenceStrategy,
      ).schema,
    );
    if (schemaHash !== draft.schemaHash) {
      throw new UnrecoverableError(
        "AI_INPUT_SCHEMA_STALE: Output schema Quiz đã thay đổi sau khi preview.",
      );
    }
    let output;
    try {
      output = this.providerCall
        ? await this.providerCall.generateStructured(
            providerContext(context),
            request,
            providerSchema,
          )
        : await this.aiService.generateStructured(request, providerSchema);
    } finally {
      await this.generationContext
        .cleanupPacket(draft.packetObjectKey)
        .catch(() => undefined);
    }
    const normalizedQuestions = output.data.questions.map(
      normalizeGeneratedQuizQuestionContent,
    );
    const validation = validateQuizOutput({
      questions: normalizedQuestions,
      requestedCount: input.questionCount,
      requestedTypes: input.questionTypes,
      requestedDifficulty: input.difficulty,
      difficultyCounts: input.difficultyCounts,
    });
    return {
      action: "QUIZ",
      output: {
        ...output,
        data: { ...output.data, questions: validation.questions },
      },
      contextMetadata: validation.metadata,
    };
  }

  async persist(
    context: AiGenerationExecutionContext,
    prepared: AiGenerationPreparedOutput,
  ): Promise<AiGenerationPersistenceResult> {
    if (!context.lessonId || context.type !== AiGenerationType.QUIZ) {
      throw new UnrecoverableError("Quiz persistence requires a QUIZ job with lessonId.");
    }
    const input = parseJobInput(quizGenerationJobInputSchema, context.inputMeta, "quiz");
    const output = parseAiStructuredOutput(
      getGeneratedQuizOutputSchema({
        subjectKey: input.subjectKey,
        targetGrade: input.targetGrade,
        questionCount: input.questionCount,
        questionTypes: input.questionTypes,
        difficulty: input.difficulty,
      }),
      prepared.output.data,
    );
    const normalizedQuestions = output.questions.map(
      normalizeGeneratedQuizQuestionContent,
    );
    const persisted = await this.prisma.$transaction(async (tx) => {
      const set = await tx.quizSet.findFirst({
        where: {
          id: input.targetQuizSetId ?? undefined,
          lessonId: context.lessonId!,
          deletedAt: null,
        },
        select: { id: true, questionCount: true },
      });
      if (!set) {
        throw new UnrecoverableError(
          "QUIZ_TARGET_SET_NOT_FOUND: The selected Quiz set no longer exists.",
        );
      }
      const lastQuestion = await tx.quizQuestion.findFirst({
        where: { quizSetId: set.id, deletedAt: null },
        orderBy: [{ sortOrder: "desc" }, { createdAt: "desc" }],
        select: { sortOrder: true },
      });
      const firstSortOrder = (lastQuestion?.sortOrder ?? -1) + 1;
      const mappingIssues: GenerationRecoveryIssue[] = [];
      const questionFigureIds: string[] = [];
      for (const [index, question] of normalizedQuestions.entries()) {
        const created = await createGeneratedQuizQuestion(
          tx,
          set.id,
          context,
          question,
          firstSortOrder + index,
          index,
          input.subjectKey,
          input.subjectName,
          input.subjectSlug,
        );
        mappingIssues.push(...created.recoveryIssues);
        if (created.questionFigureId) questionFigureIds.push(created.questionFigureId);
      }
      await tx.quizSet.update({
        where: { id: set.id },
        data: {
          questionCount: set.questionCount + normalizedQuestions.length,
          updatedById: context.ownerUserId,
        },
      });
      const recovery = readRecoveryMetadata(prepared.contextMetadata);
      const generationIssues = [...recovery.issues, ...mappingIssues];
      const generationAudit = {
        requestedCount: input.questionCount,
        initialGeneratedCount:
          recovery.initialGeneratedCount > 0
            ? recovery.initialGeneratedCount
            : normalizedQuestions.length,
        currentActiveCount: normalizedQuestions.length,
        deletedCount: 0,
      };
      await tx.aiGeneration.update({
        where: { id: context.aiGenerationId },
        data: {
          inputMetaJson: json({
            ...asRecord(context.inputMeta),
            generationAudit,
            generationIssues,
          }),
        },
      });
      await auditGeneratedQuiz(tx, context, set.id);
      return {
        questionFigureIds,
        response: {
          resourceType: "QUIZ_SET",
          resourceId: set.id,
          message:
            generationIssues.length > 0
              ? "Đã thêm câu hỏi AI vào bộ Quiz và giữ các mục cần admin kiểm tra."
              : "Đã thêm câu hỏi AI vào bộ Quiz.",
          result: {
            reviewStatus: ReviewStatus.NEEDS_REVIEW,
            itemCount: normalizedQuestions.length,
            generationAudit,
            generationIssues,
          },
        },
      };
    });
    await Promise.all(
      persisted.questionFigureIds.map((figureId) =>
        this.quizFigureJobs.enqueue(
          figureId,
          context.ownerUserId,
          context.providerRouteSnapshot,
        ),
      ),
    );
    return persisted.response;
  }
}

function providerContext(context: AiGenerationExecutionContext) {
  return {
    feature: context.type,
    aiGenerationId: context.aiGenerationId,
    backgroundJobId: context.backgroundJobId,
    attempt: context.attempt,
    routeSnapshot: context.providerRouteSnapshot,
  };
}

async function createGeneratedQuizQuestion(
  tx: Prisma.TransactionClient,
  setId: string,
  context: AiGenerationExecutionContext,
  question: GeneratedQuizQuestion,
  sortOrder: number,
  questionIndex: number,
  subjectKey: string,
  subjectName: string,
  subjectSlug: string,
) {
  const mapped = mapGeneratedQuizQuestion(question);
  const id = randomUUID();
  const explanationId = randomUUID();
  await tx.aiExplanation.create({
    data: {
      id: explanationId,
      targetType: AiExplanationTargetType.QUIZ_QUESTION,
      targetId: id,
      lessonId: context.lessonId!,
      contentJson: json(mapped.explanationJson),
      source: ContentSource.AI,
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      aiGenerationId: context.aiGenerationId,
      targetContentHash: hashAiValue(mapped.questionJson),
      sourceContextHash: null,
    },
  });
  await tx.quizQuestion.create({
    data: {
      id,
      quizSetId: setId,
      lessonId: context.lessonId!,
      questionType: mapped.questionType,
      questionJson: json(mapped.questionJson),
      optionsJson: nullableJson(mapped.optionsJson),
      correctAnswerJson: json(mapped.correctAnswerJson),
      hintJson: nullableJson(mapped.hintJson),
      gradingConfigJson: nullableJson(mapped.gradingConfigJson),
      sourceMetadataJson: json({
        aiGenerationId: context.aiGenerationId,
        generationQuestionIndex: questionIndex,
        quizExplanationBlock: mapped.explanationBlock,
      }),
      difficulty: mapped.difficulty,
      reviewStatus: ReviewStatus.NEEDS_REVIEW,
      explanationId,
      sortOrder,
      solutionFigureMode: question.figure.solutionFigureMode,
    },
  });
  let questionFigureId: string | null = null;
  if (question.figure.questionFigure) {
    const questionFigure = await tx.quizFigure.create({
      data: {
        lessonId: context.lessonId!,
        quizQuestionId: id,
        role: "QUESTION",
        aiGenerationId: context.aiGenerationId,
        planJson: json({
          version: 1,
          role: "QUESTION",
          problem: question.explanation.problem,
          caption: question.figure.questionFigure.caption,
        }),
        subjectKey,
        subjectName,
        subjectSlug,
        status: "QUEUED",
        createdById: context.ownerUserId,
      },
      select: { id: true },
    });
    questionFigureId = questionFigure.id;
    const questionRevision = await tx.quizFigureRevision.create({
      data: {
        quizFigureId: questionFigure.id,
        origin: "INITIAL_AI",
        status: "QUEUED",
        sourceVersion: 1,
        altText: buildQuestionFigureAltText(question.explanation.problem),
        caption: question.figure.questionFigure.caption,
        createdById: context.ownerUserId,
      },
      select: { id: true },
    });
    await tx.quizFigure.update({
      where: { id: questionFigure.id },
      data: { pendingRevisionId: questionRevision.id },
    });

    if (question.figure.solutionFigureMode === "EXTEND_QUESTION") {
      const solutionFigure = await tx.quizFigure.create({
        data: {
          lessonId: context.lessonId!,
          quizQuestionId: id,
          role: "SOLUTION",
          aiGenerationId: context.aiGenerationId,
          planJson: json({
            version: 1,
            role: "SOLUTION",
            mode: "EXTEND_QUESTION",
            problem: question.explanation.problem,
            solution: getGeneratedQuizSolutionText(question),
            addedObjects: question.figure.solutionFigurePlan.addedObjects,
            clarifiedRelations: question.figure.solutionFigurePlan.clarifiedRelations,
            caption: question.figure.questionFigure.caption,
          }),
          subjectKey,
          subjectName,
          subjectSlug,
          status: "QUEUED",
          createdById: context.ownerUserId,
        },
        select: { id: true },
      });
      const solutionRevision = await tx.quizFigureRevision.create({
        data: {
          quizFigureId: solutionFigure.id,
          origin: "INITIAL_AI",
          status: "QUEUED",
          sourceVersion: 1,
          altText: `Hình lời giải mở rộng cho ${buildQuestionFigureAltText(question.explanation.problem)}`,
          caption: question.figure.questionFigure.caption,
          createdById: context.ownerUserId,
        },
        select: { id: true },
      });
      await tx.quizFigure.update({
        where: { id: solutionFigure.id },
        data: { pendingRevisionId: solutionRevision.id },
      });
    }
  }
  return {
    questionFigureId,
    recoveryIssues: mapped.recoveryIssues.map((issue) => ({
      ...issue,
      questionIndex,
      blocking: false,
    })),
  };
}

async function auditGeneratedQuiz(
  tx: Prisma.TransactionClient,
  context: AiGenerationExecutionContext,
  entityId: string,
) {
  await tx.auditLog.create({
    data: {
      actorUserId: context.ownerUserId,
      action: "QUIZ_SET_AI_GENERATED",
      entityType: "QuizSet",
      entityId,
      after: toJobJson({
        source: ContentSource.AI,
        reviewStatus: ReviewStatus.NEEDS_REVIEW,
      }),
      metadata: toJobJson({
        backgroundJobId: context.backgroundJobId,
        aiGenerationId: context.aiGenerationId,
      }),
    },
  });
}

function readRecoveryMetadata(value: unknown): {
  initialGeneratedCount: number;
  issues: GenerationRecoveryIssue[];
} {
  const record = asRecord(value);
  return {
    initialGeneratedCount:
      typeof record.initialGeneratedCount === "number" ? record.initialGeneratedCount : 0,
    issues: Array.isArray(record.issues)
      ? (record.issues as GenerationRecoveryIssue[])
      : [],
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function parseJobInput<T>(
  schema: {
    safeParse(
      value: unknown,
    ):
      | { success: true; data: T }
      | { success: false; error: { issues: Array<{ message: string }> } };
  },
  value: unknown,
  name: string,
): T {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>).filter(
            ([key]) => key !== "providerRouteSnapshot",
          ),
        )
      : value;
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new UnrecoverableError(
      `Invalid ${name} generation input: ${parsed.error.issues[0]?.message ?? "unknown error"}`,
    );
  }
  return parsed.data;
}

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function nullableJson(value: unknown | null) {
  return value === null ? Prisma.DbNull : json(value);
}

function readRequiredText(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new UnrecoverableError(`AI_INPUT_SNAPSHOT_INVALID: Thiếu trường ${field}.`);
  }
  return value;
}

function readQuizPacketManifest(value: unknown) {
  const record = asRecord(value);
  if (record.version !== 1 || !Array.isArray(record.pages)) {
    throw new UnrecoverableError(
      "AI_INPUT_MANIFEST_INVALID: Manifest packet PDF Quiz không hợp lệ.",
    );
  }
  return {
    pages: record.pages.map((rawPage) => {
      const page = asRecord(rawPage);
      const packetPageNumber = Number(page.packetPageNumber);
      const sourcePdfPageNumber = Number(page.sourcePdfPageNumber);
      if (!Number.isInteger(packetPageNumber) || !Number.isInteger(sourcePdfPageNumber)) {
        throw new UnrecoverableError(
          "AI_INPUT_MANIFEST_INVALID: Số trang trong manifest Quiz không hợp lệ.",
        );
      }
      return {
        packetPageNumber,
        sourcePdfPageNumber,
        sourceKey: readRequiredText(page.sourceKey, "sourceKey"),
        documentTitle: readRequiredText(page.documentTitle, "documentTitle"),
        printedPageLabel:
          typeof page.printedPageLabel === "string" ? page.printedPageLabel : null,
      };
    }),
  };
}

function buildQuestionFigureAltText(problem: string) {
  const compact = problem.replace(/\s+/gu, " ").trim();
  return `Hình minh họa cho đề bài: ${compact}`.slice(0, 1_000);
}
