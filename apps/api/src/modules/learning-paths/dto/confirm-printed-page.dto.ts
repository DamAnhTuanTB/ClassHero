import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class ConfirmPrintedPageDto {
  @ApiPropertyOptional({
    description: "Nhãn trang in (hiển thị)",
    example: "iv",
  })
  @IsOptional()
  @IsString()
  printedPageLabel?: string | null;

  @ApiPropertyOptional({
    description: "Số trang in (số thực tế)",
    example: 4,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  printedPageNumber?: number | null;
}
