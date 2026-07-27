import { Inject, Injectable } from "@nestjs/common";
import { ReviewStatus } from "@prisma/client";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { FilesService } from "#api/modules/files/services/files.service";
import { StudentLessonAccessService } from "#api/modules/learning-paths/services/student-lesson-access.service";
import { throwLessonNotFound } from "#api/modules/learning-paths/utils/lesson.helpers";
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

    const fileAccessUrls = await this.resolveFileAccessUrls(record);
    return serializeStudentLessonContent(record, access, fileAccessUrls);
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
    const access = await this.studentLessonAccessService.assertCanRead(
      lessonId,
      studentUserId,
    );
    const [lesson, records] = await Promise.all([
      this.prisma.lesson.findUnique({
        where: { id: lessonId },
        select: { examOpenAt: true },
      }),
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
    ]);

    if (!lesson) {
      throwLessonNotFound();
    }

    return serializeStudentTestStatus(records, lesson.examOpenAt, access);
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
