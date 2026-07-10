import { Inject, Injectable } from "@nestjs/common";
import { EnrollmentStatus, Prisma, PublishStatus, UserRole } from "@prisma/client";
import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { PublicLearningPathQueryDto } from "#api/modules/learning-paths/dto/public-learning-path-query.dto";
import { publicLearningPathSelect } from "#api/modules/learning-paths/selectors/learning-path.selects";
import { serializePublicLearningPath } from "#api/modules/learning-paths/serializers/learning-path.serializers";
import type { PublicViewerContext } from "#api/modules/learning-paths/types/learning-path.types";
import {
  getIdOrSlugWhere,
  getPublicLearningPathOrderBy,
  throwNotFound,
} from "#api/modules/learning-paths/utils/learning-path.helpers";

@Injectable()
export class PublicLearningPathsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listPublished(query: PublicLearningPathQueryDto, user?: AuthenticatedUser) {
    const page = query.page;
    const pageSize = query.pageSize;
    const viewer = await this.createViewerContext(user);
    const where: Prisma.LearningPathWhereInput = {
      deletedAt: null,
      status: PublishStatus.PUBLISHED,
      ...(query.subject ? { subject: query.subject } : {}),
      ...(query.grade ? { grade: query.grade } : {}),
    };

    const [items, total, gradeGroups] = await Promise.all([
      this.findPublishedPage(where, query.grade, viewer.studentGrade, page, pageSize),
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

    await this.attachActiveEnrollments(
      viewer,
      items.map((item) => item.id),
    );

    return {
      data: items.map((item) => serializePublicLearningPath(item, viewer)),
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
        deletedAt: null,
        status: PublishStatus.PUBLISHED,
      },
      select: publicLearningPathSelect,
    });

    if (!learningPath) {
      throwNotFound();
    }

    await this.attachActiveEnrollments(viewer, [learningPath.id]);

    return serializePublicLearningPath(learningPath, viewer);
  }

  private async findPublishedPage(
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

  private async createViewerContext(
    user: AuthenticatedUser | undefined,
  ): Promise<PublicViewerContext> {
    if (!user || user.role !== UserRole.STUDENT) {
      return {
        user,
        activeEnrollmentByLearningPathId: new Map(),
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
    };
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
      },
    });

    for (const enrollment of enrollments) {
      viewer.activeEnrollmentByLearningPathId.set(enrollment.learningPathId, {
        id: enrollment.id,
        status: enrollment.status,
        startsAt: enrollment.startsAt,
        expiresAt: enrollment.expiresAt,
      });
    }
  }
}
