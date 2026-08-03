import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { Roles } from "#api/common/auth/roles.decorator";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { CreateDomainDto } from "#api/modules/domains/dto/create-domain.dto";
import { ReorderDomainsDto } from "#api/modules/domains/dto/reorder-domains.dto";
import { UpdateDomainDto } from "#api/modules/domains/dto/update-domain.dto";
import { DomainsService } from "#api/modules/domains/services/domains.service";

@ApiTags("admin-domains")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/domains")
export class AdminDomainsController {
  constructor(@Inject(DomainsService) private readonly domainsService: DomainsService) {}

  @Get("catalog-options")
  @ApiOperation({ summary: "List domain and target audience options" })
  catalogOptions() {
    return this.domainsService.catalogOptions();
  }

  @Get()
  @ApiOperation({ summary: "List course domains" })
  list() {
    return this.domainsService.list();
  }

  @Post()
  @ApiOperation({ summary: "Create course domain" })
  create(@Body() dto: CreateDomainDto) {
    return this.domainsService.create(dto);
  }

  @Patch("reorder")
  @ApiOperation({ summary: "Reorder course domains" })
  reorder(@Body() dto: ReorderDomainsDto) {
    return this.domainsService.reorder(dto);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update course domain" })
  update(@Param("id") id: string, @Body() dto: UpdateDomainDto) {
    return this.domainsService.update(id, dto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete unused course domain" })
  remove(@Param("id") id: string) {
    return this.domainsService.remove(id);
  }
}
