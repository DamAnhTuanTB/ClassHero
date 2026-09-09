import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class AttachFlashcardSolutionFigureUploadDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID("4")
  fileId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(1_000)
  altText!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  caption?: string;
}
