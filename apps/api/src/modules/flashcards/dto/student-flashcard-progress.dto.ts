import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { FavoriteTargetType } from "@prisma/client";
import { IsBoolean, IsEnum, IsOptional, IsUUID } from "class-validator";

export class UpdateStudentFlashcardProgressDto {
  @ApiProperty()
  @IsBoolean()
  isKnown!: boolean;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}

export class StartStudentFlashcardSessionDto {
  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  resumeExistingProgress?: boolean;

  @ApiPropertyOptional({ format: "uuid", description: "Reset an existing session instead of creating a new one" })
  @IsOptional()
  @IsUUID()
  restartSessionId?: string;
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
