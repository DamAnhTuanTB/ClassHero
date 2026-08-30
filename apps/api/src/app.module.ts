import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "#api/app.controller";
import { AppService } from "#api/app.service";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { BACKEND_CONFIG_MODULE_OPTIONS } from "#api/config/backend-config.options";
import { AiModule } from "#api/modules/ai/ai.module";
import { AuthModule } from "#api/modules/auth/auth.module";
import { DomainsModule } from "#api/modules/domains/domains.module";
import { FilesModule } from "#api/modules/files/files.module";
import { FlashcardsModule } from "#api/modules/flashcards/flashcards.module";
import { JobsModule } from "#api/modules/jobs/jobs.module";
import { LearningPathsModule } from "#api/modules/learning-paths/learning-paths.module";
import { PaymentsModule } from "#api/modules/payments/payments.module";
import { QuizModule } from "#api/modules/quiz/quiz.module";
import { QuizFiguresModule } from "#api/modules/quiz-figures/quiz-figures.module";
import { ProviderOperationsModule } from "#api/modules/provider-operations/provider-operations.module";
import { StudentLearningModule } from "#api/modules/student-learning/student-learning.module";
import { StemFiguresModule } from "#api/modules/stem-figures/stem-figures.module";
import { TestsModule } from "#api/modules/tests/tests.module";

@Module({
  imports: [
    ConfigModule.forRoot(BACKEND_CONFIG_MODULE_OPTIONS),
    PrismaModule,
    AiModule,
    AuthModule,
    DomainsModule,
    FilesModule,
    FlashcardsModule,
    JobsModule,
    LearningPathsModule,
    PaymentsModule,
    ProviderOperationsModule,
    QuizModule,
    QuizFiguresModule,
    StudentLearningModule,
    StemFiguresModule,
    TestsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
