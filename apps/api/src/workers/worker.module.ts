import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { FilesModule } from "#api/modules/files/files.module";
import { validateEnv } from "#api/config/env.validation";
import { DocumentProcessingProcessor } from "#api/workers/processors/document-processing.processor";
import { DocumentProcessingWorkerService } from "#api/workers/services/document-processing-worker.service";
import { MathpixOcrService } from "#api/workers/services/mathpix-ocr.service";
import { PdfMetadataService } from "#api/workers/services/pdf-metadata.service";
import { OcrArtifactCacheService } from "#api/workers/services/ocr-artifact-cache.service";
import { ImageExtractionService } from "#api/workers/services/image-extraction.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "apps/api/.env", "../../.env"],
      validate: validateEnv,
    }),
    PrismaModule,
    FilesModule,
  ],
  providers: [
    DocumentProcessingProcessor,
    DocumentProcessingWorkerService,
    MathpixOcrService,
    PdfMetadataService,
    OcrArtifactCacheService,
    ImageExtractionService,
  ],
})
export class WorkerModule {}
