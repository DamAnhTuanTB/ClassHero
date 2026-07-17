import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { validateEnv } from "#api/config/env.validation";
import { DocumentProcessingProcessor } from "#api/workers/processors/document-processing.processor";
import { DocumentProcessingWorkerService } from "#api/workers/services/document-processing-worker.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "apps/api/.env", "../../.env"],
      validate: validateEnv,
    }),
    PrismaModule,
  ],
  providers: [DocumentProcessingProcessor, DocumentProcessingWorkerService],
})
export class WorkerModule {}
