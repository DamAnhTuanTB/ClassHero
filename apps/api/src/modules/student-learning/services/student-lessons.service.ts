import { Inject, Injectable } from "@nestjs/common";
import { ReviewStatus } from "@prisma/client";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { FilesService } from "#api/modules/files/services/files.service";
import { StudentLessonAccessService } from "#api/modules/learning-paths/services/student-lesson-access.service";
import { throwLessonNotFound } from "#api/modules/learning-paths/utils/lesson.helpers";
import { StudentLearningPrerequisitesService } from "#api/modules/student-learning/services/student-learning-prerequisites.service";
import {
  studentLessonContentSelect,
  studentLessonSummarySelect,
  studentQuizSetSelect,
  studentTestSetSelect,
} from "#api/modules/student-learning/selectors/student-lesson.selects";
import {
  serializeStudentLessonContent,
  serializeStudentLessonSummary,
  serializeStudentQuizSet,
  serializeStudentTestStatus,
} from "#api/modules/student-learning/serializers/student-lesson.serializers";
import type { StudentLessonContentRecord } from "#api/modules/student-learning/types/student-lesson.types";

@Injectable()
export class StudentLessonsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FilesService) private readonly filesService: FilesService,
    @Inject(StudentLessonAccessService)
    private readonly studentLessonAccessService: StudentLessonAccessService,
    @Inject(StudentLearningPrerequisitesService)
    private readonly prerequisitesService: StudentLearningPrerequisitesService,
  ) {}

  async getLessonContent(lessonId: string, studentUserId: string) {
    const access = await this.studentLessonAccessService.assertCanRead(
      lessonId,
      studentUserId,
    );
    const record = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: studentLessonContentSelect,
    });

    if (!record) {
      throwLessonNotFound();
    }

    const [fileAccessUrls, navigation] = await Promise.all([
      this.resolveFileAccessUrls(record),
      this.getLessonNavigation(record.learningPathId, lessonId),
    ]);
    return {
      ...serializeStudentLessonContent(record, access, fileAccessUrls),
      navigation,
    };
  }

  async getLessonSummary(lessonId: string, studentUserId: string) {
    await this.studentLessonAccessService.assertCanRead(lessonId, studentUserId);
    const record = await this.prisma.lessonSummary.findFirst({
      where: {
        lessonId,
        deletedAt: null,
        reviewStatus: ReviewStatus.APPROVED,
      },
      select: studentLessonSummarySelect,
    });

    return serializeStudentLessonSummary(record);
  }

  async listQuizSets(lessonId: string, studentUserId: string) {
    await this.studentLessonAccessService.assertCanRead(lessonId, studentUserId);
    const records = await this.prisma.quizSet.findMany({
      where: {
        lessonId,
        deletedAt: null,
        isReserve: false,
        reviewStatus: ReviewStatus.APPROVED,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: studentQuizSetSelect,
    });

    return records.map(serializeStudentQuizSet);
  }

  async getTestSetsStatus(lessonId: string, studentUserId: string) {
    const [prerequisites, records, progress] = await Promise.all([
      this.prerequisitesService.getTestPrerequisites(lessonId, studentUserId),
      this.prisma.testSet.findMany({
        where: {
          lessonId,
          deletedAt: null,
          isReserve: false,
          reviewStatus: ReviewStatus.APPROVED,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: studentTestSetSelect,
      }),
      this.prisma.lessonProgress.findUnique({
        where: {
          studentUserId_lessonId: {
            studentUserId,
            lessonId,
          },
        },
        select: {
          bestTestAttempt: {
            select: {
              id: true,
              score: true,
              durationSeconds: true,
            },
          },
        },
      }),
    ]);

    return serializeStudentTestStatus(
      records,
      prerequisites,
      progress?.bestTestAttempt ?? null,
    );
  }

  private async getLessonNavigation(learningPathId: string, lessonId: string) {
    const lessons = await this.prisma.lesson.findMany({
      where: {
        learningPathId,
        deletedAt: null,
        status: "PUBLISHED",
        chapter: {
          deletedAt: null,
          status: "PUBLISHED",
        },
      },
      orderBy: [{ chapter: { orderIndex: "asc" } }, { orderIndex: "asc" }],
      select: {
        id: true,
        title: true,
        orderIndex: true,
        chapter: {
          select: {
            id: true,
            title: true,
            orderIndex: true,
          },
        },
      },
    });
    const currentIndex = lessons.findIndex((lesson) => lesson.id === lessonId);
    return {
      previous: currentIndex > 0 ? lessons[currentIndex - 1] : null,
      next:
        currentIndex >= 0 && currentIndex < lessons.length - 1
          ? lessons[currentIndex + 1]
          : null,
    };
  }

  private async resolveFileAccessUrls(record: StudentLessonContentRecord) {
    const filesById = new Map<
      string,
      StudentLessonContentRecord["documents"][number]["file"]
    >();

    for (const material of record.materials) {
      if (material.file) {
        filesById.set(material.file.id, material.file);
      }
    }
    for (const document of record.documents) {
      filesById.set(document.file.id, document.file);
    }

    const entries = await Promise.all(
      [...filesById.values()].map(
        async (file) =>
          [file.id, await this.filesService.resolveAccessUrl(file)] as const,
      ),
    );

    return new Map(entries);
  }
}
