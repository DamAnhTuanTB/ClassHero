import { Inject, Injectable } from "@nestjs/common";
import { AttemptStatus, ReviewStatus } from "@prisma/client";
import { throwBadRequest } from "#api/common/errors/api-exception";
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
import {
  buildVideoTimelineVersion,
  serializeVideoPlaybackProgress,
} from "#api/modules/student-learning/utils/video-playback-progress";

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

    const [fileAccessUrls, stemFigureAssetUrls, navigation, videoProgressRecord] =
      await Promise.all([
        this.resolveFileAccessUrls(record),
        this.resolveStemFigureAssetUrls(record.summary),
        this.getLessonNavigation(record.learningPathId, lessonId),
        this.prisma.videoPlaybackProgress.findUnique({
          where: { studentUserId_lessonId: { studentUserId, lessonId } },
          select: {
            lastPositionSeconds: true,
            timelineVersion: true,
            updatedAt: true,
          },
        }),
      ]);
    const timelineVersion = buildVideoTimelineVersion(
      record.videoUrl,
      record.customVideoSettings,
    );
    return {
      ...serializeStudentLessonContent(
        record,
        access,
        fileAccessUrls,
        stemFigureAssetUrls,
      ),
      navigation,
      videoProgress: serializeVideoPlaybackProgress(timelineVersion, videoProgressRecord),
    };
  }

  async getVideoProgress(lessonId: string, studentUserId: string) {
    await this.studentLessonAccessService.assertCanRead(lessonId, studentUserId);
    const lesson = await this.getVideoTimelineLesson(lessonId);
    const timelineVersion = buildVideoTimelineVersion(
      lesson.videoUrl,
      lesson.customVideoSettings,
    );
    const progress = await this.prisma.videoPlaybackProgress.findUnique({
      where: { studentUserId_lessonId: { studentUserId, lessonId } },
      select: {
        lastPositionSeconds: true,
        timelineVersion: true,
        updatedAt: true,
      },
    });

    return serializeVideoPlaybackProgress(timelineVersion, progress);
  }

  async saveVideoProgress(
    lessonId: string,
    studentUserId: string,
    positionSeconds: number,
  ) {
    await this.studentLessonAccessService.assertCanRead(lessonId, studentUserId);
    const lesson = await this.getVideoTimelineLesson(lessonId);
    const timelineVersion = buildVideoTimelineVersion(
      lesson.videoUrl,
      lesson.customVideoSettings,
    );

    if (!timelineVersion) {
      throwBadRequest("LESSON_VIDEO_REQUIRED", "Buổi học chưa có video để lưu tiến độ");
    }

    const progress = await this.prisma.videoPlaybackProgress.upsert({
      where: { studentUserId_lessonId: { studentUserId, lessonId } },
      create: {
        studentUserId,
        lessonId,
        lastPositionSeconds: roundPlaybackPosition(positionSeconds),
        timelineVersion,
      },
      update: {
        lastPositionSeconds: roundPlaybackPosition(positionSeconds),
        timelineVersion,
      },
      select: {
        lastPositionSeconds: true,
        timelineVersion: true,
        updatedAt: true,
      },
    });

    return serializeVideoPlaybackProgress(timelineVersion, progress);
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

    const stemFigureAssetUrls = await this.resolveStemFigureAssetUrls(record);
    return serializeStudentLessonSummary(record, stemFigureAssetUrls);
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
    const [prerequisites, records, progress, latestSubmittedAttempt] = await Promise.all([
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
      this.prisma.testAttempt.findFirst({
        where: {
          lessonId,
          studentUserId,
          status: {
            in: [AttemptStatus.SUBMITTED, AttemptStatus.GRADED],
          },
        },
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          score: true,
          durationSeconds: true,
          submittedAt: true,
        },
      }),
    ]);

    return serializeStudentTestStatus(
      records,
      prerequisites,
      progress?.bestTestAttempt ?? null,
      latestSubmittedAttempt,
    );
  }

  private async getLessonNavigation(learningPathId: string, lessonId: string) {
    const [chapters, topLevelLessons] = await Promise.all([
      this.prisma.learningPathChapter.findMany({
        where: {
          learningPathId,
          deletedAt: null,
          status: "PUBLISHED",
        },
        select: {
          id: true,
          orderIndex: true,
          title: true,
          lessons: {
            where: { deletedAt: null, status: "PUBLISHED" },
            orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              title: true,
              orderIndex: true,
            },
          },
        },
      }),
      this.prisma.lesson.findMany({
        where: {
          learningPathId,
          chapterId: null,
          deletedAt: null,
          status: "PUBLISHED",
        },
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          orderIndex: true,
        },
      }),
    ]);
    const structureItems = [
      ...chapters.map((chapter) => ({
        type: "CHAPTER" as const,
        orderIndex: chapter.orderIndex,
        chapter,
      })),
      ...topLevelLessons.map((lesson) => ({
        type: "LESSON" as const,
        orderIndex: lesson.orderIndex,
        lesson,
      })),
    ].sort(
      (left, right) =>
        left.orderIndex - right.orderIndex || left.type.localeCompare(right.type),
    );
    const lessons: Array<{
      id: string;
      title: string;
      orderIndex: number;
      chapter: { id: string; title: string; orderIndex: number } | null;
    }> = [];

    for (const item of structureItems) {
      if (item.type === "LESSON") {
        lessons.push({ ...item.lesson, chapter: null });
        continue;
      }

      lessons.push(
        ...item.chapter.lessons.map((lesson) => ({
          ...lesson,
          chapter: {
            id: item.chapter.id,
            title: item.chapter.title,
            orderIndex: item.chapter.orderIndex,
          },
        })),
      );
    }
    const currentIndex = lessons.findIndex((lesson) => lesson.id === lessonId);
    return {
      previous: currentIndex > 0 ? lessons[currentIndex - 1] : null,
      next:
        currentIndex >= 0 && currentIndex < lessons.length - 1
          ? lessons[currentIndex + 1]
          : null,
    };
  }

  private async getVideoTimelineLesson(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { customVideoSettings: true, videoUrl: true },
    });

    if (!lesson) {
      throwLessonNotFound();
    }

    return lesson;
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

  private async resolveStemFigureAssetUrls(
    summary: StudentLessonContentRecord["summary"],
  ) {
    if (!summary) return new Map<string, string | null>();
    const entries = await Promise.all(
      summary.stemFigures.map(
        async (figure) =>
          [
            figure.id,
            await this.filesService.resolveAccessUrl(
              figure.currentRevision?.deliveryFile,
            ),
          ] as const,
      ),
    );
    return new Map(entries);
  }
}

function roundPlaybackPosition(positionSeconds: number) {
  return Math.round(positionSeconds * 10) / 10;
}
