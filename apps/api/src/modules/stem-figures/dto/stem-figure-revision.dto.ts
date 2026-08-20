import { ApiProperty } from "@nestjs/swagger";
import {
  STEM_FIGURE_MAX_ALT_TEXT_CHARACTERS,
  STEM_FIGURE_MAX_CAPTION_CHARACTERS,
  STEM_FIGURE_MAX_SOURCE_CHARACTERS,
} from "@learning-path/shared";
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class StemFigureRevisionGuardDto {
  @ApiProperty({ nullable: true, required: false })
  @IsOptional()
  @IsUUID()
  baseRevisionId?: string | null;
}

export class CompileStemFigureDraftDto extends StemFigureRevisionGuardDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  sourceVersion!: number;

  @ApiProperty()
  @IsString()
  @MinLength(20)
  @MaxLength(STEM_FIGURE_MAX_SOURCE_CHARACTERS)
  latexSource!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(STEM_FIGURE_MAX_ALT_TEXT_CHARACTERS)
  altText!: string;

  @ApiProperty({ nullable: true, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(STEM_FIGURE_MAX_CAPTION_CHARACTERS)
  caption?: string | null;
}

export class ApplyStemFigureDraftDto extends StemFigureRevisionGuardDto {
  @ApiProperty()
  @IsUUID()
  revisionId!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  sourceVersion!: number;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(STEM_FIGURE_MAX_ALT_TEXT_CHARACTERS)
  altText!: string;

  @ApiProperty({ nullable: true, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(STEM_FIGURE_MAX_CAPTION_CHARACTERS)
  caption?: string | null;
}
