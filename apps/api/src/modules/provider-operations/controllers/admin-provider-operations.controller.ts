import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";

import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import { CurrentUser } from "#api/common/auth/current-user.decorator";
import { JwtAuthGuard } from "#api/common/auth/jwt-auth.guard";
import { Roles } from "#api/common/auth/roles.decorator";
import { RolesGuard } from "#api/common/auth/roles.guard";
import { CreatePriceVersionDto } from "#api/modules/provider-operations/dto/create-price-version.dto";
import {
  ProviderAuditQueryDto,
  ProviderUsageEventsQueryDto,
  ProviderUsageQueryDto,
} from "#api/modules/provider-operations/dto/provider-operations-query.dto";
import { CreateProviderCatalogItemDto } from "#api/modules/provider-operations/dto/create-provider-catalog-item.dto";
import { UpdateAiConfigurationsDto } from "#api/modules/provider-operations/dto/update-ai-configurations.dto";
import { UpdateOcrSettingsDto } from "#api/modules/provider-operations/dto/update-ocr-settings.dto";
import { UpdateProviderBudgetsDto } from "#api/modules/provider-operations/dto/update-provider-budgets.dto";
import { UpdateProviderCatalogItemDto } from "#api/modules/provider-operations/dto/update-provider-catalog-item.dto";
import { ProviderOperationsAdminService } from "#api/modules/provider-operations/services/provider-operations-admin.service";

@ApiTags("admin-provider-operations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller("admin/provider-operations")
export class AdminProviderOperationsController {
  constructor(
    @Inject(ProviderOperationsAdminService)
    private readonly service: ProviderOperationsAdminService,
  ) {}

  @Get("overview")
  @ApiOperation({ summary: "Get provider cost, reliability and budget overview" })
  overview() {
    return this.service.overview();
  }

  @Get("catalog")
  @ApiOperation({ summary: "List AI/OCR provider catalog and versioned prices" })
  catalog() {
    return this.service.catalog();
  }

  @Post("catalog")
  @ApiOperation({ summary: "Create a new AI/OCR model catalog item" })
  createCatalogItem(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProviderCatalogItemDto,
  ) {
    return this.service.createCatalogItem(user.id, dto);
  }

  @Put("catalog/:id")
  @ApiOperation({ summary: "Update an AI/OCR model catalog item" })
  updateCatalogItem(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProviderCatalogItemDto,
  ) {
    return this.service.updateCatalogItem(id, user.id, dto);
  }

  @Delete("catalog/:id")
  @ApiOperation({ summary: "Delete an AI/OCR model catalog item" })
  deleteCatalogItem(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.deleteCatalogItem(id, user.id);
  }

  @Post("catalog/:id/price-versions")
  @ApiOperation({ summary: "Create an effective-dated provider price version" })
  createPriceVersion(
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePriceVersionDto,
  ) {
    return this.service.createPriceVersion(id, user.id, dto);
  }

  @Get("ai-configurations")
  @ApiOperation({ summary: "Get model routing for AI generation features" })
  aiConfigurations() {
    return this.service.aiConfigurations();
  }

  @Put("ai-configurations")
  @ApiOperation({ summary: "Update model routing with optimistic concurrency" })
  updateAiConfigurations(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAiConfigurationsDto,
  ) {
    return this.service.updateAiConfigurations(user.id, dto);
  }

  @Get("ocr-settings")
  @ApiOperation({ summary: "Get OCR provider, cache and accounting settings" })
  ocrSettings() {
    return this.service.ocrSettings();
  }

  @Put("ocr-settings")
  @ApiOperation({ summary: "Update provider accounting settings" })
  updateOcrSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOcrSettingsDto,
  ) {
    return this.service.updateOcrSettings(user.id, dto);
  }

  @Get("budgets")
  @ApiOperation({ summary: "Get monthly provider budgets and current usage" })
  budgets() {
    return this.service.listBudgets();
  }

  @Put("budgets")
  @ApiOperation({ summary: "Update monthly provider budgets" })
  updateBudgets(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProviderBudgetsDto,
  ) {
    return this.service.updateBudgets(user.id, dto);
  }

  @Get("usage/timeline")
  @ApiOperation({ summary: "Get provider usage grouped by day, week or month" })
  timeline(@Query() query: ProviderUsageQueryDto) {
    return this.service.timeline(query);
  }

  @Get("usage/breakdown")
  @ApiOperation({ summary: "Get provider usage breakdown by model and feature" })
  breakdown(@Query() query: ProviderUsageQueryDto) {
    return this.service.breakdown(query);
  }

  @Get("usage/events")
  @ApiOperation({ summary: "List paginated provider usage events" })
  events(@Query() query: ProviderUsageEventsQueryDto) {
    return this.service.events(query);
  }

  @Get("audit-history")
  @ApiOperation({ summary: "Get recent provider configuration audit history" })
  auditHistory(@Query() query: ProviderAuditQueryDto) {
    return this.service.auditHistory(query);
  }
}
