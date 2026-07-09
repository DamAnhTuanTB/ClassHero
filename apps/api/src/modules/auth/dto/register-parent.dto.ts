import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, Matches, MaxLength, MinLength } from "class-validator";

const phonePattern = /^\+?[0-9]{9,15}$/;

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

  @ApiProperty({ example: "123456", minLength: 6, maxLength: 72 })
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ example: "Phụ huynh A" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;
}
