import { Module } from "@nestjs/common";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { AuthModule } from "#api/modules/auth/auth.module";
import { LearningPathsModule } from "#api/modules/learning-paths/learning-paths.module";
import { StudentLearningModule } from "#api/modules/student-learning/student-learning.module";
import { QuizFiguresModule } from "#api/modules/quiz-figures/quiz-figures.module";
import { AdminTestFiguresController } from "#api/modules/tests/controllers/admin-test-figures.controller";
import { AdminTestsController } from "#api/modules/tests/controllers/admin-tests.controller";
import { StudentTestAttemptsController } from "#api/modules/tests/controllers/student-test-attempts.controller";
import { AssessmentsModule } from "#api/modules/assessments/assessments.module";
import { StudentTestAttemptsService } from "#api/modules/tests/services/student-test-attempts.service";
import { QuizModule } from "#api/modules/quiz/quiz.module";
import { FilesModule } from "#api/modules/files/files.module";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    FilesModule,
    AssessmentsModule,
    LearningPathsModule,
    StudentLearningModule,
    QuizFiguresModule,
    QuizModule,
  ],
  controllers: [
    AdminTestsController,
    AdminTestFiguresController,
    StudentTestAttemptsController,
  ],
  providers: [StudentTestAttemptsService],
  exports: [StudentTestAttemptsService],
})
export class TestsModule {}
