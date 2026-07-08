import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches, MaxLength, MinLength } from "class-validator";

const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/;

export class ResetPasswordDto {
  @ApiProperty({ example: "reset-token" })
  @IsString()
  @MinLength(32)
  @MaxLength(512)
  token!: string;

  @ApiProperty({ example: "NewPassword123!" })
  @IsString()
  @Matches(passwordPattern, {
    message:
      "newPassword must be 8-72 characters and include uppercase, lowercase, number and symbol",
  })
  newPassword!: string;
}
