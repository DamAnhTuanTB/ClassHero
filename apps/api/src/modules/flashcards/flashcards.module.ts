import { Module } from "@nestjs/common";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { AuthModule } from "#api/modules/auth/auth.module";
import { AdminFlashcardsController } from "#api/modules/flashcards/controllers/admin-flashcards.controller";
import { StudentFlashcardsController } from "#api/modules/flashcards/controllers/student-flashcards.controller";
import { FlashcardsService } from "#api/modules/flashcards/services/flashcards.service";
import { FlashcardGenerationContextService } from "#api/modules/flashcards/services/flashcard-generation-context.service";
import { FlashcardGenerationJobService } from "#api/modules/flashcards/services/flashcard-generation-job.service";
import { FlashcardSourcePacketService } from "#api/modules/flashcards/services/flashcard-source-packet.service";
import { FilesModule } from "#api/modules/files/files.module";
import { FlashcardFigureRequestService } from "#api/modules/flashcards/services/flashcard-figure-request.service";
import { AiModule } from "#api/modules/ai/ai.module";
import { ProviderOperationsModule } from "#api/modules/provider-operations/provider-operations.module";
import { LearningPathsModule } from "#api/modules/learning-paths/learning-paths.module";
import { JobsModule } from "#api/modules/jobs/jobs.module";
import { FlashcardFigureJobService } from "#api/modules/flashcards/services/flashcard-figure-job.service";
import { FlashcardFiguresService } from "#api/modules/flashcards/services/flashcard-figures.service";
import { FlashcardFigureArtifactService } from "#api/modules/flashcards/services/flashcard-figure-artifact.service";
import { FlashcardTexRendererClientService } from "#api/modules/flashcards/services/flashcard-tex-renderer-client.service";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    AiModule,
    FilesModule,
    LearningPathsModule,
    JobsModule,
    ProviderOperationsModule,
  ],
  controllers: [AdminFlashcardsController, StudentFlashcardsController],
  providers: [
    FlashcardsService,
    FlashcardGenerationContextService,
    FlashcardGenerationJobService,
    FlashcardSourcePacketService,
    FlashcardFigureRequestService,
    FlashcardFigureJobService,
    FlashcardFiguresService,
    FlashcardFigureArtifactService,
    FlashcardTexRendererClientService,
  ],
  exports: [
    FlashcardsService,
    FlashcardFigureRequestService,
    FlashcardFigureArtifactService,
    FlashcardTexRendererClientService,
  ],
})
export class FlashcardsModule {}
