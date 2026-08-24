import { Inject, Injectable } from "@nestjs/common";
import { QuizFigureRole } from "@prisma/client";

import { badRequestException, notFoundException } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { QuizFigureArtifactService } from "#api/modules/quiz-figures/services/quiz-figure-artifact.service";

@Injectable()
export class QuizFiguresService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QuizFigureArtifactService)
    private readonly artifacts: QuizFigureArtifactService,
  ) {}

  async attachAdminUpload(input: {
    questionId: string;
    role: QuizFigureRole;
    fileId: string;
    altText: string;
    caption?: string | null;
    actorUserId: string;
  }) {
    const question = await this.prisma.quizQuestion.findFirst({
      where: { id: input.questionId, deletedAt: null },
      select: { id: true, lessonId: true },
    });
    if (!question) {
      throw notFoundException("QUIZ_QUESTION_NOT_FOUND", "Không tìm thấy câu Quiz.");
    }
    const questionFigureRevision =
      input.role === QuizFigureRole.SOLUTION
        ? await this.prisma.quizFigure.findFirst({
            where: {
              quizQuestionId: question.id,
              role: QuizFigureRole.QUESTION,
              deletedAt: null,
            },
            select: { currentRevisionId: true },
          })
        : null;
    if (
      input.role === QuizFigureRole.SOLUTION &&
      !questionFigureRevision?.currentRevisionId
    ) {
      throw badRequestException(
        "QUIZ_SOLUTION_FIGURE_BASE_REQUIRED",
        "Hãy tải hình đề trước; hình lời giải phải được xây dựng trên hình đề.",
      );
    }
    const figure = await this.prisma.quizFigure.upsert({
      where: {
        quizQuestionId_role: {
          quizQuestionId: question.id,
          role: input.role,
        },
      },
      create: {
        lessonId: question.lessonId,
        quizQuestionId: question.id,
        role: input.role,
        subjectKey: "GENERAL",
        subjectName: "Tổng quát",
        subjectSlug: "general",
        status: "QUEUED",
        createdById: input.actorUserId,
      },
      update: { deletedAt: null },
      select: { id: true },
    });
    const revision = await this.artifacts.attachAdminUpload({
      figureId: figure.id,
      fileId: input.fileId,
      actorUserId: input.actorUserId,
      altText: input.altText,
      caption: input.caption,
    });
    if (input.role === QuizFigureRole.SOLUTION) {
      await this.prisma.$transaction([
        this.prisma.quizFigureRevision.update({
          where: { id: revision.id },
          data: {
            derivedFromQuestionRevisionId:
              questionFigureRevision!.currentRevisionId,
          },
        }),
        this.prisma.quizQuestion.update({
          where: { id: question.id },
          data: { solutionFigureMode: "EXTEND_QUESTION" },
        }),
      ]);
    }
    return this.prisma.quizFigure.findUniqueOrThrow({
      where: { id: figure.id },
      select: quizFigureSelect,
    });
  }
}

export const quizFigureSelect = {
  id: true,
  role: true,
  status: true,
  lastErrorCode: true,
  lastErrorMessage: true,
  currentRevision: {
    select: {
      id: true,
      sourceKind: true,
      altText: true,
      caption: true,
      deliveryFile: {
        select: { id: true, mimeType: true, publicUrl: true },
      },
    },
  },
} as const;
