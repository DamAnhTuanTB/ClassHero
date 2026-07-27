import { Module } from "@nestjs/common";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { AuthModule } from "#api/modules/auth/auth.module";
import { AdminTestsController } from "#api/modules/tests/controllers/admin-tests.controller";
import { TestsService } from "#api/modules/tests/services/tests.service";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminTestsController],
  providers: [TestsService],
  exports: [TestsService],
})
export class TestsModule {}
