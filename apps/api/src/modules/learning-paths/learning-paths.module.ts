import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { RolesGuard } from "../../common/auth/roles.guard";
import { AuthModule } from "../auth/auth.module";
import { AdminLessonsController } from "./admin-lessons.controller";
import { AdminLearningPathsController } from "./admin-learning-paths.controller";
import { LearningPathsService } from "./learning-paths.service";
import { LessonsService } from "./lessons.service";
import { PublicLearningPathsController } from "./public-learning-paths.controller";

@Module({
  imports: [AuthModule, JwtModule.register({})],
  controllers: [
    AdminLearningPathsController,
    AdminLessonsController,
    PublicLearningPathsController,
  ],
  providers: [LearningPathsService, LessonsService, JwtAuthGuard, RolesGuard],
  exports: [LearningPathsService],
})
export class LearningPathsModule {}
