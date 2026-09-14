import { Inject, Injectable } from "@nestjs/common";
import { AiChatResponsePolicy, AttemptStatus } from "@prisma/client";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type { AiChatActiveActivityContext } from "#api/modules/ai-chat/types/ai-chat.types";
import {
  resolveAiChatActivityPolicy,
  type AiChatActivityPolicyDecision,
} from "#api/modules/ai-chat/utils/ai-chat-activity-policy";

type AiChatPolicyDecision = AiChatActivityPolicyDecision;

@Injectable()
export class AiChatPolicyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async resolve(
    studentUserId: string,
    context: AiChatActiveActivityContext = {},
  ): Promise<AiChatResponsePolicy> {
    return (await this.resolveDecision(studentUserId, context)).policy;
  }

  async resolveDecision(
    studentUserId: string,
    context: AiChatActiveActivityContext = {},
  ): Promise<AiChatPolicyDecision> {
    if (
      !context.activityType ||
      !context.activityId ||
      !context.targetType ||
      !context.targetId
    ) {
      return fullScopeDecision();
    }

    if (
      context.activityType === "QUIZ_ATTEMPT" &&
      context.targetType === "QUIZ_QUESTION"
    ) {
      const attempt = await this.prisma.quizAttempt.findFirst({
        where: {
          id: context.activityId,
          studentUserId,
          status: AttemptStatus.IN_PROGRESS,
          quizSet: {
            questions: {
              some: { id: context.targetId, deletedAt: null },
            },
          },
        },
        select: {
          answers: {
            where: { questionId: context.targetId },
            take: 1,
            select: { isChecked: true },
          },
        },
      });
      if (!attempt) return fullScopeDecision();
      return (
        resolveAiChatActivityPolicy({
          kind: "QUIZ",
          state: attempt.answers[0]?.isChecked ? "ANSWER_REVEALED" : "UNANSWERED",
        }) ?? fullScopeDecision()
      );
    }

    if (
      context.activityType === "FLASHCARD_STUDY_SESSION" &&
      context.targetType === "FLASHCARD"
    ) {
      const session = await this.prisma.flashcardStudySession.findFirst({
        where: {
          id: context.activityId,
          studentUserId,
          status: AttemptStatus.IN_PROGRESS,
          items: { some: { flashcardId: context.targetId } },
        },
        select: {
          items: {
            where: { flashcardId: context.targetId },
            take: 1,
            select: { isKnown: true },
          },
        },
      });
      if (!session) return fullScopeDecision();
      const currentItem = session.items[0];
      return (
        resolveAiChatActivityPolicy({
          kind: "FLASHCARD",
          state:
            currentItem?.isKnown !== null && currentItem?.isKnown !== undefined
              ? "ANSWER_REVEALED"
              : "UNANSWERED",
        }) ?? fullScopeDecision()
      );
    }

    return fullScopeDecision();
  }
}

function fullScopeDecision(): AiChatPolicyDecision {
  return {
    policy: AiChatResponsePolicy.FULL_ANSWER,
    answerAccess: "FULL_SCOPE",
  };
}
