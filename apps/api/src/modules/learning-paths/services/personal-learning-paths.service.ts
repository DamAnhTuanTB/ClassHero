import { Inject, Injectable } from "@nestjs/common";
import {
  BackgroundJobQueue,
  BackgroundJobStatus,
  EnrollmentStatus,
  LearningPathKind,
  Prisma,
} from "@prisma/client";
import {
  throwConflict,
  throwNotFound,
} from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { CreatePersonalLearningPathDto } from "#api/modules/learning-paths/dto/create-personal-learning-path.dto";
import {
  PersonalizationStatus,
  PersonalLearningPathEnrollmentsQueryDto,
} from "#api/modules/learning-paths/dto/personal-learning-path-enrollments-query.dto";
import {
  personalLearningPathEnrollmentSelect,
  personalLearningPathJobSelect,
} from "#api/modules/learning-paths/selectors/personal-learning-path.selects";
import {
  serializePersonalLearningPathEnrollment,
  serializePersonalLearningPathJob,
} from "#api/modules/learning-paths/serializers/personal-learning-path.serializers";
import type { RequestContext } from "#api/modules/learning-paths/types/learning-path.types";
import { BackgroundJobQueueService } from "#api/modules/jobs/services/background-job-queue.service";

const CLONE_RESOURCE_TYPE = "ENROLLMENT";
const CLONE_ACTION = "PERSONAL_LEARNING_PATH_CLONE";

