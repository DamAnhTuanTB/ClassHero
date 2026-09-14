import { Inject, Injectable } from "@nestjs/common";
import { AiChatScopeType, AiChatSessionMode, ReviewStatus } from "@prisma/client";
import {
  throwBadRequest,
  throwForbidden,
  throwNotFound,
} from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type { AdminAiChatScopeOptionsQueryDto } from "#api/modules/ai-chat/dto/admin-ai-chat.dto";
import type { AiChatScopeAccess } from "#api/modules/ai-chat/types/ai-chat.types";
import { resolveAiChatSubject } from "#api/modules/ai-chat/utils/ai-chat-subject";
import {
  studentVisibleFlashcardSetWhere,
  studentVisibleFlashcardWhere,
  studentVisibleQuizQuestionWhere,
  studentVisibleQuizSetWhere,
  studentVisibleTestQuestionWhere,
  studentVisibleTestSetWhere,
} from "#api/modules/student-learning/selectors/student-visible-learning-content.where";

export type AdminAiChatScopeItemInput = {
  learningPathId: string;
  lessonId: string | null;
  sortOrder: number;
};

@Injectable()
export class AdminAiChatAccessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listScopeOptions(query: AdminAiChatScopeOptionsQueryDto) {
    const search = query.search?.trim();
    const [learningPaths, lessons] = await Promise.all([
      this.prisma.learningPath.findMany({
        where: {
          deletedAt: null,
          ...(search
            ? { title: { contains: search, mode: "insensitive" as const } }
            : {}),
        },
        select: {
          id: true,
          title: true,
          status: true,
          domain: { select: { name: true } },
          _count: { select: { lessons: { where: { deletedAt: null } } } },
        },
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }, { id: "asc" }],
        take: 200,
      }),
      query.learningPathId
        ? this.prisma.lesson.findMany({
            where: { learningPathId: query.learningPathId, deletedAt: null },
            select: {
              id: true,
              learningPathId: true,
              title: true,
              status: true,
              orderIndex: true,
              chapter: { select: { title: true, orderIndex: true } },
            },
            orderBy: [
              { chapter: { orderIndex: "asc" } },
              { orderIndex: "asc" },
              { id: "asc" },
            ],
          })
        : Promise.resolve([]),
    ]);
    return { learningPaths, lessons };
  }

  async listLessonSimulationContext(lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null },
      select: {
        id: true,
        summary: {
          select: { id: true, reviewStatus: true, deletedAt: true },
        },
        videoSummary: {
          select: {
            id: true,
            reviewStatus: true,
            staleAt: true,
            deletedAt: true,
          },
        },
        quizSets: {
          where: studentVisibleQuizSetWhere,
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            title: true,
            questions: {
              where: studentVisibleQuizQuestionWhere,
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                questionType: true,
                questionJson: true,
                difficulty: true,
                sortOrder: true,
              },
            },
          },
        },
        flashcardSets: {
          where: studentVisibleFlashcardSetWhere,
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            title: true,
            flashcards: {
              where: studentVisibleFlashcardWhere,
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                frontJson: true,
                difficulty: true,
                sortOrder: true,
              },
            },
          },
        },
        testSets: {
          where: studentVisibleTestSetWhere,
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
          select: {
            id: true,
            title: true,
            durationSeconds: true,
            questions: {
              where: studentVisibleTestQuestionWhere,
              orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                questionType: true,
                questionJson: true,
                difficulty: true,
                sortOrder: true,
              },
            },
          },
        },
      },
    });
    if (!lesson) {
      throwNotFound(
        "ADMIN_AI_CHAT_LESSON_NOT_FOUND",
        "Buổi học được chọn không còn tồn tại.",
      );
    }

    return {
      lessonId: lesson.id,
      surfaces: {
        videoSummary: {
          available: Boolean(
            lesson.videoSummary &&
            !lesson.videoSummary.deletedAt &&
            !lesson.videoSummary.staleAt &&
            lesson.videoSummary.reviewStatus === ReviewStatus.APPROVED,
          ),
        },
        knowledge: {
          available: Boolean(
            lesson.summary &&
            !lesson.summary.deletedAt &&
            lesson.summary.reviewStatus === ReviewStatus.APPROVED,
          ),
        },
      },
      quizSets: lesson.quizSets,
      flashcardSets: lesson.flashcardSets,
      testSets: lesson.testSets,
    };
  }

  async resolveNewScope(input: {
    scopeType: AiChatScopeType;
    learningPathIds: string[];
    lessonId?: string;
  }): Promise<{
    access: AiChatScopeAccess;
    items: AdminAiChatScopeItemInput[];
  }> {
    const learningPathIds = [...new Set(input.learningPathIds)];
    if (learningPathIds.length !== input.learningPathIds.length) {
      throwBadRequest(
        "ADMIN_AI_CHAT_SCOPE_DUPLICATE",
        "Danh sách khóa học không được chứa mục trùng nhau.",
      );
    }
    if (input.scopeType === AiChatScopeType.LESSON) {
      if (!input.lessonId) {
        throwBadRequest(
          "ADMIN_AI_CHAT_LESSON_REQUIRED",
          "Vui lòng chọn một buổi học để bắt đầu phiên mô phỏng.",
        );
      }
      const lesson = await this.prisma.lesson.findFirst({
        where: {
          id: input.lessonId,
          deletedAt: null,
          learningPath: { deletedAt: null },
        },
        select: {
          id: true,
          title: true,
          learningPathId: true,
          learningPath: {
            select: {
              title: true,
              domain: { select: { name: true, slug: true } },
            },
          },
        },
      });
      if (!lesson) {
        throwNotFound(
          "ADMIN_AI_CHAT_LESSON_NOT_FOUND",
          "Buổi học được chọn không còn tồn tại.",
        );
      }
      if (
        learningPathIds.length > 0 &&
        (learningPathIds.length !== 1 || learningPathIds[0] !== lesson.learningPathId)
      ) {
        throwBadRequest(
          "ADMIN_AI_CHAT_LESSON_SCOPE_INVALID",
          "Buổi học không thuộc khóa học được chọn.",
        );
      }
      return {
        access: {
          scopeType: input.scopeType,
          learningPathId: lesson.learningPathId,
          learningPathIds: [lesson.learningPathId],
          lessonIds: [lesson.id],
          label: `${lesson.learningPath.title} / ${lesson.title}`,
          subjects: [
            {
              learningPathId: lesson.learningPathId,
              key: resolveAiChatSubject(toAiChatSubjectInput(lesson.learningPath.domain)),
            },
          ],
        },
        items: [
          { learningPathId: lesson.learningPathId, lessonId: lesson.id, sortOrder: 0 },
        ],
      };
    }

    if (
      input.scopeType !== AiChatScopeType.COURSE &&
      input.scopeType !== AiChatScopeType.COURSE_SET
    ) {
      throwBadRequest(
        "ADMIN_AI_CHAT_SCOPE_INVALID",
        "Admin chỉ có thể mô phỏng theo buổi học, khóa học hoặc danh sách khóa học.",
      );
    }
    const expectedCount = input.scopeType === AiChatScopeType.COURSE ? 1 : null;
    if (
      learningPathIds.length === 0 ||
      (expectedCount !== null && learningPathIds.length !== expectedCount)
    ) {
      throwBadRequest(
        "ADMIN_AI_CHAT_COURSE_SCOPE_INVALID",
        input.scopeType === AiChatScopeType.COURSE
          ? "Vui lòng chọn đúng một khóa học."
          : "Vui lòng chọn ít nhất một khóa học.",
      );
    }
    const paths = await this.prisma.learningPath.findMany({
      where: { id: { in: learningPathIds }, deletedAt: null },
      select: {
        id: true,
        title: true,
        domain: { select: { name: true, slug: true } },
      },
    });
    if (paths.length !== learningPathIds.length) {
      throwNotFound(
        "ADMIN_AI_CHAT_COURSE_NOT_FOUND",
        "Có khóa học được chọn không còn tồn tại.",
      );
    }
    const byId = new Map(paths.map((path) => [path.id, path]));
    const ordered = learningPathIds.map((id) => byId.get(id)!);
    return {
      access: {
        scopeType: input.scopeType,
        learningPathId:
          input.scopeType === AiChatScopeType.COURSE ? learningPathIds[0]! : null,
        learningPathIds,
        label:
          input.scopeType === AiChatScopeType.COURSE
            ? ordered[0]!.title
            : `${ordered.length} khóa học: ${ordered.map((path) => path.title).join(", ")}`,
        subjects: ordered.map((path) => ({
          learningPathId: path.id,
          key: resolveAiChatSubject(toAiChatSubjectInput(path.domain)),
        })),
      },
      items: ordered.map((path, sortOrder) => ({
        learningPathId: path.id,
        lessonId: null,
        sortOrder,
      })),
    };
  }

  async resolveConversation(adminUserId: string, conversationId: string) {
    const session = await this.prisma.aiChatSession.findFirst({
      where: {
        id: conversationId,
        mode: AiChatSessionMode.ADMIN_SIMULATION,
        adminUserId,
        deletedAt: null,
      },
      include: {
        learningPath: { select: { title: true, deletedAt: true } },
        scopeItems: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          include: {
            learningPath: {
              select: {
                title: true,
                deletedAt: true,
                domain: { select: { name: true, slug: true } },
              },
            },
            lesson: { select: { title: true, deletedAt: true } },
          },
        },
      },
    });
    if (!session) {
      throwNotFound(
        "ADMIN_AI_CHAT_SESSION_NOT_FOUND",
        "Không tìm thấy phiên Chat AI mô phỏng.",
      );
    }
    const learningPathIds = [
      ...new Set(session.scopeItems.map((item) => item.learningPathId)),
    ];
    const lessonIds = session.scopeItems.flatMap((item) =>
      item.lessonId ? [item.lessonId] : [],
    );
    if (learningPathIds.length === 0) {
      throwForbidden(
        "ADMIN_AI_CHAT_SCOPE_EMPTY",
        "Phiên mô phỏng không còn phạm vi khóa học hợp lệ.",
      );
    }
    if (
      session.scopeItems.some(
        (item) => item.learningPath.deletedAt || item.lesson?.deletedAt,
      )
    ) {
      throwForbidden(
        "ADMIN_AI_CHAT_SCOPE_UNAVAILABLE",
        "Phạm vi của phiên mô phỏng có khóa học hoặc buổi học không còn khả dụng.",
      );
    }
    return {
      session,
      access: {
        scopeType: session.scopeType,
        learningPathId: session.learningPathId,
        learningPathIds,
        lessonIds,
        label: buildScopeLabel(session.scopeType, session.scopeItems),
        subjects: session.scopeItems.map((item) => ({
          learningPathId: item.learningPathId,
          key: resolveAiChatSubject(toAiChatSubjectInput(item.learningPath.domain)),
        })),
      } satisfies AiChatScopeAccess,
    };
  }
}

function toAiChatSubjectInput(domain: { name: string; slug: string }) {
  return { domainName: domain.name, domainSlug: domain.slug };
}

function buildScopeLabel(
  scopeType: AiChatScopeType,
  items: Array<{
    learningPath: { title: string; deletedAt: Date | null };
    lesson: { title: string; deletedAt: Date | null } | null;
  }>,
) {
  if (scopeType === AiChatScopeType.LESSON) {
    const item = items[0];
    return item
      ? `${item.learningPath.title} / ${item.lesson?.title ?? "Buổi học"}`
      : "Buổi học";
  }
  if (scopeType === AiChatScopeType.COURSE) {
    return items[0]?.learningPath.title ?? "Khóa học";
  }
  return `${items.length} khóa học: ${items
    .map((item) => item.learningPath.title)
    .join(", ")}`;
}
