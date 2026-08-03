import { ApiProperty } from "@nestjs/swagger";
import { ReviewStatus } from "@prisma/client";
import { IsEnum } from "class-validator";

export class ReviewContentSetDto {
  @ApiProperty({ enum: ReviewStatus, example: ReviewStatus.APPROVED })
  @IsEnum(ReviewStatus)
  reviewStatus!: ReviewStatus;
}
