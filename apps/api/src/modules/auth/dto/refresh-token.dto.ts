import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class RefreshTokenDto {
  @ApiProperty({ example: "refresh-token" })
  @IsString()
  @MinLength(32)
  @MaxLength(512)
  refreshToken!: string;
}
