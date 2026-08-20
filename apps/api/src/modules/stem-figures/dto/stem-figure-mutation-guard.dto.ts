import { ApiProperty } from "@nestjs/swagger";
import {
  AI_REASONING_EFFORT_LEVELS,
  type AiReasoningEffort,
} from "@learning-path/shared";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Matches,
  MaxLength,
  MinLength,
  Min,
} from "class-validator";

export enum StemFigureReferenceImageMode {
  SOURCE_CROP_ONLY = "SOURCE_CROP_ONLY",
  CURRENT_ONLY = "CURRENT_ONLY",
  NONE = "NONE",
}

export class EnsureStemFigureForBlockDto {
  @ApiProperty({ example: "sections.0.blocks.0" })
  @IsString()
  @Matches(/^sections\.\d+\.blocks\.\d+$/u)
  blockPath!: string;
}

export class StemFigureMutationGuardDto {
  @ApiProperty({ nullable: true, required: false })
  @IsOptional()
  @IsUUID()
  baseCurrentRevisionId?: string | null;

  @ApiProperty({ nullable: true, required: false })
  @IsOptional()
  @IsUUID()
  basePendingRevisionId?: string | null;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  baseSourceVersion!: number;
}

export class RetryStemFigureDto extends StemFigureMutationGuardDto {
  @ApiProperty({ nullable: true, required: false })
  @IsOptional()
  @IsUUID()
  latestAttemptId?: string | null;

  @ApiProperty({ nullable: true, required: false })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  diagnosticBatchHash?: string | null;
}

export class CreateNewStemFigureAiDto extends StemFigureMutationGuardDto {
  @ApiProperty({ enum: StemFigureReferenceImageMode })
  @IsEnum(StemFigureReferenceImageMode)
  referenceImageMode!: StemFigureReferenceImageMode;

  @ApiProperty({ nullable: true, required: false, maxLength: 2_000 })
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  adminInstructions?: string | null;

  @ApiProperty({ nullable: true, required: false, maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  model?: string | null;

  @ApiProperty({ nullable: true, required: false, minimum: 0, maximum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1)
  temperature?: number | null;

  @ApiProperty({
    nullable: true,
    required: false,
    enum: AI_REASONING_EFFORT_LEVELS,
  })
  @IsOptional()
  @IsIn(AI_REASONING_EFFORT_LEVELS)
  reasoningEffort?: AiReasoningEffort | null;

  @ApiProperty({ nullable: true, required: false, maxLength: 30_000 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30_000)
  systemPrompt?: string | null;

  @ApiProperty({ nullable: true, required: false, maxLength: 30_000 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(30_000)
  userPrompt?: string | null;
}

export class UseStemFigureSourceCropDto extends StemFigureMutationGuardDto {
  @ApiProperty({ description: "Immutable reference snapshot hash shown to the admin" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  sourceSnapshotHash!: string;

  @ApiProperty({ description: "Exact OCR crop object key from that snapshot" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1_024)
  sourceObjectKey!: string;
}
