import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "#api/common/auth/optional-jwt-auth.guard";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { AuthModule } from "#api/modules/auth/auth.module";
import { FilesModule } from "#api/modules/files/files.module";
import { JobsModule } from "#api/modules/jobs/jobs.module";
import { AdminChaptersController } from "#api/modules/learning-paths/controllers/admin-chapters.controller";
import { AdminLessonAiGenerationPanelController } from "#api/modules/learning-paths/controllers/admin-lesson-ai-generation-panel.controller";
import {
  AdminLearningPathLessonDocumentsController,
  AdminLessonDocumentsController,
} from "#api/modules/learning-paths/controllers/admin-lesson-documents.controller";
import { AdminLearningPathsController } from "#api/modules/learning-paths/controllers/admin-learning-paths.controller";
import { AdminLessonSummariesController } from "#api/modules/learning-paths/controllers/admin-lesson-summaries.controller";
import { AdminPersonalLearningPathsController } from "#api/modules/learning-paths/controllers/admin-personal-learning-paths.controller";
import { AdminLessonsController } from "#api/modules/learning-paths/controllers/admin-lessons.controller";
import { AdminSourceDocumentsController } from "#api/modules/learning-paths/controllers/admin-source-documents.controller";
import { ChaptersService } from "#api/modules/learning-paths/services/chapters.service";
import { LessonDocumentsService } from "#api/modules/learning-paths/services/lesson-documents.service";
import { LessonAiGenerationPanelService } from "#api/modules/learning-paths/services/lesson-ai-generation-panel.service";
import { LearningPathsService } from "#api/modules/learning-paths/services/learning-paths.service";
import { LearningPathStructureService } from "#api/modules/learning-paths/services/learning-path-structure.service";
import { LessonSummariesService } from "#api/modules/learning-paths/services/lesson-summaries.service";
import { LessonsService } from "#api/modules/learning-paths/services/lessons.service";
import { PublicLearningPathsService } from "#api/modules/learning-paths/services/public-learning-paths.service";
import { PersonalLearningPathsService } from "#api/modules/learning-paths/services/personal-learning-paths.service";
import { PublicLearningPathsController } from "#api/modules/learning-paths/controllers/public-learning-paths.controller";
import { SourceDocumentsService } from "#api/modules/learning-paths/services/source-documents.service";
import { StudentLessonAccessService } from "#api/modules/learning-paths/services/student-lesson-access.service";
import { YoutubeTranscriptService } from "#api/modules/learning-paths/services/youtube-transcript.service";
import { OcrArtifactCacheService } from "#api/workers/services/ocr-artifact-cache.service";

@Module({
  imports: [AuthModule, FilesModule, JobsModule, JwtModule.register({})],
  controllers: [
    AdminChaptersController,
    AdminLessonAiGenerationPanelController,
    AdminLearningPathLessonDocumentsController,
    AdminLessonDocumentsController,
    AdminLessonSummariesController,
    AdminLearningPathsController,
    AdminPersonalLearningPathsController,
    AdminLessonsController,
    AdminSourceDocumentsController,
    PublicLearningPathsController,
  ],
  providers: [
    ChaptersService,
    LessonDocumentsService,
    LessonAiGenerationPanelService,
    LearningPathsService,
    LearningPathStructureService,
    LessonSummariesService,
    LessonsService,
    PublicLearningPathsService,
    PersonalLearningPathsService,
    SourceDocumentsService,
    StudentLessonAccessService,
    YoutubeTranscriptService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
    OcrArtifactCacheService,
  ],
  exports: [LearningPathsService, StudentLessonAccessService],
})
export class LearningPathsModule {}
