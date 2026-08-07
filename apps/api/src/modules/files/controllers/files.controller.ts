import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import { CurrentUser } from "#api/common/auth/current-user.decorator";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { UploadFileDto } from "#api/modules/files/dto/upload-file.dto";
import { FilesService } from "#api/modules/files/services/files.service";
import type { UploadedFileBuffer } from "#api/modules/files/types/uploaded-file.types";

@ApiTags("files")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("files")
export class FilesController {
  constructor(
    @Inject(FilesService)
    private readonly filesService: FilesService,
  ) {}

  @Post("upload")
  @ApiOperation({ summary: "Upload a file to object storage" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        purpose: {
          type: "string",
          example: "EDITOR_IMAGE",
        },
        file: {
          type: "string",
          format: "binary",
        },
      },
      required: ["purpose", "file"],
    },
  })
  @UseInterceptors(
    FileInterceptor("file"),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadFileDto,
    @UploadedFile() file: UploadedFileBuffer | undefined,
  ) {
    return this.filesService.uploadFile({
      actor: user,
      file,
      purpose: dto.purpose,
    });
  }

  @Get(":fileId/signed-url")
  @ApiOperation({ summary: "Get a short-lived signed file URL" })
  getSignedUrl(@Param("fileId") fileId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.filesService.getSignedUrl(fileId, user);
  }
}
