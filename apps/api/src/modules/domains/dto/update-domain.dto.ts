import { PartialType } from "@nestjs/swagger";
import { CreateDomainDto } from "#api/modules/domains/dto/create-domain.dto";

export class UpdateDomainDto extends PartialType(CreateDomainDto) {}
