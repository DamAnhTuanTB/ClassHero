import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({
    description: "Username, email or phone number.",
    example: "student1",
  })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  identifier!: string;

  @ApiProperty({ example: "Password123!" })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;
}
