import { Inject, Injectable } from "@nestjs/common";
import { AiChatScopeType, EnrollmentStatus } from "@prisma/client";
import { throwForbidden, throwNotFound } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type { AiChatScopeAccess } from "#api/modules/ai-chat/types/ai-chat.types";
import { resolveAiChatSubject } from "#api/modules/ai-chat/utils/ai-chat-subject";
import { hasActiveStudentTestAttempt } from "#api/modules/tests/utils/test-attempt-activity";
import { resolveAiChatActivityPolicy } from "#api/modules/ai-chat/utils/ai-chat-activity-policy";

@Injectable()
export class AiChatAccessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertChatAvailable(studentUserId: string) {
    const hasActiveTest = await hasActiveStudentTestAttempt(this.prisma, studentUserId);
    const decision = hasActiveTest
      ? resolveAiChatActivityPolicy({ kind: "TEST", state: "IN_PROGRESS" })
      : null;
    if (decision?.policy === "BLOCKED") {
      throwForbidden(
        "AI_CHAT_BLOCKED_DURING_TEST",
        "Chat AI tạm khóa trong khi bạn đang làm bài thi.",
      );
    }
  }

  async resolveScope(
    studentUserId: string,
    scopeType: AiChatScopeType,
    requestedLearningPathId?: string,
  ): Promise<AiChatScopeAccess> {
    await this.assertChatAvailable(studentUserId);
    const now = new Date();
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentUserId,
        status: EnrollmentStatus.ACTIVE,
        startsAt: { lte: now },
        expiresAt: { gt: now },
        OR: [
          {
            deliveryLearningPathId: { not: null },
            deliveryLearningPath: { is: { deletedAt: null } },
          },
          {
            deliveryLearningPathId: null,
            learningPath: { deletedAt: null },
          },
        ],
      },
      select: {
        learningPathId: true,
        deliveryLearningPathId: true,
        learningPath: {
          select: {
            title: true,
            domain: { select: { name: true, slug: true } },
          },
        },
        deliveryLearningPath: {
          select: {
            title: true,
            domain: { select: { name: true, slug: true } },
          },
        },
      },
    });
    const accessible = enrollments.map((enrollment) => ({
      id: enrollment.deliveryLearningPathId ?? enrollment.learningPathId,
      title: enrollment.deliveryLearningPath?.title ?? enrollment.learningPath.title,
      subjectKey: resolveAiChatSubject(
        toAiChatSubjectInput(
          enrollment.deliveryLearningPath?.domain ?? enrollment.learningPath.domain,
        ),
      ),
    }));
    const uniqueIds = [...new Set(accessible.map((path) => path.id))];

    if (uniqueIds.length === 0) {
      throwForbidden(
        "AI_CHAT_PURCHASE_REQUIRED",
        "Chat AI chỉ sử dụng nội dung từ các khóa học bạn đã mua.",
      );
    }

    if (scopeType === AiChatScopeType.LIBRARY) {
      return {
        scopeType,
        learningPathId: null,
        learningPathIds: uniqueIds,
        label: "Các khóa học đã mua",
        subjects: accessible.map((path) => ({
          learningPathId: path.id,
          key: path.subjectKey,
        })),
      };
    }

    const courseEnrollment = enrollments.find(
      (enrollment) =>
        enrollment.learningPathId === requestedLearningPathId ||
        enrollment.deliveryLearningPathId === requestedLearningPathId,
    );
    if (!courseEnrollment) {
      throwForbidden(
        "AI_CHAT_COURSE_ACCESS_DENIED",
        "Khóa học này không thuộc các khóa học bạn đã mua.",
      );
    }
    const effectiveLearningPathId =
      courseEnrollment.deliveryLearningPathId ?? courseEnrollment.learningPathId;
    return {
      scopeType,
      learningPathId: effectiveLearningPathId,
      learningPathIds: [effectiveLearningPathId],
      label:
        courseEnrollment.deliveryLearningPath?.title ??
        courseEnrollment.learningPath.title,
      subjects: [
        {
          learningPathId: effectiveLearningPathId,
          key: resolveAiChatSubject(
            toAiChatSubjectInput(
              courseEnrollment.deliveryLearningPath?.domain ??
                courseEnrollment.learningPath.domain,
            ),
          ),
        },
      ],
    };
  }

  async resolveConversation(studentUserId: string, conversationId: string) {
    const session = await this.prisma.aiChatSession.findFirst({
      where: { id: conversationId, studentUserId, deletedAt: null },
      select: {
        id: true,
        mode: true,
        scopeType: true,
        learningPathId: true,
        configurationOverrideJson: true,
        configurationVersion: true,
        title: true,
        summaryText: true,
        lastMessageAt: true,
        createdAt: true,
        updatedAt: true,
        learningPath: { select: { title: true } },
      },
    });
    if (!session) {
      throwNotFound("AI_CHAT_CONVERSATION_NOT_FOUND", "Không tìm thấy cuộc trò chuyện.");
    }
    const access = await this.resolveScope(
      studentUserId,
      session.scopeType,
      session.learningPathId ?? undefined,
    );
    return { session, access };
  }

  assertSurfaceLessonAllowed(
    surfaceLesson: { id: string; learningPathId: string } | null,
    access: AiChatScopeAccess,
  ) {
    if (
      !surfaceLesson ||
      !access.learningPathIds.includes(surfaceLesson.learningPathId)
    ) {
      throwForbidden(
        "AI_CHAT_LESSON_ACCESS_DENIED",
        "Buổi học hiện tại không thuộc phạm vi Chat AI được phép.",
      );
    }
  }
}

function toAiChatSubjectInput(domain: { name: string; slug: string }) {
  return { domainName: domain.name, domainSlug: domain.slug };
}
