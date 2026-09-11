import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, Max, Min } from "class-validator";

export class SaveStudentVideoProgressDto {
  @ApiProperty({
    description: "Vị trí theo timeline học sinh nhìn thấy, tính bằng giây",
    minimum: 0,
    maximum: 604_800,
  })
  @IsNumber({ allowInfinity: false, allowNaN: false, maxDecimalPlaces: 3 })
  @Min(0)
  @Max(604_800)
  positionSeconds!: number;
}
