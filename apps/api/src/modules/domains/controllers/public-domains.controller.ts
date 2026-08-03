import { Controller, Get, Inject } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { DomainsService } from "#api/modules/domains/services/domains.service";

@ApiTags("course-catalog")
@Controller("catalog")
export class PublicDomainsController {
  constructor(@Inject(DomainsService) private readonly domainsService: DomainsService) {}

  @Get("course-options")
  @ApiOperation({ summary: "List public course domain and target audience options" })
  courseOptions() {
    return this.domainsService.catalogOptions();
  }
}
