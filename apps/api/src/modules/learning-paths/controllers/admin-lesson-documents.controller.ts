import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
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
import { CreateLessonDocumentDto } from "#api/modules/learning-paths/dto/create-lesson-document.dto";
import { ReplacePrimaryLessonDocumentDto } from "#api/modules/learning-paths/dto/replace-primary-lesson-document.dto";
import { LessonDocumentsService } from "#api/modules/learning-paths/services/lesson-documents.service";

@ApiTags("admin-lesson-documents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/lessons/:lessonId")
export class AdminLessonDocumentsController {
  constructor(
    @Inject(LessonDocumentsService)
    private readonly lessonDocumentsService: LessonDocumentsService,
  ) {}

  @Get("documents")
  @ApiOperation({ summary: "List documents attached to one lesson" })
  listDocuments(@Param("lessonId") lessonId: string) {
    return this.lessonDocumentsService.listForLesson(lessonId);
  }

  @Post("primary-document/replace")
  @ApiOperation({ summary: "Replace the primary document for one lesson" })
  replacePrimaryDocument(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReplacePrimaryLessonDocumentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.lessonDocumentsService.replacePrimaryDocument(
      lessonId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Post("documents")
  @ApiOperation({ summary: "Create a supplemental document for one lesson" })
  createSupplementalDocument(
    @Param("lessonId") lessonId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateLessonDocumentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.lessonDocumentsService.createSupplementalDocument(
      lessonId,
      user.id,
      dto,
      getRequestContext(request),
    );
  }

  @Delete("documents/:documentId")
  @ApiOperation({ summary: "Delete a supplemental lesson document" })
  deleteSupplementalDocument(
    @Param("lessonId") lessonId: string,
    @Param("documentId") documentId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.lessonDocumentsService.deleteSupplementalDocument(
      lessonId,
      documentId,
      user.id,
      getRequestContext(request),
    );
  }
}

@ApiTags("admin-lesson-documents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/learning-paths/:learningPathId")
export class AdminLearningPathLessonDocumentsController {
  constructor(
    @Inject(LessonDocumentsService)
    private readonly lessonDocumentsService: LessonDocumentsService,
  ) {}

  @Get("lesson-documents")
  @ApiOperation({
    summary: "List active lesson documents in one learning path",
  })
  listByLearningPath(@Param("learningPathId") learningPathId: string) {
    return this.lessonDocumentsService.listForLearningPath(learningPathId);
  }
}
