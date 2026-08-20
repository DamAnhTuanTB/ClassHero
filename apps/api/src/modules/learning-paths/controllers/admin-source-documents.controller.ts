import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Patch,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from "#api/common/auth/authenticated-request";
import { getRequestContext } from "#api/common/api/request-context";
import { CurrentUser } from "#api/common/auth/current-user.decorator";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { Roles } from "#api/common/auth/roles.decorator";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { CreateSourceDocumentDto } from "#api/modules/learning-paths/dto/create-source-document.dto";
import { UpdateLessonPageRangesDto } from "#api/modules/learning-paths/dto/update-lesson-page-ranges.dto";
import { ConfirmPrintedPageDto } from "#api/modules/learning-paths/dto/confirm-printed-page.dto";
import { PromoteSearchablePdfDto } from "#api/modules/learning-paths/dto/promote-searchable-pdf.dto";
import { ValidateSearchablePdfDto } from "#api/modules/learning-paths/dto/validate-searchable-pdf.dto";
import { SourceDocumentsService } from "#api/modules/learning-paths/services/source-documents.service";

@ApiTags("admin-source-documents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller()
export class AdminSourceDocumentsController {
  constructor(
    @Inject(SourceDocumentsService)
    private readonly sourceDocumentsService: SourceDocumentsService,
  ) {}

  @Post("admin/learning-paths/:learningPathId/source-documents")
  @ApiOperation({ summary: "Create a source document for one learning path" })
  create(
    @Param("learningPathId") learningPathId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSourceDocumentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.sourceDocumentsService.createForLearningPath(
      learningPathId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Get("admin/learning-paths/:learningPathId/source-documents")
  @ApiOperation({ summary: "List source documents in one learning path" })
  listByLearningPath(@Param("learningPathId") learningPathId: string) {
    return this.sourceDocumentsService.listForLearningPath(learningPathId);
  }

  @Post("admin/source-documents/:sourceDocumentId/process")
  @ApiOperation({ summary: "Request source document OCR processing" })
  process(
    @Param("sourceDocumentId") sourceDocumentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
    @Body() body?: { forceNewOcr?: boolean },
  ) {
    return this.sourceDocumentsService.requestProcessing(
      sourceDocumentId,
      user.id,
      getRequestContext(request),
      { forceNewOcr: body?.forceNewOcr },
    );
  }

  @Get("admin/source-documents/:sourceDocumentId/cache-status")
  @ApiOperation({ summary: "Check source document OCR cache status" })
  getCacheStatus(@Param("sourceDocumentId") sourceDocumentId: string) {
    return this.sourceDocumentsService.getCacheStatus(sourceDocumentId);
  }

  @Post("admin/source-documents/:sourceDocumentId/searchable-pdf/validate")
  @ApiOperation({ summary: "Validate a searchable PDF against the canonical scan" })
  validateSearchablePdf(
    @Param("sourceDocumentId") sourceDocumentId: string,
    @Body() dto: ValidateSearchablePdfDto,
  ) {
    return this.sourceDocumentsService.validateSearchablePdf(sourceDocumentId, dto);
  }

  @Get(
    "admin/source-documents/:sourceDocumentId/searchable-pdf/validation/:validationId",
  )
  @ApiOperation({ summary: "Get a searchable PDF equivalence report" })
  getSearchablePdfValidation(
    @Param("sourceDocumentId") sourceDocumentId: string,
    @Param("validationId") validationId: string,
  ) {
    return this.sourceDocumentsService.getSearchablePdfValidation(
      sourceDocumentId,
      validationId,
    );
  }

  @Post("admin/source-documents/:sourceDocumentId/searchable-pdf/promote")
  @ApiOperation({ summary: "Promote a validated searchable PDF atomically" })
  promoteSearchablePdf(
    @Param("sourceDocumentId") sourceDocumentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PromoteSearchablePdfDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.sourceDocumentsService.promoteSearchablePdf(
      sourceDocumentId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Delete("admin/source-documents/:sourceDocumentId")
  @ApiOperation({ summary: "Delete an unused source document" })
  remove(
    @Param("sourceDocumentId") sourceDocumentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.sourceDocumentsService.deleteSourceDocument(
      sourceDocumentId,
      user.id,
      getRequestContext(request),
    );
  }

  @Get("admin/source-documents/:sourceDocumentId/pages")
  @ApiOperation({ summary: "List extracted pages for one source document" })
  listPages(@Param("sourceDocumentId") sourceDocumentId: string) {
    return this.sourceDocumentsService.listPages(sourceDocumentId);
  }

  @Put("admin/source-documents/:sourceDocumentId/lesson-page-ranges")
  @ApiOperation({ summary: "Save lesson page ranges for one source document" })
  updateLessonPageRanges(
    @Param("sourceDocumentId") sourceDocumentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateLessonPageRangesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.sourceDocumentsService.updateLessonPageRanges(
      sourceDocumentId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Get("admin/source-documents/:sourceDocumentId/ocr-html")
  @ApiOperation({ summary: "Get rendered HTML from Mathpix OCR output" })
  getOcrHtml(@Param("sourceDocumentId") sourceDocumentId: string) {
    return this.sourceDocumentsService.getOcrHtml(sourceDocumentId);
  }

  @Patch(
    "admin/learning-paths/source-documents/:sourceDocumentId/pages/:pageId/confirm-printed-page",
  )
  @ApiOperation({ summary: "Xác nhận số trang in cho trang bị lỗi" })
  confirmPrintedPage(
    @Param("sourceDocumentId") sourceDocumentId: string,
    @Param("pageId") pageId: string,
    @Body() dto: ConfirmPrintedPageDto,
  ) {
    return this.sourceDocumentsService.confirmPrintedPage(sourceDocumentId, pageId, dto);
  }
}
