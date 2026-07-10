import { ApiProperty } from "@nestjs/swagger";
import {
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export class ForgotPasswordDto {
  @ApiProperty({
    description: "Username, email or phone number.",
    example: "student1",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  identifier!: string;

  @ApiProperty({
    description: "Full name shown on the approved recovery UI.",
    example: "Nguyễn Văn An",
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({
    description: "Student grade shown on the approved recovery UI.",
    example: 7,
  })
  @IsDefined()
  @IsInt()
  @Min(3)
  @Max(12)
  grade!: number;
}
