import { ApiProperty } from "@nestjs/swagger";
import { Gender } from "@prisma/client";
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

const phonePattern = /^\+?[0-9]{9,15}$/;
const usernamePattern = /^[a-zA-Z0-9_]{3,32}$/;
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/;

export class RegisterStudentDto {
  @ApiProperty({ example: "student1@example.com" })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: "0900000001" })
  @IsString()
  @Matches(phonePattern, {
    message: "phone must contain 9-15 digits and may start with +",
  })
  phone!: string;

  @ApiProperty({ example: "student1" })
  @IsString()
  @Matches(usernamePattern, {
    message: "username must be 3-32 letters, numbers or underscores",
  })
  username!: string;

  @ApiProperty({ example: "Password123!" })
  @IsString()
  @Matches(passwordPattern, {
    message:
      "password must be 8-72 characters and include uppercase, lowercase, number and symbol",
  })
  password!: string;

  @ApiProperty({ example: "Nguyễn Văn A" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: 7, minimum: 1, maximum: 12 })
  @IsInt()
  @Min(1)
  @Max(12)
  grade!: number;

  @ApiProperty({ enum: Gender, example: Gender.MALE })
  @IsEnum(Gender)
  gender!: Gender;

  @ApiProperty({ example: "2012-01-01" })
  @IsISO8601({ strict: true })
  dateOfBirth!: string;
}
