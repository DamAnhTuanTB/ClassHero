import { Module } from "@nestjs/common";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { AuthModule } from "#api/modules/auth/auth.module";
import { LearningPathsModule } from "#api/modules/learning-paths/learning-paths.module";
import { FilesModule } from "#api/modules/files/files.module";
import { QuizFiguresModule } from "#api/modules/quiz-figures/quiz-figures.module";
import { AdminQuizController } from "#api/modules/quiz/controllers/admin-quiz.controller";
import { StudentQuizAttemptsController } from "#api/modules/quiz/controllers/student-quiz-attempts.controller";
import { QuizService } from "#api/modules/quiz/services/quiz.service";
import { StudentQuizAttemptsService } from "#api/modules/quiz/services/student-quiz-attempts.service";
import { QuizGenerationContextService } from "#api/modules/quiz/services/quiz-generation-context.service";
import { QuizGenerationJobService } from "#api/modules/quiz/services/quiz-generation-job.service";
import { QuizSourcePacketService } from "#api/modules/quiz/services/quiz-source-packet.service";
import { QuizSolutionRefinementService } from "#api/modules/quiz/services/quiz-solution-refinement.service";

@Module({
  imports: [PrismaModule, AuthModule, FilesModule, LearningPathsModule, QuizFiguresModule],
  controllers: [AdminQuizController, StudentQuizAttemptsController],
  providers: [
    QuizService,
    StudentQuizAttemptsService,
    QuizGenerationContextService,
    QuizGenerationJobService,
    QuizSourcePacketService,
    QuizSolutionRefinementService,
  ],
  exports: [QuizService, StudentQuizAttemptsService],
})
export class QuizModule {}
