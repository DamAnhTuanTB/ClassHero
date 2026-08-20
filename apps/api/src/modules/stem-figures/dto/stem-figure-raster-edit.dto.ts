import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength } from "class-validator";

import { StemFigureMutationGuardDto } from "#api/modules/stem-figures/dto/stem-figure-mutation-guard.dto";

export class StemFigureRasterEditDto extends StemFigureMutationGuardDto {
  @ApiProperty({
    description: "JSON operation contract for the versioned raster cleanup pipeline",
    example: JSON.stringify({
      enhance: true,
      removeSimpleDetails: false,
      pipelineVersion: "TEXTBOOK_RASTER_CLEANUP_V2",
    }),
  })
  @IsString()
  @MaxLength(512)
  operations!: string;
}
