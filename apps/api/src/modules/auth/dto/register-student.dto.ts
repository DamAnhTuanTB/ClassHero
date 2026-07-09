import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Gender } from "@prisma/client";
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const phonePattern = /^\+?[0-9]{9,15}$/;
const usernamePattern = /^[a-zA-Z0-9_]{3,32}$/;
const currentYear = new Date().getFullYear();
const minStudentBirthYear = currentYear - 18;
const maxStudentBirthYear = currentYear - 8;

export class RegisterStudentDto {
  @ApiPropertyOptional({ example: "student1@example.com" })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: "0900000001" })
  @IsOptional()
  @IsString()
  @Matches(phonePattern, {
    message: "phone must contain 9-15 digits and may start with +",
  })
  phone?: string;

  @ApiProperty({ example: "student1" })
  @IsString()
  @Matches(usernamePattern, {
    message: "username must be 3-32 letters, numbers or underscores",
  })
  username!: string;

  @ApiProperty({ example: "123456", minLength: 6, maxLength: 72 })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: "Nguyễn Văn A" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: 7, minimum: 3, maximum: 12 })
  @IsInt()
  @Min(3)
  @Max(12)
  grade!: number;

  @ApiProperty({
    example: 2012,
    minimum: minStudentBirthYear,
    maximum: maxStudentBirthYear,
  })
  @IsInt()
  @Min(minStudentBirthYear)
  @Max(maxStudentBirthYear)
  birthYear!: number;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiProperty({ example: "Hà Nội" })
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  address!: string;
}