@Injectable()
export class PersonalLearningPathsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(BackgroundJobQueueService)
    private readonly backgroundJobQueue: BackgroundJobQueueService,
  ) {}

  async listEnrollments(
    learningPathId: string,
    query: PersonalLearningPathEnrollmentsQueryDto,
  ) {
    await this.assertCatalogLearningPathExists(learningPathId);

    const where: Prisma.EnrollmentWhereInput = {
      learningPathId,
      status: EnrollmentStatus.ACTIVE,
      ...(await this.buildPersonalizationWhere(
        learningPathId,
        query.personalizationStatus,
      )),
      ...(query.search
        ? {
            studentUser: {
              OR: [
                { fullName: { contains: query.search, mode: "insensitive" } },
                { username: { contains: query.search, mode: "insensitive" } },
                { email: { contains: query.search, mode: "insensitive" } },
                { phone: { contains: query.search, mode: "insensitive" } },
                {
                  studentProfile: {
                    displayName: {
                      contains: query.search,
                      mode: "insensitive",
                    },
                  },
                },
              ],
            },
          }
        : {}),
    };

    const [enrollments, total] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({
        where,
        select: personalLearningPathEnrollmentSelect,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.enrollment.count({ where }),
    ]);
    const jobsByEnrollmentId = await this.findLatestJobs(
      enrollments.map((item) => item.id),
    );

    return {
      data: enrollments.map((enrollment) =>
        serializePersonalLearningPathEnrollment(
          enrollment,
          jobsByEnrollmentId.get(enrollment.id) ?? null,
        ),
      ),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getByEnrollment(enrollmentId: string) {
    const enrollment = await this.findEnrollment(enrollmentId);
    const job = await this.findLatestJob(enrollmentId);

    return serializePersonalLearningPathEnrollment(enrollment, job);
  }

  async createCloneJob(
    enrollmentId: string,
    actorUserId: string,
    dto: CreatePersonalLearningPathDto,
    context: RequestContext = {},
  ) {
    const enrollment = await this.findEnrollment(enrollmentId);

    if (enrollment.learningPath.kind !== LearningPathKind.CATALOG) {
      throwConflict(
        "PERSONAL_LEARNING_PATH_SOURCE_INVALID",
        "Chỉ có thể tùy chỉnh từ khóa học gốc trong catalog",
      );
    }

    const idempotentJob = await this.prisma.backgroundJob.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      select: personalLearningPathJobSelect,
    });

    if (idempotentJob) {
      if (
        idempotentJob.queue !== BackgroundJobQueue.PERSONAL_LEARNING_PATH_CLONE ||
        idempotentJob.resourceType !== CLONE_RESOURCE_TYPE ||
        idempotentJob.resourceId !== enrollmentId
      ) {
        throwConflict(
          "IDEMPOTENCY_KEY_REUSED",
          "Khóa idempotency đã được dùng cho một yêu cầu khác",
        );
      }

      return this.serializeQueuedResponse(idempotentJob);
    }

    if (enrollment.deliveryLearningPath) {
      throwConflict(
        "PERSONAL_LEARNING_PATH_EXISTS",
        "Học sinh đã sử dụng một khóa học cá nhân",
        { personalLearningPathId: enrollment.deliveryLearningPath.id },
      );
    }

    const activeJob = await this.findActiveJob(enrollmentId);
    if (activeJob) {
      return this.serializeQueuedResponse(activeJob);
    }

    let job;
    try {
      job = await this.prisma.$transaction(async (tx) => {
        const created = await tx.backgroundJob.create({
          data: {
            queue: BackgroundJobQueue.PERSONAL_LEARNING_PATH_CLONE,
            status: BackgroundJobStatus.QUEUED,
            idempotencyKey: dto.idempotencyKey,
            ownerUserId: actorUserId,
            resourceType: CLONE_RESOURCE_TYPE,
            resourceId: enrollmentId,
            inputMeta: {
              action: CLONE_ACTION,
              enrollmentId,
              sourceLearningPathId: enrollment.learningPath.id,
              requestedById: actorUserId,
            },
            maxAttempts: 3,
          },
          select: personalLearningPathJobSelect,
        });

        await tx.auditLog.create({
          data: {
            actorUserId,
            action: "PERSONAL_LEARNING_PATH_CLONE_REQUESTED",
            entityType: "Enrollment",
            entityId: enrollmentId,
            after: {
              jobId: created.id,
              sourceLearningPathId: enrollment.learningPath.id,
              idempotencyKey: dto.idempotencyKey,
            },
            ipAddress: context.ipAddress,
            userAgent: context.userAgent,
          },
        });

        return created;
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const existing =
          (await this.prisma.backgroundJob.findUnique({
            where: { idempotencyKey: dto.idempotencyKey },
            select: personalLearningPathJobSelect,
          })) ?? (await this.findActiveJob(enrollmentId));

        if (existing) {
          return this.serializeQueuedResponse(existing);
        }
      }

      throw error;
    }

    await this.backgroundJobQueue.enqueue(job.id);
    return this.serializeQueuedResponse(job);
  }

  private async assertCatalogLearningPathExists(learningPathId: string) {
    const learningPath = await this.prisma.learningPath.findFirst({
      where: {
        id: learningPathId,
        kind: LearningPathKind.CATALOG,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!learningPath) {
      throwNotFound(
        "LEARNING_PATH_NOT_FOUND",
        "Không tìm thấy khóa học gốc trong catalog",
      );
    }
  }

  private async findEnrollment(enrollmentId: string) {
    const now = new Date();
    const enrollment = await this.prisma.enrollment.findFirst({
      where: {
        id: enrollmentId,
        status: EnrollmentStatus.ACTIVE,
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
      select: personalLearningPathEnrollmentSelect,
    });

    if (!enrollment) {
      throwNotFound(
        "ACTIVE_ENROLLMENT_NOT_FOUND",
        "Không tìm thấy lượt ghi danh đang hoạt động",
      );
    }

    return enrollment;
  }

  private findLatestJob(enrollmentId: string) {
    return this.prisma.backgroundJob.findFirst({
      where: {
        queue: BackgroundJobQueue.PERSONAL_LEARNING_PATH_CLONE,
        resourceType: CLONE_RESOURCE_TYPE,
        resourceId: enrollmentId,
      },
      select: personalLearningPathJobSelect,
      orderBy: { createdAt: "desc" },
    });
  }

  private findActiveJob(enrollmentId: string) {
    return this.prisma.backgroundJob.findFirst({
      where: {
        queue: BackgroundJobQueue.PERSONAL_LEARNING_PATH_CLONE,
        resourceType: CLONE_RESOURCE_TYPE,
        resourceId: enrollmentId,
        status: {
          in: [BackgroundJobStatus.QUEUED, BackgroundJobStatus.RUNNING],
        },
      },
      select: personalLearningPathJobSelect,
      orderBy: { createdAt: "desc" },
    });
  }

  private async findLatestJobs(enrollmentIds: string[]) {
    if (enrollmentIds.length === 0) {
      return new Map();
    }

    const jobs = await this.prisma.backgroundJob.findMany({
      where: {
        queue: BackgroundJobQueue.PERSONAL_LEARNING_PATH_CLONE,
        resourceType: CLONE_RESOURCE_TYPE,
        resourceId: { in: enrollmentIds },
      },
      select: personalLearningPathJobSelect,
      orderBy: { createdAt: "desc" },
    });
    const latestJobs = new Map<string, (typeof jobs)[number]>();

    for (const job of jobs) {
      if (job.resourceId && !latestJobs.has(job.resourceId)) {
        latestJobs.set(job.resourceId, job);
      }
    }

    return latestJobs;
  }

  private async buildPersonalizationWhere(
    learningPathId: string,
    status: PersonalizationStatus | undefined,
  ): Promise<Prisma.EnrollmentWhereInput> {
    if (!status) {
      return {};
    }

    const enrollmentIds = (
      await this.prisma.enrollment.findMany({
        where: {
          learningPathId,
          status: EnrollmentStatus.ACTIVE,
        },
        select: { id: true },
      })
    ).map((item) => item.id);
    const jobs = await this.prisma.backgroundJob.findMany({
      where: {
        queue: BackgroundJobQueue.PERSONAL_LEARNING_PATH_CLONE,
        resourceType: CLONE_RESOURCE_TYPE,
        resourceId: { in: enrollmentIds },
      },
      select: {
        resourceId: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
    });
    const latestStatusByEnrollmentId = new Map<string, BackgroundJobStatus>();

    for (const job of jobs) {
      if (job.resourceId && !latestStatusByEnrollmentId.has(job.resourceId)) {
        latestStatusByEnrollmentId.set(job.resourceId, job.status);
      }
    }
    const idsWithStatus = (statuses: BackgroundJobStatus[]) =>
      enrollmentIds.filter((id) => {
        const jobStatus = latestStatusByEnrollmentId.get(id);
        return jobStatus ? statuses.includes(jobStatus) : false;
      });

    if (status === PersonalizationStatus.PERSONALIZED) {
      return { deliveryLearningPathId: { not: null } };
    }

    if (status === PersonalizationStatus.BASE) {
      return {
        deliveryLearningPathId: null,
        id: {
          notIn: [...latestStatusByEnrollmentId.keys()],
        },
      };
    }

    if (status === PersonalizationStatus.CLONING) {
      return {
        deliveryLearningPathId: null,
        id: {
          in: idsWithStatus([
            BackgroundJobStatus.QUEUED,
            BackgroundJobStatus.RUNNING,
          ]),
        },
      };
    }

    if (status === PersonalizationStatus.FAILED) {
      return {
        deliveryLearningPathId: null,
        id: {
          in: idsWithStatus([BackgroundJobStatus.FAILED]),
        },
      };
    }

    return {};
  }

  private serializeQueuedResponse(job: Parameters<typeof serializePersonalLearningPathJob>[0]) {
    return {
      mode: "QUEUED" as const,
      ...serializePersonalLearningPathJob(job),
    };
  }
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}
