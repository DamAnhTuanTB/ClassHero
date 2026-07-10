import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

const phonePattern = /^\+?[0-9]{9,15}$/;

export class RegisterParentDto {
  @ApiPropertyOptional({ example: "parent1@example.com" })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiProperty({ example: "0910000001" })
  @IsString()
  @IsNotEmpty()
  @Matches(phonePattern, {
    message: "phone must contain 9-15 digits and may start with +",
  })
  phone!: string;

  @ApiProperty({ example: "123456", minLength: 6, maxLength: 72 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: "Phụ huynh A" })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;
}
