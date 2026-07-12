import { ApiPropertyOptional } from "@nestjs/swagger";
import { PublishStatus } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";

export class UpdateChapterDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(200)
  orderIndex?: number;

  @ApiPropertyOptional({
    example: "Chương 1: Số hữu tỉ",
    minLength: 2,
    maxLength: 180,
  })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title?: string;

  @ApiPropertyOptional({ example: "Tổng quan số hữu tỉ", maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  overview?: string | null;

  @ApiPropertyOptional({
    example: { text: "Nhận biết số hữu tỉ; thực hiện phép tính cơ bản" },
    nullable: true,
  })
  @IsOptional()
  @IsObject()
  objectivesJson?: Record<string, unknown> | null;

  @ApiPropertyOptional({ enum: PublishStatus, example: PublishStatus.DRAFT })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsEnum(PublishStatus)
  status?: PublishStatus;
}
