import { Inject, Injectable } from "@nestjs/common";
import { EnrollmentStatus, LearningPathKind, PublishStatus } from "@prisma/client";
import { throwForbidden, throwNotFound } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type { StudentLessonAccessContext } from "#api/modules/learning-paths/types/lesson.types";

@Injectable()
export class StudentLessonAccessService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertCanRead(
    lessonId: string,
    studentUserId: string,
  ): Promise<StudentLessonAccessContext> {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        deletedAt: null,
        status: PublishStatus.PUBLISHED,
        OR: [{ chapterId: null }, { chapter: { deletedAt: null } }],
        learningPath: {
          deletedAt: null,
          status: {
            not: PublishStatus.ARCHIVED,
          },
        },
      },
      select: {
        id: true,
        learningPathId: true,
        trialEnabled: true,
        chapter: {
          select: {
            status: true,
          },
        },
        learningPath: {
          select: {
            kind: true,
            status: true,
          },
        },
      },
    });

    if (!lesson) {
      throwNotFound("NOT_FOUND", "Không tìm thấy buổi học");
    }

    const evaluatedAt = new Date();
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        studentUserId,
        status: EnrollmentStatus.ACTIVE,
        startsAt: { lte: evaluatedAt },
        expiresAt: { gt: evaluatedAt },
        OR: [
          { learningPathId: lesson.learningPathId },
          { deliveryLearningPathId: lesson.learningPathId },
        ],
      },
      select: {
        deliveryLearningPathId: true,
        id: true,
        learningPathId: true,
      },
    });

    if (enrollment) {
      if (
        lesson.learningPath.kind === LearningPathKind.PERSONALIZED &&
        enrollment.deliveryLearningPathId !== lesson.learningPathId
      ) {
        throwForbidden(
          "PERSONAL_LEARNING_PATH_ACCESS_DENIED",
          "Bạn không có quyền truy cập lộ trình cá nhân này",
        );
      }

      return {
        evaluatedAt,
        lessonId: lesson.id,
        learningPathId: lesson.learningPathId,
        mode: "ENROLLMENT",
      };
    }

    if (lesson.learningPath.kind === LearningPathKind.PERSONALIZED) {
      throwForbidden(
        "PERSONAL_LEARNING_PATH_ACCESS_DENIED",
        "Bạn không có quyền truy cập lộ trình cá nhân này",
      );
    }

    if (
      lesson.trialEnabled &&
      lesson.learningPath.status === PublishStatus.PUBLISHED &&
      (lesson.chapter?.status ?? PublishStatus.PUBLISHED) === PublishStatus.PUBLISHED
    ) {
      return {
        evaluatedAt,
        lessonId: lesson.id,
        learningPathId: lesson.learningPathId,
        mode: "TRIAL",
      };
    }

    throwForbidden("ENROLLMENT_REQUIRED", "Bạn cần quyền học buổi này để xem nội dung");
  }
}
