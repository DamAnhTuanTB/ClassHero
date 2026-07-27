import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "#api/app.controller";
import { AppService } from "#api/app.service";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { validateEnv } from "#api/config/env.validation";
import { AiModule } from "#api/modules/ai/ai.module";
import { AuthModule } from "#api/modules/auth/auth.module";
import { FilesModule } from "#api/modules/files/files.module";
import { FlashcardsModule } from "#api/modules/flashcards/flashcards.module";
import { JobsModule } from "#api/modules/jobs/jobs.module";
import { LearningPathsModule } from "#api/modules/learning-paths/learning-paths.module";
import { PaymentsModule } from "#api/modules/payments/payments.module";
import { QuizModule } from "#api/modules/quiz/quiz.module";
import { StudentLearningModule } from "#api/modules/student-learning/student-learning.module";
import { TestsModule } from "#api/modules/tests/tests.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "apps/api/.env", "../../.env"],
      validate: validateEnv,
    }),
    PrismaModule,
    AiModule,
    AuthModule,
    FilesModule,
    FlashcardsModule,
    JobsModule,
    LearningPathsModule,
    PaymentsModule,
    QuizModule,
    StudentLearningModule,
    TestsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
