import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

export class LessonPageRangeDto {
  @ApiProperty({ example: "00000000-0000-0000-0000-000000000000" })
  @IsUUID()
  lessonId!: string;

  @ApiProperty({ example: 20, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageStart!: number;

  @ApiProperty({ example: 22, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageEnd!: number;
}

export class UpdateLessonPageRangesDto {
  @ApiProperty({ type: [LessonPageRangeDto] })
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => LessonPageRangeDto)
  ranges!: LessonPageRangeDto[];
}
