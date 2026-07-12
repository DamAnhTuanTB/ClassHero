import { ApiProperty } from "@nestjs/swagger";
import { FilePurpose } from "@prisma/client";
import { IsEnum } from "class-validator";

export class UploadFileDto {
  @ApiProperty({ enum: FilePurpose, example: FilePurpose.EDITOR_IMAGE })
  @IsEnum(FilePurpose)
  purpose!: FilePurpose;
}
