import { Module } from "@nestjs/common";
import { FilesModule } from "#api/modules/files/files.module";
import { PrismaModule } from "#api/common/prisma/prisma.module";
import { AssessmentAdminService } from "#api/modules/assessments/services/assessment-admin.service";
import { QuizService } from "#api/modules/quiz/services/quiz.service";

@Module({
  imports: [PrismaModule, FilesModule],
  providers: [AssessmentAdminService, QuizService],
  exports: [AssessmentAdminService, QuizService],
})
export class AssessmentsModule {}
