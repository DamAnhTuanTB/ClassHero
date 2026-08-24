import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { QuizFigureRole } from "@prisma/client";
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class AttachQuizFigureUploadDto {
  @ApiProperty({ enum: QuizFigureRole })
  @IsEnum(QuizFigureRole)
  role!: QuizFigureRole;

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
