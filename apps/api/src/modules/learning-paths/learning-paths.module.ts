import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "#api/common/auth/optional-jwt-auth.guard";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { AuthModule } from "#api/modules/auth/auth.module";
import { AdminLearningPathsController } from "#api/modules/learning-paths/controllers/admin-learning-paths.controller";
import { AdminLessonsController } from "#api/modules/learning-paths/controllers/admin-lessons.controller";
import { LearningPathsService } from "#api/modules/learning-paths/services/learning-paths.service";
import { LessonsService } from "#api/modules/learning-paths/services/lessons.service";
import { PublicLearningPathsController } from "#api/modules/learning-paths/controllers/public-learning-paths.controller";

@Module({
  imports: [AuthModule, JwtModule.register({})],
  controllers: [
    AdminLearningPathsController,
    AdminLessonsController,
    PublicLearningPathsController,
  ],
  providers: [
    LearningPathsService,
    LessonsService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
  ],
  exports: [LearningPathsService],
})
export class LearningPathsModule {}
