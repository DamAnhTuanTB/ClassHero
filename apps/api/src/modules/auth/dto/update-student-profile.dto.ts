import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";

export class UpdateStudentProfileDto {
  @ApiPropertyOptional({ example: "An" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional({ example: "Hà Nội" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ example: "00000000-0000-0000-0000-000000000000" })
  @IsOptional()
  @IsUUID()
  avatarFileId?: string;
}
