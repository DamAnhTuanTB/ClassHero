import { Module } from "@nestjs/common";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { AuthModule } from "#api/modules/auth/auth.module";
import { FilesModule } from "#api/modules/files/files.module";
import { LearningPathsModule } from "#api/modules/learning-paths/learning-paths.module";
import { StudentLessonsController } from "#api/modules/student-learning/controllers/student-lessons.controller";
import { StudentLessonsService } from "#api/modules/student-learning/services/student-lessons.service";

@Module({
  imports: [PrismaModule, AuthModule, FilesModule, LearningPathsModule],
  controllers: [StudentLessonsController],
  providers: [StudentLessonsService],
  exports: [StudentLessonsService],
})
export class StudentLearningModule {}
