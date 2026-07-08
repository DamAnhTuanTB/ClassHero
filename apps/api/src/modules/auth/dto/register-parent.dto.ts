import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Matches, MaxLength, MinLength } from "class-validator";

const phonePattern = /^\+?[0-9]{9,15}$/;
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/;

export class RegisterParentDto {
  @ApiProperty({ example: "parent1@example.com" })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ example: "0910000001" })
  @IsString()
  @Matches(phonePattern, {
    message: "phone must contain 9-15 digits and may start with +",
  })
  phone!: string;

  @ApiProperty({ example: "Password123!" })
  @IsString()
  @Matches(passwordPattern, {
    message:
      "password must be 8-72 characters and include uppercase, lowercase, number and symbol",
  })
  password!: string;

  @ApiProperty({ example: "Phụ huynh A" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;
}
