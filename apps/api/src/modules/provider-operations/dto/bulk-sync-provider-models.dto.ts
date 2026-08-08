import { Type } from "class-transformer";
import { IsArray, ValidateNested } from "class-validator";
import { CreateProviderCatalogItemDto } from "#api/modules/provider-operations/dto/create-provider-catalog-item.dto";

export class BulkSyncProviderModelsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProviderCatalogItemDto)
  items!: CreateProviderCatalogItemDto[];
}
