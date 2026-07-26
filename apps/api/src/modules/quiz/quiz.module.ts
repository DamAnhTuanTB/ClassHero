import { Module } from "@nestjs/common";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { AuthModule } from "#api/modules/auth/auth.module";
import { AdminQuizController } from "#api/modules/quiz/controllers/admin-quiz.controller";
import { QuizService } from "#api/modules/quiz/services/quiz.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminQuizController],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
