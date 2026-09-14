import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { AuthModule } from "#api/modules/auth/auth.module";
import { FilesController } from "#api/modules/files/controllers/files.controller";
import { FilesService } from "#api/modules/files/services/files.service";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";
import { StoredFileCleanupService } from "#api/modules/files/services/stored-file-cleanup.service";

@Module({
  imports: [AuthModule, PrismaModule, JwtModule.register({})],
  controllers: [FilesController],
  providers: [FilesService, ObjectStorageService, StoredFileCleanupService, JwtAuthGuard],
  exports: [FilesService, ObjectStorageService, StoredFileCleanupService],
})
export class FilesModule {}
