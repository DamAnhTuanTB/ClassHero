import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";

import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { AuthModule } from "#api/modules/auth/auth.module";
import { FilesModule } from "#api/modules/files/files.module";
import { JobsModule } from "#api/modules/jobs/jobs.module";
import { AdminStemFiguresController } from "#api/modules/stem-figures/controllers/admin-stem-figures.controller";
import { StemFigureJobService } from "#api/modules/stem-figures/services/stem-figure-job.service";
import { StemFigureArtifactService } from "#api/modules/stem-figures/services/stem-figure-artifact.service";
import { StemFigureDraftService } from "#api/modules/stem-figures/services/stem-figure-draft.service";
import { StemFigureRepairService } from "#api/modules/stem-figures/services/stem-figure-repair.service";
import { StemFiguresService } from "#api/modules/stem-figures/services/stem-figures.service";
import { SvgValidatorService } from "#api/modules/stem-figures/services/svg-validator.service";
import { TexRendererClientService } from "#api/modules/stem-figures/services/tex-renderer-client.service";
import { FigureReferenceResolverService } from "#api/modules/stem-figures/services/figure-reference-resolver.service";

@Module({
  imports: [AuthModule, JwtModule.register({}), FilesModule, JobsModule],
  controllers: [AdminStemFiguresController],
  providers: [
    StemFigureJobService,
    StemFigureArtifactService,
    StemFigureDraftService,
    StemFigureRepairService,
    StemFiguresService,
    SvgValidatorService,
    TexRendererClientService,
    FigureReferenceResolverService,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    StemFigureJobService,
    StemFigureArtifactService,
    StemFigureDraftService,
    StemFigureRepairService,
    StemFiguresService,
    SvgValidatorService,
    TexRendererClientService,
    FigureReferenceResolverService,
  ],
})
export class StemFiguresModule {}
