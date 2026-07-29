import { Module } from "@nestjs/common";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { AuthModule } from "#api/modules/auth/auth.module";
import { FilesModule } from "#api/modules/files/files.module";
import { LearningPathsModule } from "#api/modules/learning-paths/learning-paths.module";
import { StudentLessonsController } from "#api/modules/student-learning/controllers/student-lessons.controller";
import { StudentLessonsService } from "#api/modules/student-learning/services/student-lessons.service";
import { StudentLearningPrerequisitesService } from "#api/modules/student-learning/services/student-learning-prerequisites.service";

@Module({
  imports: [PrismaModule, AuthModule, FilesModule, LearningPathsModule],
  controllers: [StudentLessonsController],
  providers: [StudentLessonsService, StudentLearningPrerequisitesService],
  exports: [StudentLessonsService, StudentLearningPrerequisitesService],
})
export class StudentLearningModule {}
