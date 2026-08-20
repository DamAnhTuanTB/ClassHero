import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";

import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import { CurrentUser } from "#api/common/auth/current-user.decorator";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { Roles } from "#api/common/auth/roles.decorator";
import { RolesGuard } from "#api/common/auth/roles.guard";
import type { UploadedFileBuffer } from "#api/modules/files/types/uploaded-file.types";
import {
  ApplyStemFigureDraftDto,
  CompileStemFigureDraftDto,
} from "#api/modules/stem-figures/dto/stem-figure-revision.dto";
import {
  CreateNewStemFigureAiDto,
  EnsureStemFigureForBlockDto,
  RetryStemFigureDto,
  StemFigureMutationGuardDto,
  UseStemFigureSourceCropDto,
} from "#api/modules/stem-figures/dto/stem-figure-mutation-guard.dto";
import { StemFigureDraftService } from "#api/modules/stem-figures/services/stem-figure-draft.service";
import { StemFiguresService } from "#api/modules/stem-figures/services/stem-figures.service";

@ApiTags("admin-stem-figures")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/lessons/:lessonId/stem-figures")
export class AdminStemFiguresController {
  constructor(
    @Inject(StemFiguresService)
    private readonly figures: StemFiguresService,
    @Inject(StemFigureDraftService)
    private readonly drafts: StemFigureDraftService,
  ) {}

  @Post("blocks/ensure")
  @ApiOperation({ summary: "Ensure one reusable logical figure draft for a block" })
  ensureForBlock(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EnsureStemFigureForBlockDto,
  ) {
    return this.figures.ensureForBlock(lessonId, user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "List STEM figures for one lesson" })
  list(@Param("lessonId") lessonId: string) {
    return this.figures.listForAdmin(lessonId);
  }

  @Get(":figureId")
  @ApiOperation({ summary: "Get current and pending STEM figure revision" })
  get(@Param("lessonId") lessonId: string, @Param("figureId") figureId: string) {
    return this.figures.getForAdmin(lessonId, figureId);
  }

  @Delete(":figureId")
  @ApiOperation({ summary: "Soft-delete one logical figure and its Summary reference" })
  delete(
    @Param("lessonId") lessonId: string,
    @Param("figureId") figureId: string,
    @Body() dto: StemFigureMutationGuardDto,
  ) {
    return this.figures.delete(lessonId, figureId, dto);
  }

  @Post(":figureId/retry")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Retry from the latest immutable diagnostic batch" })
  retry(
    @Param("lessonId") lessonId: string,
    @Param("figureId") figureId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RetryStemFigureDto,
  ) {
    return this.figures.retry(lessonId, figureId, user.id, dto);
  }

  @Post(":figureId/create-new-ai")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Create a new AI TeX revision without old diagnostics" })
  createNewAi(
    @Param("lessonId") lessonId: string,
    @Param("figureId") figureId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateNewStemFigureAiDto,
  ) {
    return this.figures.createNewAi(lessonId, figureId, user.id, dto);
  }

  @Post(":figureId/create-new-ai/preview")
  @ApiOperation({ summary: "Preview the exact AI figure input without calling provider" })
  previewCreateNewAi(
    @Param("lessonId") lessonId: string,
    @Param("figureId") figureId: string,
    @Body() dto: CreateNewStemFigureAiDto,
  ) {
    return this.figures.previewCreateNewAi(lessonId, figureId, dto);
  }

  @Post(":figureId/replace-upload")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(FileInterceptor("file"))
  @ApiOperation({ summary: "Replace a figure with a normalized JPEG/PNG/WebP image" })
  replaceUpload(
    @Param("lessonId") lessonId: string,
    @Param("figureId") figureId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedFileBuffer | undefined,
    @Body() dto: StemFigureMutationGuardDto,
  ) {
    return this.figures.replaceUpload(lessonId, figureId, user.id, file, dto);
  }

  @Post(":figureId/use-source-crop")
  @ApiOperation({
    summary: "Promote one immutable textbook OCR crop as the official figure",
  })
  useSourceCrop(
    @Param("lessonId") lessonId: string,
    @Param("figureId") figureId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UseStemFigureSourceCropDto,
  ) {
    return this.figures.useSourceCrop(lessonId, figureId, user.id, dto);
  }

  @Post(":figureId/drafts/compile")
  @ApiOperation({ summary: "Compile a source draft to sanitized SVG without an AI call" })
  compileDraft(
    @Param("lessonId") lessonId: string,
    @Param("figureId") figureId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CompileStemFigureDraftDto,
  ) {
    return this.drafts.compile(lessonId, figureId, user.id, dto);
  }

  @Post(":figureId/drafts/apply")
  @ApiOperation({ summary: "Atomically apply a validated draft revision" })
  applyDraft(
    @Param("lessonId") lessonId: string,
    @Param("figureId") figureId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ApplyStemFigureDraftDto,
  ) {
    return this.drafts.apply(lessonId, figureId, user.id, dto);
  }
}
