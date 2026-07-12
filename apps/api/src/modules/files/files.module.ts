import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { FilesController } from "#api/modules/files/controllers/files.controller";
import { FilesService } from "#api/modules/files/services/files.service";
import { ObjectStorageService } from "#api/modules/files/services/object-storage.service";

@Module({
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [FilesController],
  providers: [FilesService, ObjectStorageService, JwtAuthGuard],
  exports: [FilesService],
})
export class FilesModule {}
