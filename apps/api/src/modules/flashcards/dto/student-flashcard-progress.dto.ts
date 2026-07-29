import { ApiProperty } from "@nestjs/swagger";
import { FavoriteTargetType } from "@prisma/client";
import { IsBoolean, IsEnum, IsUUID } from "class-validator";

export class UpdateStudentFlashcardProgressDto {
  @ApiProperty()
  @IsBoolean()
  isKnown!: boolean;
}

export class ToggleStudentFavoriteDto {
  @ApiProperty({ enum: FavoriteTargetType })
  @IsEnum(FavoriteTargetType)
  targetType!: FavoriteTargetType;

  @ApiProperty()
  @IsUUID()
  targetId!: string;

  @ApiProperty()
  @IsUUID()
  lessonId!: string;
}
