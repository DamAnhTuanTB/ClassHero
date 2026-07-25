import { Module } from "@nestjs/common";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { AuthModule } from "#api/modules/auth/auth.module";
import { QuizService } from "./services/quiz.service";
import { AdminQuizController } from "./controllers/admin-quiz.controller";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminQuizController],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}
