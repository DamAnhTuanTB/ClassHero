import { Inject, Injectable } from "@nestjs/common";
import {
  EnrollmentStatus,
  LearningPathKind,
  Prisma,
  PublishStatus,
  UserRole,
} from "@prisma/client";
import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { PublicLearningPathQueryDto } from "#api/modules/learning-paths/dto/public-learning-path-query.dto";
import { FilesService } from "#api/modules/files/services/files.service";
import {
  publicLearningPathDetailSelect,
  publicLearningPathSelect,
} from "#api/modules/learning-paths/selectors/learning-path.selects";
import { serializePublicLearningPath } from "#api/modules/learning-paths/serializers/learning-path.serializers";
import type {
  PublicLearningPathDetailRecord,
  PublicLearningPathRecord,
  PublicViewerContext,
} from "#api/modules/learning-paths/types/learning-path.types";
import {
  getIdOrSlugWhere,
  getPublicLearningPathOrderBy,
  throwNotFound,
} from "#api/modules/learning-paths/utils/learning-path.helpers";

@Injectable()
export class PublicLearningPathsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FilesService) private readonly filesService: FilesService,
  ) {}

  async listPublished(query: PublicLearningPathQueryDto, user?: AuthenticatedUser) {
    const page = query.page;
    const pageSize = query.pageSize;
    const viewer = await this.createViewerContext(user);
    const enrolledLearningPathIds =
      await this.findActiveEnrollmentLearningPathIds(viewer);
    const where: Prisma.LearningPathWhereInput = {
      kind: LearningPathKind.CATALOG,
      deletedAt: null,
      ...(query.subject ? { subject: query.subject } : {}),
      ...(query.grade ? { grade: query.grade } : {}),
      ...(enrolledLearningPathIds.length > 0
        ? {
            OR: [
              { status: PublishStatus.PUBLISHED },
              {
                id: {
                  in: enrolledLearningPathIds,
                },
                status: {
                  not: PublishStatus.ARCHIVED,
                },
              },
            ],
          }
        : { status: PublishStatus.PUBLISHED }),
    };

    const [items, total, gradeGroups] = await Promise.all([
      this.findVisiblePage(where, query.grade, viewer.studentGrade, page, pageSize),
      this.prisma.learningPath.count({ where }),
      this.prisma.learningPath.groupBy({
        by: ["grade"],
        where,
        _count: {
          _all: true,
        },
        orderBy: {
          grade: "asc",
        },
      }),
    ]);

    await this.attachStudentLearningState(viewer, items);

    const data = await Promise.all(
      items.map(async (item) =>
        serializePublicLearningPath(
          item,
          viewer,
          await this.filesService.resolveAccessUrl(item.thumbnailFile),
        ),
      ),
    );

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        priorityGrade: query.grade ?? viewer.studentGrade ?? null,
        gradeGroups: gradeGroups.map((group) => ({
          grade: group.grade,
          count: group._count._all,
        })),
      },
    };
  }

  async getPublished(idOrSlug: string, user?: AuthenticatedUser) {
    const viewer = await this.createViewerContext(user);
    const learningPath = await this.prisma.learningPath.findFirst({
      where: {
        ...getIdOrSlugWhere(idOrSlug),
        kind: LearningPathKind.CATALOG,
        deletedAt: null,
        status: {
          not: PublishStatus.ARCHIVED,
        },
      },
      select: publicLearningPathDetailSelect,
    });

    if (!learningPath) {
      throwNotFound();
    }

    await this.attachStudentLearningState(viewer, [learningPath]);

    const activeEnrollment = viewer.activeEnrollmentByLearningPathId.get(
      learningPath.id,
    );
    const hasActiveEnrollment = Boolean(activeEnrollment);
    if (learningPath.status !== PublishStatus.PUBLISHED && !hasActiveEnrollment) {
      throwNotFound();
    }

    let finalLearningPath = learningPath;

    if (activeEnrollment?.deliveryLearningPathId) {
      const deliveryPath = await this.prisma.learningPath.findUnique({
        where: { id: activeEnrollment.deliveryLearningPathId },
        select: publicLearningPathDetailSelect,
      });

      if (deliveryPath) {
        finalLearningPath = {
          ...learningPath,
          chapters: deliveryPath.chapters,
          lessons: deliveryPath.lessons,
          totalChapterCount: deliveryPath.totalChapterCount,
          totalLessonCount: deliveryPath.totalLessonCount,
        } as any;

        await this.attachLessonProgress(
          viewer,
          deliveryPath.lessons.map((lesson) => lesson.id),
        );
      }
    }

    return serializePublicLearningPath(
      finalLearningPath,
      viewer,
      await this.filesService.resolveAccessUrl(finalLearningPath.thumbnailFile),
    );
  }

  private async findVisiblePage(
    where: Prisma.LearningPathWhereInput,
    explicitGrade: number | undefined,
    priorityGrade: number | undefined,
    page: number,
    pageSize: number,
  ) {
    const orderBy = getPublicLearningPathOrderBy();
    const skip = (page - 1) * pageSize;

    if (explicitGrade || !priorityGrade) {
      return this.prisma.learningPath.findMany({
        where,
        select: publicLearningPathSelect,
        orderBy,
        skip,
        take: pageSize,
      });
    }

    const priorityWhere: Prisma.LearningPathWhereInput = {
      ...where,
      grade: priorityGrade,
    };
    const otherWhere: Prisma.LearningPathWhereInput = {
      ...where,
      NOT: {
        grade: priorityGrade,
      },
    };
    const priorityTotal = await this.prisma.learningPath.count({
      where: priorityWhere,
    });

    if (skip >= priorityTotal) {
      return this.prisma.learningPath.findMany({
        where: otherWhere,
        select: publicLearningPathSelect,
        orderBy,
        skip: skip - priorityTotal,
        take: pageSize,
      });
    }

    const priorityItems = await this.prisma.learningPath.findMany({
      where: priorityWhere,
      select: publicLearningPathSelect,
      orderBy,
      skip,
      take: pageSize,
    });
    const remaining = pageSize - priorityItems.length;

    if (remaining <= 0) {
      return priorityItems;
    }

    const otherItems = await this.prisma.learningPath.findMany({
      where: otherWhere,
      select: publicLearningPathSelect,
      orderBy,
      take: remaining,
    });

    return [...priorityItems, ...otherItems];
  }

  private async findActiveEnrollmentLearningPathIds(viewer: PublicViewerContext) {
    if (!viewer.user || viewer.user.role !== UserRole.STUDENT) {
      return [];
    }

    const now = new Date();
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentUserId: viewer.user.id,
        status: EnrollmentStatus.ACTIVE,
        startsAt: {
          lte: now,
        },
        expiresAt: {
          gt: now,
        },
        learningPath: {
          deletedAt: null,
          status: {
            not: PublishStatus.ARCHIVED,
          },
        },
      },
      select: {
        learningPathId: true,
      },
    });

    return enrollments.map((enrollment) => enrollment.learningPathId);
  }

  private async createViewerContext(
    user: AuthenticatedUser | undefined,
  ): Promise<PublicViewerContext> {
    if (!user || user.role !== UserRole.STUDENT) {
      return {
        user,
        activeEnrollmentByLearningPathId: new Map(),
        lessonProgressByLessonId: new Map(),
      };
    }

    const studentProfile = await this.prisma.studentProfile.findUnique({
      where: {
        userId: user.id,
      },
      select: {
        grade: true,
      },
    });

    return {
      user,
      studentGrade: studentProfile?.grade,
      activeEnrollmentByLearningPathId: new Map(),
      lessonProgressByLessonId: new Map(),
    };
  }

  private async attachStudentLearningState(
    viewer: PublicViewerContext,
    learningPaths: Array<PublicLearningPathRecord | PublicLearningPathDetailRecord>,
  ) {
    await this.attachActiveEnrollments(
      viewer,
      learningPaths.map((learningPath) => learningPath.id),
    );

    await this.attachLessonProgress(
      viewer,
      learningPaths.flatMap((learningPath) =>
        learningPath.lessons.map((lesson) => lesson.id),
      ),
    );
  }

  private async attachActiveEnrollments(
    viewer: PublicViewerContext,
    learningPathIds: string[],
  ) {
    if (
      !viewer.user ||
      viewer.user.role !== UserRole.STUDENT ||
      learningPathIds.length === 0
    ) {
      return;
    }

    const now = new Date();
    const enrollments = await this.prisma.enrollment.findMany({
      where: {
        studentUserId: viewer.user.id,
        learningPathId: {
          in: learningPathIds,
        },
        status: EnrollmentStatus.ACTIVE,
        startsAt: {
          lte: now,
        },
        expiresAt: {
          gt: now,
        },
      },
      select: {
        id: true,
        learningPathId: true,
        status: true,
        startsAt: true,
        expiresAt: true,
        deliveryLearningPathId: true,
      },
    });

    for (const enrollment of enrollments) {
      viewer.activeEnrollmentByLearningPathId.set(enrollment.learningPathId, {
        id: enrollment.id,
        status: enrollment.status,
        startsAt: enrollment.startsAt,
        expiresAt: enrollment.expiresAt,
        deliveryLearningPathId: enrollment.deliveryLearningPathId,
      });
    }
  }

  private async attachLessonProgress(viewer: PublicViewerContext, lessonIds: string[]) {
    if (!viewer.user || viewer.user.role !== UserRole.STUDENT || lessonIds.length === 0) {
      return;
    }

    const progressRows = await this.prisma.lessonProgress.findMany({
      where: {
        studentUserId: viewer.user.id,
        lessonId: {
          in: lessonIds,
        },
      },
      select: {
        lessonId: true,
        status: true,
        completedAt: true,
      },
    });

    for (const progress of progressRows) {
      viewer.lessonProgressByLessonId.set(progress.lessonId, progress);
    }
  }
}
