import { Module } from "@nestjs/common";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { AuthModule } from "#api/modules/auth/auth.module";
import { AdminFlashcardsController } from "#api/modules/flashcards/controllers/admin-flashcards.controller";
import { StudentFlashcardsController } from "#api/modules/flashcards/controllers/student-flashcards.controller";
import { FlashcardsService } from "#api/modules/flashcards/services/flashcards.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminFlashcardsController, StudentFlashcardsController],
  providers: [FlashcardsService],
  exports: [FlashcardsService],
})
export class FlashcardsModule {}
