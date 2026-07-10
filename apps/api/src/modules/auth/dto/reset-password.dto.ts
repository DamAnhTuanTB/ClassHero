import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength, MinLength } from "class-validator";

export class ResetPasswordDto {
  @ApiProperty({ example: "reset-token" })
  @IsString()
  @IsNotEmpty()
  @MinLength(32)
  @MaxLength(512)
  token!: string;

  @ApiProperty({ example: "123456", minLength: 6, maxLength: 72 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(72)
  newPassword!: string;
}
