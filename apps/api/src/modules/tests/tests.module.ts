import { Module } from "@nestjs/common";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { AuthModule } from "#api/modules/auth/auth.module";
import { LearningPathsModule } from "#api/modules/learning-paths/learning-paths.module";
import { StudentLearningModule } from "#api/modules/student-learning/student-learning.module";
import { AdminTestsController } from "#api/modules/tests/controllers/admin-tests.controller";
import { StudentTestAttemptsController } from "#api/modules/tests/controllers/student-test-attempts.controller";
import { TestsService } from "#api/modules/tests/services/tests.service";
import { StudentTestAttemptsService } from "#api/modules/tests/services/student-test-attempts.service";

@Module({
  imports: [PrismaModule, AuthModule, LearningPathsModule, StudentLearningModule],
  controllers: [AdminTestsController, StudentTestAttemptsController],
  providers: [TestsService, StudentTestAttemptsService],
  exports: [TestsService, StudentTestAttemptsService],
})
export class TestsModule {}
