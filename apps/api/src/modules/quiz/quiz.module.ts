import { Module } from "@nestjs/common";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { AuthModule } from "#api/modules/auth/auth.module";
import { LearningPathsModule } from "#api/modules/learning-paths/learning-paths.module";
import { AdminQuizController } from "#api/modules/quiz/controllers/admin-quiz.controller";
import { StudentQuizAttemptsController } from "#api/modules/quiz/controllers/student-quiz-attempts.controller";
import { QuizService } from "#api/modules/quiz/services/quiz.service";
import { StudentQuizAttemptsService } from "#api/modules/quiz/services/student-quiz-attempts.service";

@Module({
  imports: [PrismaModule, AuthModule, LearningPathsModule],
  controllers: [AdminQuizController, StudentQuizAttemptsController],
  providers: [QuizService, StudentQuizAttemptsService],
  exports: [QuizService, StudentQuizAttemptsService],
})
export class QuizModule {}
