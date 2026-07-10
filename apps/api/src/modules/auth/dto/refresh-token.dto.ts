import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class RefreshTokenDto {
  @ApiProperty({ example: "refresh-token" })
  @IsString()
  @IsNotEmpty()
  @MinLength(32)
  @MaxLength(512)
  refreshToken!: string;
}
