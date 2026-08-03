import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PublishStatus } from "@prisma/client";
import {
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateChapterDto {
  @ApiProperty({ example: "Chương 1: Số hữu tỉ", minLength: 2, maxLength: 180 })
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title!: string;

  @ApiPropertyOptional({ example: "Tổng quan số hữu tỉ", maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  overview?: string;

  @ApiPropertyOptional({
    example: { text: "Nhận biết số hữu tỉ; thực hiện phép tính cơ bản" },
  })
  @IsOptional()
  @IsObject()
  objectivesJson?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: PublishStatus, example: PublishStatus.DRAFT })
  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;
}
