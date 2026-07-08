import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class ForgotPasswordDto {
  @ApiProperty({
    description: "Username, email or phone number.",
    example: "student1@example.com",
  })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  identifier!: string;
}
