import { Module } from "@nestjs/common";

import { PrismaModule } from "#api/common/prisma/prisma.module";
import { AuthModule } from "#api/modules/auth/auth.module";
import { FilesModule } from "#api/modules/files/files.module";
import { JobsModule } from "#api/modules/jobs/jobs.module";
import { AdminQuizFiguresController } from "#api/modules/quiz-figures/controllers/admin-quiz-figures.controller";
import { QuizFigureArtifactService } from "#api/modules/quiz-figures/services/quiz-figure-artifact.service";
import { QuizFigureJobService } from "#api/modules/quiz-figures/services/quiz-figure-job.service";
import { QuizFiguresService } from "#api/modules/quiz-figures/services/quiz-figures.service";
import { QuizTexRendererClientService } from "#api/modules/quiz-figures/services/quiz-tex-renderer-client.service";

@Module({
  imports: [PrismaModule, AuthModule, FilesModule, JobsModule],
  controllers: [AdminQuizFiguresController],
  providers: [
    QuizFigureArtifactService,
    QuizFigureJobService,
    QuizFiguresService,
    QuizTexRendererClientService,
  ],
  exports: [
    QuizFigureArtifactService,
    QuizFigureJobService,
    QuizFiguresService,
    QuizTexRendererClientService,
  ],
})
export class QuizFiguresModule {}
