import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { FilesModule } from "#api/modules/files/files.module";
import { AiModule } from "#api/modules/ai/ai.module";
import { validateEnv } from "#api/config/env.validation";
import { DocumentProcessingProcessor } from "#api/workers/processors/document-processing.processor";
import { EmbeddingProcessor } from "#api/workers/processors/embedding.processor";
import { DocumentProcessingWorkerService } from "#api/workers/services/document-processing-worker.service";
import { EmbeddingWorkerService } from "#api/workers/services/embedding-worker.service";
import { EmbeddingJobEnqueuer } from "#api/workers/services/embedding-job-enqueuer.service";
import { MathpixOcrService } from "#api/workers/services/mathpix-ocr.service";
import { PdfMetadataService } from "#api/workers/services/pdf-metadata.service";
import { OcrArtifactCacheService } from "#api/workers/services/ocr-artifact-cache.service";
import { ImageExtractionService } from "#api/workers/services/image-extraction.service";
import { PersonalLearningPathCloneProcessor } from "#api/workers/processors/personal-learning-path-clone.processor";
import { PersonalLearningPathCloneWorkerService } from "#api/workers/services/personal-learning-path-clone-worker.service";
import { PersonalLearningPathClonerService } from "#api/workers/services/personal-learning-path-cloner.service";
import { AiGenerationProcessor } from "#api/workers/processors/ai-generation.processor";
import { AiGenerationExecutionService } from "#api/workers/services/ai-generation-execution.service";
import { AiGenerationWorkerService } from "#api/workers/services/ai-generation-worker.service";
import { LessonSummaryGenerationService } from "#api/workers/services/lesson-summary-generation.service";
import { LessonContentGenerationService } from "#api/workers/services/lesson-content-generation.service";
import { ProviderOperationsModule } from "#api/modules/provider-operations/provider-operations.module";
import { StemFiguresModule } from "#api/modules/stem-figures/stem-figures.module";
import { StemFigureRenderingProcessor } from "#api/workers/processors/stem-figure-rendering.processor";
import { StemFigureRenderingWorkerService } from "#api/workers/services/stem-figure-rendering-worker.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "apps/api/.env", "../../.env"],
      validate: validateEnv,
    }),
    PrismaModule,
    ProviderOperationsModule,
    AiModule,
    FilesModule,
    StemFiguresModule,
  ],
  providers: [
    DocumentProcessingProcessor,
    DocumentProcessingWorkerService,
    EmbeddingProcessor,
    EmbeddingWorkerService,
    EmbeddingJobEnqueuer,
    MathpixOcrService,
    PdfMetadataService,
    OcrArtifactCacheService,
    ImageExtractionService,
    PersonalLearningPathCloneProcessor,
    PersonalLearningPathCloneWorkerService,
    PersonalLearningPathClonerService,
    AiGenerationProcessor,
    AiGenerationExecutionService,
    AiGenerationWorkerService,
    LessonSummaryGenerationService,
    LessonContentGenerationService,
    StemFigureRenderingProcessor,
    StemFigureRenderingWorkerService,
  ],
})
export class WorkerModule {}
