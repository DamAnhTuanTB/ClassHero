import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "#api/common/auth/optional-jwt-auth.guard";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { AuthModule } from "#api/modules/auth/auth.module";
import { FilesModule } from "#api/modules/files/files.module";
import { JobsModule } from "#api/modules/jobs/jobs.module";
import { AdminChaptersController } from "#api/modules/learning-paths/controllers/admin-chapters.controller";
import { AdminLessonDocumentsController } from "#api/modules/learning-paths/controllers/admin-lesson-documents.controller";
import { AdminLearningPathsController } from "#api/modules/learning-paths/controllers/admin-learning-paths.controller";
import { AdminLessonsController } from "#api/modules/learning-paths/controllers/admin-lessons.controller";
import { AdminSourceDocumentsController } from "#api/modules/learning-paths/controllers/admin-source-documents.controller";
import { ChaptersService } from "#api/modules/learning-paths/services/chapters.service";
import { LessonDocumentsService } from "#api/modules/learning-paths/services/lesson-documents.service";
import { LearningPathsService } from "#api/modules/learning-paths/services/learning-paths.service";
import { LessonsService } from "#api/modules/learning-paths/services/lessons.service";
import { PublicLearningPathsService } from "#api/modules/learning-paths/services/public-learning-paths.service";
import { PublicLearningPathsController } from "#api/modules/learning-paths/controllers/public-learning-paths.controller";
import { SourceDocumentsService } from "#api/modules/learning-paths/services/source-documents.service";

@Module({
  imports: [AuthModule, FilesModule, JobsModule, JwtModule.register({})],
  controllers: [
    AdminChaptersController,
    AdminLessonDocumentsController,
    AdminLearningPathsController,
    AdminLessonsController,
    AdminSourceDocumentsController,
    PublicLearningPathsController,
  ],
  providers: [
    ChaptersService,
    LessonDocumentsService,
    LearningPathsService,
    LessonsService,
    PublicLearningPathsService,
    SourceDocumentsService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
  ],
  exports: [LearningPathsService],
})
export class LearningPathsModule {}
