import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AiGenerationType,
  Prisma,
  ProviderBudgetScope,
  ProviderCatalogCategory,
  ProviderCatalogStatus,
} from "@prisma/client";

import { PrismaService } from "#api/common/prisma/prisma.service";
import {
  throwBadRequest,
  throwConflict,
  throwNotFound,
} from "#api/common/errors/api-exception";
import type { EnvConfig } from "#api/config/env.validation";
import type { CreatePriceVersionDto } from "#api/modules/provider-operations/dto/create-price-version.dto";
import type {
  ProviderAuditQueryDto,
  ProviderUsageEventsQueryDto,
  ProviderUsageQueryDto,
} from "#api/modules/provider-operations/dto/provider-operations-query.dto";
import { 
  CreateProviderCatalogItemDto,
  AiConfigurationFeature
} from "#api/modules/provider-operations/dto/create-provider-catalog-item.dto";
import type { UpdateProviderCatalogItemDto } from "#api/modules/provider-operations/dto/update-provider-catalog-item.dto";
import { ProviderUsageGranularity } from "#api/modules/provider-operations/dto/provider-operations-query.dto";
import type { UpdateAiConfigurationsDto } from "#api/modules/provider-operations/dto/update-ai-configurations.dto";
import type { UpdateOcrSettingsDto } from "#api/modules/provider-operations/dto/update-ocr-settings.dto";
import type { UpdateProviderBudgetsDto } from "#api/modules/provider-operations/dto/update-provider-budgets.dto";
import { AiModelRoutingService } from "#api/modules/provider-operations/services/ai-model-routing.service";
import { ProviderUsageService } from "#api/modules/provider-operations/services/provider-usage.service";
import { lockProviderBudgetScopes } from "#api/modules/provider-operations/utils/provider-budget-lock";
import { getProviderBudgetPeriod } from "#api/modules/provider-operations/utils/provider-budget-period";

const MANAGED_AI_FEATURES = [
  AiGenerationType.SUMMARY,
  AiGenerationType.QUIZ,
  AiGenerationType.FLASHCARD,
  AiGenerationType.TEST,
] as const;

@Injectable()
export class ProviderOperationsAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AiModelRoutingService)
    private readonly routing: AiModelRoutingService,
    @Inject(ProviderUsageService)
    private readonly usage: ProviderUsageService,
    private readonly configService: ConfigService<EnvConfig, true>,
  ) {}

  async overview() {
    await this.ensureDefaults();
    const monthStart = startOfMonthInHoChiMinh(new Date());
    const [cost, successCount, failedCount, budgets, settings, latestEvent] =
      await Promise.all([
        this.prisma.providerUsageEvent.aggregate({
          where: { createdAt: { gte: monthStart } },
          _sum: { costVnd: true, estimatedSavedCostVnd: true },
          _count: { _all: true },
        }),
        this.prisma.providerUsageEvent.count({
          where: { createdAt: { gte: monthStart }, status: "SUCCEEDED" },
        }),
        this.prisma.providerUsageEvent.count({
          where: { createdAt: { gte: monthStart }, status: "FAILED" },
        }),
        this.listBudgets(),
        this.getAccountingSettings(),
        this.prisma.providerUsageEvent.findFirst({
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        }),
      ]);

    return {
      period: { from: monthStart, to: new Date() },
      totalCostVnd: cost._sum.costVnd ?? 0,
      savedCostVnd: cost._sum.estimatedSavedCostVnd ?? 0,
      calls: cost._count._all,
      successCount,
      failedCount,
      successRate:
        successCount + failedCount === 0
          ? 0
          : Math.round((successCount / (successCount + failedCount)) * 10_000) / 100,
      budgets,
      accounting: settings,
      latestUsageAt: latestEvent?.createdAt ?? null,
    };
  }

  async catalog() {
    const items = await this.prisma.providerCatalogItem.findMany({
      include: {
        priceVersions: {
          orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
          include: { rates: { orderBy: [{ metric: "asc" }, { tierFrom: "asc" }] } },
        },
      },
      orderBy: [{ category: "asc" }, { provider: "asc" }, { displayName: "asc" }],
    });

    return items.map((item) => ({
      id: item.id,
      category: item.category,
      provider: item.provider,
      externalKey: item.externalKey,
      displayName: item.displayName,
      capabilities: item.capabilitiesJson,
      status: item.status,
      deprecationNote: item.deprecationNote,
      credentialConfigured: this.routing.isCredentialConfigured(item.provider),
      updatedAt: item.updatedAt,
      priceVersions: item.priceVersions.map(serializePriceVersion),
    }));
  }

  async createCatalogItem(actorUserId: string, dto: CreateProviderCatalogItemDto) {
    const existing = await this.prisma.providerCatalogItem.findUnique({
      where: {
        category_provider_externalKey: {
          category: dto.category,
          provider: dto.provider.toUpperCase(),
          externalKey: dto.externalKey,
        },
      },
    });
    if (existing) {
      throwConflict("PROVIDER_CATALOG_ITEM_EXISTS", "Model này đã tồn tại trong hệ thống.");
    }
    
    // Add default capabilities based on category
    const defaultCapabilities = dto.category === ProviderCatalogCategory.AI_MODEL 
      ? [...MANAGED_AI_FEATURES] 
      : [];
      
    // Include the aiConfiguration if provided
    let capabilitiesJson: Record<string, any> = { features: defaultCapabilities };
    if (dto.aiConfiguration) {
      capabilitiesJson.aiConfiguration = dto.aiConfiguration;
      if (dto.aiConfiguration === AiConfigurationFeature.REASONING_EFFORT && dto.reasoningEffortLevels?.length) {
        capabilitiesJson.reasoningEffortLevels = dto.reasoningEffortLevels;
      }
    }

    const item = await this.prisma.providerCatalogItem.create({
      data: {
        category: dto.category,
        provider: dto.provider.toUpperCase(),
        externalKey: dto.externalKey,
        displayName: dto.displayName,
        capabilitiesJson,
        priceVersions: dto.initialPrice
          ? {
              create: {
                billingMode: dto.initialPrice.billingMode,
                sourceUrl: dto.initialPrice.sourceUrl,
                effectiveFrom: new Date(dto.initialPrice.effectiveFrom),
                createdByUserId: actorUserId,
                rates: {
                  create: dto.initialPrice.rates.map((rate) => ({
                    metric: rate.metric,
                    unitSize: rate.unitSize,
                    unitPriceUsd: rate.unitPriceUsd,
                    tierFrom: rate.tierFrom,
                    tierTo: rate.tierTo,
                  })),
                },
              },
            }
          : undefined,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: "PROVIDER_CATALOG_ITEM_CREATED",
        entityType: "ProviderCatalogItem",
        entityId: item.id,
        after: toJson(item),
      },
    });

    return item;
  }

  async updateCatalogItem(id: string, actorUserId: string, dto: UpdateProviderCatalogItemDto) {
    const item = await this.prisma.providerCatalogItem.findUnique({
      where: { id },
    });
    if (!item) {
      throwNotFound("PROVIDER_CATALOG_ITEM_NOT_FOUND", "Không tìm thấy model.");
    }
    
    let capabilitiesJson = item.capabilitiesJson as Record<string, any> | null;
    if (dto.aiConfiguration) {
      if (!capabilitiesJson || typeof capabilitiesJson !== 'object') {
        capabilitiesJson = {};
      }
      capabilitiesJson.aiConfiguration = dto.aiConfiguration;
      if (dto.aiConfiguration === AiConfigurationFeature.REASONING_EFFORT && dto.reasoningEffortLevels) {
        capabilitiesJson.reasoningEffortLevels = dto.reasoningEffortLevels;
      } else {
        delete capabilitiesJson.reasoningEffortLevels;
      }
    } else if (dto.aiConfiguration === null && capabilitiesJson) {
      delete capabilitiesJson.aiConfiguration;
      delete capabilitiesJson.reasoningEffortLevels;
    } else if (dto.reasoningEffortLevels !== undefined && capabilitiesJson && capabilitiesJson.aiConfiguration === AiConfigurationFeature.REASONING_EFFORT) {
       if (dto.reasoningEffortLevels === null) {
         delete capabilitiesJson.reasoningEffortLevels;
       } else {
         capabilitiesJson.reasoningEffortLevels = dto.reasoningEffortLevels;
       }
    }

    const updated = await this.prisma.providerCatalogItem.update({
      where: { id },
      data: {
        ...(dto.displayName ? { displayName: dto.displayName } : {}),
        ...(dto.externalKey ? { externalKey: dto.externalKey } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...((dto.aiConfiguration !== undefined || dto.reasoningEffortLevels !== undefined) ? { capabilitiesJson: (capabilitiesJson ?? Prisma.DbNull) as import("@prisma/client").Prisma.InputJsonValue } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: "PROVIDER_CATALOG_ITEM_UPDATED",
        entityType: "ProviderCatalogItem",
        entityId: item.id,
        before: toJson(item),
        after: toJson(updated),
      },
    });

    return updated;
  }

  async deleteCatalogItem(id: string, actorUserId: string) {
    const item = await this.prisma.providerCatalogItem.findUnique({
      where: { id },
      include: {
        _count: {
          select: { usageEvents: true },
        },
      },
    });
    if (!item) {
      throwNotFound("PROVIDER_CATALOG_ITEM_NOT_FOUND", "Không tìm thấy model.");
    }
    
    if (item._count.usageEvents > 0) {
      throwConflict(
        "PROVIDER_CATALOG_ITEM_IN_USE",
        "Không thể xoá model đã có dữ liệu sử dụng. Vui lòng chuyển trạng thái sang ngưng hoạt động (DEPRECATED)."
      );
    }
    
    // Check if it's currently used in routing configurations
    const usedInConfig = await this.prisma.aiFeatureModelConfig.findFirst({
      where: {
        OR: [
          { primaryCatalogItemId: id },
          { fallbackCatalogItemId: id }
        ]
      }
    });
    
    if (usedInConfig) {
      throwConflict(
        "PROVIDER_CATALOG_ITEM_IN_ROUTING",
        "Không thể xoá model đang được cấu hình sử dụng trong hệ thống AI. Vui lòng gỡ cấu hình trước khi xoá."
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      // First delete all price versions and their rates
      const prices = await transaction.providerPriceVersion.findMany({
        where: { catalogItemId: id },
      });
      for (const price of prices) {
        await transaction.providerPriceRate.deleteMany({
          where: { priceVersionId: price.id },
        });
      }
      await transaction.providerPriceVersion.deleteMany({
        where: { catalogItemId: id },
      });
      
      // Delete the catalog item
      await transaction.providerCatalogItem.delete({
        where: { id },
      });

      await transaction.auditLog.create({
        data: {
          actorUserId,
          action: "PROVIDER_CATALOG_ITEM_DELETED",
          entityType: "ProviderCatalogItem",
          entityId: item.id,
          before: toJson(item),
        },
      });
    });

    return { success: true };
  }

  async aiConfigurations() {
    const [configurations, catalog] = await Promise.all([
      this.prisma.aiFeatureModelConfig.findMany({
        where: { feature: { in: [...MANAGED_AI_FEATURES] } },
        include: {
          primaryCatalogItem: true,
          fallbackCatalogItem: true,
        },
        orderBy: { feature: "asc" },
      }),
      this.prisma.providerCatalogItem.findMany({
        where: { category: ProviderCatalogCategory.AI_MODEL },
        orderBy: [{ status: "asc" }, { provider: "asc" }, { displayName: "asc" }],
      }),
    ]);

    return {
      configurations: configurations.map((configuration) => ({
        feature: configuration.feature,
        primaryCatalogItemId: configuration.primaryCatalogItemId,
        fallbackCatalogItemId: configuration.fallbackCatalogItemId,
        temperature: configuration.temperature?.toNumber() ?? null,
        reasoningEffort: configuration.reasoningEffort ?? null,
        maxOutputTokens: configuration.maxOutputTokens,
        version: configuration.version,
        updatedAt: configuration.updatedAt,
      })),
      models: catalog.map((item) => ({
        id: item.id,
        provider: item.provider,
        externalKey: item.externalKey,
        displayName: item.displayName,
        capabilities: item.capabilitiesJson,
        status: item.status,
        credentialConfigured: this.routing.isCredentialConfigured(item.provider),
      })),
    };
  }

  async updateAiConfigurations(actorUserId: string, dto: UpdateAiConfigurationsDto) {
    const features = new Set(dto.configurations.map((item) => item.feature));
    if (
      features.size !== dto.configurations.length ||
      dto.configurations.some(
        (item) =>
          !MANAGED_AI_FEATURES.includes(
            item.feature as (typeof MANAGED_AI_FEATURES)[number],
          ),
      )
    ) {
      throwBadRequest(
        "AI_CONFIGURATION_FEATURE_INVALID",
        "Chỉ được cấu hình tóm tắt, quiz, flashcard và bài kiểm tra.",
      );
    }

    await this.prisma.$transaction(async (transaction) => {
      for (const item of dto.configurations) {
        if (item.primaryCatalogItemId === item.fallbackCatalogItemId) {
          throwBadRequest(
            "AI_CONFIGURATION_FALLBACK_DUPLICATE",
            "Model dự phòng phải khác model chính.",
            { feature: item.feature },
          );
        }
        const catalogIds = [item.primaryCatalogItemId, item.fallbackCatalogItemId].filter(
          (id): id is string => Boolean(id),
        );
        const catalog = await transaction.providerCatalogItem.findMany({
          where: { id: { in: catalogIds } },
          select: { id: true, category: true, status: true, capabilitiesJson: true },
        });
        if (
          catalog.length !== catalogIds.length ||
          catalog.some(
            (model) =>
              model.category !== ProviderCatalogCategory.AI_MODEL ||
              model.status === ProviderCatalogStatus.DISABLED ||
              !hasCapability(model.capabilitiesJson, item.feature),
          )
        ) {
          throwBadRequest(
            "AI_CONFIGURATION_MODEL_INVALID",
            "Model đã chọn không khả dụng cho chức năng này.",
            { feature: item.feature },
          );
        }

        const before = await transaction.aiFeatureModelConfig.findUnique({
          where: { feature: item.feature },
        });
        if ((before?.version ?? 0) !== item.expectedVersion) {
          throwConflict(
            "AI_CONFIGURATION_VERSION_CONFLICT",
            "Cấu hình đã được thay đổi ở nơi khác. Vui lòng tải lại.",
            { feature: item.feature, currentVersion: before?.version ?? 0 },
          );
        }

        const after = await transaction.aiFeatureModelConfig.upsert({
          where: { feature: item.feature },
          create: {
            feature: item.feature,
            primaryCatalogItemId: item.primaryCatalogItemId,
            fallbackCatalogItemId: item.fallbackCatalogItemId ?? null,
            temperature: item.temperature,
            reasoningEffort: item.reasoningEffort ?? null,
            maxOutputTokens: item.maxOutputTokens,
            updatedByUserId: actorUserId,
            version: 1,
          },
          update: {
            primaryCatalogItemId: item.primaryCatalogItemId,
            fallbackCatalogItemId: item.fallbackCatalogItemId ?? null,
            temperature: item.temperature,
            reasoningEffort: item.reasoningEffort ?? null,
            maxOutputTokens: item.maxOutputTokens,
            updatedByUserId: actorUserId,
            version: { increment: 1 },
          },
        });
        await transaction.auditLog.create({
          data: {
            actorUserId,
            action: "AI_FEATURE_MODEL_CONFIGURATION_UPDATED",
            entityType: "AiFeatureModelConfig",
            entityId: after.id,
            before: before ? toJson(before) : undefined,
            after: toJson(after),
          },
        });
      }
    });

    return this.aiConfigurations();
  }

  async ocrSettings() {
    const [accounting, ocrCatalog, budget] = await Promise.all([
      this.getAccountingSettings(),
      this.prisma.providerCatalogItem.findMany({
        where: { category: ProviderCatalogCategory.OCR_SERVICE },
        include: {
          priceVersions: {
            orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
            take: 1,
            include: { rates: true },
          },
        },
      }),
      this.prisma.providerBudgetPolicy.findUnique({
        where: { scope: ProviderBudgetScope.OCR },
      }),
    ]);
    return {
      provider: this.configService.get("OCR_PROVIDER", { infer: true }),
      paidEnabled: this.configService.get("OCR_PAID_ENABLED", { infer: true }),
      cacheEnabled: this.configService.get("OCR_ARTIFACT_CACHE_ENABLED", {
        infer: true,
      }),
      credentialConfigured: this.routing.isCredentialConfigured("MATHPIX"),
      monthlyBudgetVnd: budget?.monthlyLimitVnd ?? 0,
      hardStop: budget?.hardStop ?? false,
      accounting,
      services: ocrCatalog.map((item) => ({
        id: item.id,
        provider: item.provider,
        displayName: item.displayName,
        externalKey: item.externalKey,
        status: item.status,
        latestPrice: item.priceVersions[0]
          ? serializePriceVersion(item.priceVersions[0])
          : null,
      })),
    };
  }

  async updateOcrSettings(actorUserId: string, dto: UpdateOcrSettingsDto) {
    const current = await this.prisma.providerAccountingSetting.findUnique({
      where: { singletonKey: "default" },
    });
    if ((current?.version ?? 0) !== dto.expectedVersion) {
      throwConflict(
        "PROVIDER_ACCOUNTING_VERSION_CONFLICT",
        "Thiết lập quy đổi đã thay đổi. Vui lòng tải lại.",
        { currentVersion: current?.version ?? 0 },
      );
    }
    const updated = await this.prisma.providerAccountingSetting.upsert({
      where: { singletonKey: "default" },
      create: {
        singletonKey: "default",
        fxRateVndPerUsd: dto.fxRateVndPerUsd,
        priceFreshnessDays: dto.priceFreshnessDays,
        updatedByUserId: actorUserId,
        version: 1,
      },
      update: {
        fxRateVndPerUsd: dto.fxRateVndPerUsd,
        priceFreshnessDays: dto.priceFreshnessDays,
        updatedByUserId: actorUserId,
        version: { increment: 1 },
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        action: "PROVIDER_ACCOUNTING_SETTINGS_UPDATED",
        entityType: "ProviderAccountingSetting",
        entityId: updated.id,
        before: current ? toJson(current) : undefined,
        after: toJson(updated),
      },
    });
    return this.ocrSettings();
  }

  async listBudgets() {
    await this.ensureBudgetDefaults();
    const [budgets, commitments] = await Promise.all([
      this.prisma.providerBudgetPolicy.findMany({ orderBy: { scope: "asc" } }),
      this.usage.getCurrentBudgetCommitments(),
    ]);
    return budgets.map((budget) => {
      const usedVnd =
        budget.scope === ProviderBudgetScope.AI
          ? commitments.aiUsedVnd
          : budget.scope === ProviderBudgetScope.OCR
            ? commitments.ocrUsedVnd
            : commitments.aiUsedVnd + commitments.ocrUsedVnd;
      const reservedVnd =
        budget.scope === ProviderBudgetScope.AI
          ? commitments.aiReservedVnd
          : budget.scope === ProviderBudgetScope.OCR
            ? commitments.ocrReservedVnd
            : commitments.aiReservedVnd + commitments.ocrReservedVnd;
      const availableVnd = Math.max(0, budget.monthlyLimitVnd - usedVnd - reservedVnd);
      const committedVnd = usedVnd + reservedVnd;
      return {
        scope: budget.scope,
        monthlyLimitVnd: budget.monthlyLimitVnd,
        warningThresholds: budget.warningThresholds,
        hardStop: budget.hardStop,
        version: budget.version,
        usedVnd,
        reservedVnd,
        availableVnd,
        enforcementState:
          budget.hardStop && availableVnd === 0
            ? "BLOCKED"
            : budget.hardStop
              ? "ENFORCED"
              : "MONITORING",
        usedPercent:
          budget.monthlyLimitVnd === 0
            ? 0
            : Math.round((committedVnd / budget.monthlyLimitVnd) * 10_000) / 100,
        updatedAt: budget.updatedAt,
      };
    });
  }

  async updateBudgets(actorUserId: string, dto: UpdateProviderBudgetsDto) {
    const scopes = new Set(dto.budgets.map((budget) => budget.scope));
    if (scopes.size !== dto.budgets.length) {
      throwBadRequest("PROVIDER_BUDGET_SCOPE_DUPLICATE", "Phạm vi ngân sách bị trùng.");
    }
    const settings = await this.getAccountingSettings();
    const period = getProviderBudgetPeriod(new Date(), settings.timezone);
    await this.prisma.$transaction(
      async (transaction) => {
        await lockProviderBudgetScopes(
          transaction,
          period.key,
          dto.budgets.map((budget) => budget.scope),
        );
        const commitments = await this.usage.getCurrentBudgetCommitments();
        for (const budget of dto.budgets) {
          const thresholds = [...budget.warningThresholds].sort((a, b) => a - b);
          if (
            thresholds.some((value) => value < 1 || value > 100) ||
            new Set(thresholds).size !== thresholds.length
          ) {
            throwBadRequest(
              "PROVIDER_BUDGET_THRESHOLD_INVALID",
              "Ngưỡng cảnh báo phải khác nhau và nằm trong khoảng 1-100%.",
            );
          }
          const committedVnd =
            budget.scope === ProviderBudgetScope.AI
              ? commitments.aiUsedVnd + commitments.aiReservedVnd
              : budget.scope === ProviderBudgetScope.OCR
                ? commitments.ocrUsedVnd + commitments.ocrReservedVnd
                : commitments.aiUsedVnd +
                  commitments.ocrUsedVnd +
                  commitments.aiReservedVnd +
                  commitments.ocrReservedVnd;
          if (budget.hardStop && budget.monthlyLimitVnd < committedVnd) {
            throwBadRequest(
              "PROVIDER_BUDGET_BELOW_COMMITTED",
              "Mức ngân sách mới thấp hơn số tiền đã dùng và đang giữ.",
              {
                scope: budget.scope,
                committedVnd,
                monthlyLimitVnd: budget.monthlyLimitVnd,
              },
            );
          }
          const current = await transaction.providerBudgetPolicy.findUnique({
            where: { scope: budget.scope },
          });
          if ((current?.version ?? 0) !== budget.expectedVersion) {
            throwConflict(
              "PROVIDER_BUDGET_VERSION_CONFLICT",
              "Ngân sách đã thay đổi. Vui lòng tải lại.",
              { scope: budget.scope, currentVersion: current?.version ?? 0 },
            );
          }
          const updated = await transaction.providerBudgetPolicy.upsert({
            where: { scope: budget.scope },
            create: {
              scope: budget.scope,
              monthlyLimitVnd: budget.monthlyLimitVnd,
              hardStop: budget.hardStop,
              warningThresholds: thresholds,
              updatedByUserId: actorUserId,
              version: 1,
            },
            update: {
              monthlyLimitVnd: budget.monthlyLimitVnd,
              hardStop: budget.hardStop,
              warningThresholds: thresholds,
              updatedByUserId: actorUserId,
              version: { increment: 1 },
            },
          });
          await transaction.auditLog.create({
            data: {
              actorUserId,
              action: "PROVIDER_BUDGET_UPDATED",
              entityType: "ProviderBudgetPolicy",
              entityId: updated.id,
              before: current ? toJson(current) : undefined,
              after: toJson(updated),
            },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    return this.listBudgets();
  }

  async createPriceVersion(
    catalogItemId: string,
    actorUserId: string,
    dto: CreatePriceVersionDto,
  ) {
    const item = await this.prisma.providerCatalogItem.findUnique({
      where: { id: catalogItemId },
      select: { id: true },
    });
    if (!item) {
      throwNotFound("PROVIDER_CATALOG_ITEM_NOT_FOUND", "Không tìm thấy model/provider.");
    }
    const effectiveFrom = new Date(dto.effectiveFrom);
    const created = await this.prisma.$transaction(async (transaction) => {
      await transaction.providerPriceVersion.updateMany({
        where: {
          catalogItemId,
          effectiveFrom: { lte: effectiveFrom },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
        },
        data: { effectiveTo: effectiveFrom },
      });
      const price = await transaction.providerPriceVersion.create({
        data: {
          catalogItemId,
          billingMode: dto.billingMode,
          sourceUrl: dto.sourceUrl,
          effectiveFrom,
          createdByUserId: actorUserId,
          rates: {
            create: dto.rates.map((rate) => ({
              metric: rate.metric,
              unitSize: rate.unitSize,
              unitPriceUsd: rate.unitPriceUsd,
              tierFrom: rate.tierFrom,
              tierTo: rate.tierTo,
            })),
          },
        },
        include: { rates: true },
      });
      await transaction.auditLog.create({
        data: {
          actorUserId,
          action: "PROVIDER_PRICE_VERSION_CREATED",
          entityType: "ProviderPriceVersion",
          entityId: price.id,
          after: toJson(price),
          metadata: { catalogItemId },
        },
      });
      return price;
    });
    return serializePriceVersion(created);
  }

  async timeline(query: ProviderUsageQueryDto) {
    const { from, to } = resolveDateRange(query);
    const where = buildUsageWhere(query, from, to);
    const events = await this.prisma.providerUsageEvent.findMany({
      where,
      select: {
        createdAt: true,
        costVnd: true,
        estimatedSavedCostVnd: true,
        status: true,
        totalTokens: true,
        pages: true,
      },
      orderBy: { createdAt: "asc" },
      take: 50_000,
    });
    const buckets = new Map<
      string,
      {
        bucket: string;
        costVnd: number;
        savedCostVnd: number;
        calls: number;
        failed: number;
        totalTokens: number;
        pages: number;
      }
    >();
    for (const event of events) {
      const bucket = getBucketKey(event.createdAt, query.granularity);
      const current = buckets.get(bucket) ?? {
        bucket,
        costVnd: 0,
        savedCostVnd: 0,
        calls: 0,
        failed: 0,
        totalTokens: 0,
        pages: 0,
      };
      current.costVnd += event.costVnd;
      current.savedCostVnd += event.estimatedSavedCostVnd;
      current.calls += 1;
      current.failed += event.status === "FAILED" ? 1 : 0;
      current.totalTokens += event.totalTokens;
      current.pages += event.pages;
      buckets.set(bucket, current);
    }
    return { from, to, granularity: query.granularity, points: [...buckets.values()] };
  }

  async breakdown(query: ProviderUsageQueryDto) {
    const { from, to } = resolveDateRange(query);
    const grouped = await this.prisma.providerUsageEvent.groupBy({
      by: ["category", "provider", "catalogItemId", "feature"],
      where: buildUsageWhere(query, from, to),
      _sum: {
        costVnd: true,
        estimatedSavedCostVnd: true,
        totalTokens: true,
        pages: true,
      },
      _count: { _all: true },
      orderBy: { _sum: { costVnd: "desc" } },
    });
    const catalogIds = grouped
      .map((item) => item.catalogItemId)
      .filter((id): id is string => Boolean(id));
    const catalog = await this.prisma.providerCatalogItem.findMany({
      where: { id: { in: catalogIds } },
      select: { id: true, displayName: true, externalKey: true },
    });
    const names = new Map(catalog.map((item) => [item.id, item]));
    return grouped.map((item) => ({
      category: item.category,
      provider: item.provider,
      catalogItemId: item.catalogItemId,
      model: item.catalogItemId ? (names.get(item.catalogItemId) ?? null) : null,
      feature: item.feature,
      calls: item._count._all,
      costVnd: item._sum.costVnd ?? 0,
      savedCostVnd: item._sum.estimatedSavedCostVnd ?? 0,
      totalTokens: item._sum.totalTokens ?? 0,
      pages: item._sum.pages ?? 0,
    }));
  }

  async events(query: ProviderUsageEventsQueryDto) {
    const { from, to } = resolveDateRange(query);
    const where = {
      ...buildUsageWhere(query, from, to),
      ...(query.status ? { status: query.status } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.providerUsageEvent.findMany({
        where,
        include: {
          catalogItem: { select: { displayName: true, externalKey: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.providerUsageEvent.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        estimatedCostUsd: item.estimatedCostUsd.toNumber(),
        fxRateVndPerUsd: item.fxRateVndPerUsd.toNumber(),
        estimatedSavedCostUsd: item.estimatedSavedCostUsd.toNumber(),
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  auditHistory(query: ProviderAuditQueryDto) {
    return this.prisma.auditLog.findMany({
      where: {
        entityType: {
          in: [
            "AiFeatureModelConfig",
            "ProviderBudgetPolicy",
            "ProviderAccountingSetting",
            "ProviderPriceVersion",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: query.limit,
      select: {
        id: true,
        actorUserId: true,
        action: true,
        entityType: true,
        entityId: true,
        before: true,
        after: true,
        metadata: true,
        createdAt: true,
      },
    });
  }

  private async ensureDefaults() {
    await Promise.all([this.ensureBudgetDefaults(), this.getAccountingSettings()]);
  }

  private async ensureBudgetDefaults() {
    const defaults: Record<ProviderBudgetScope, number> = {
      ALL: 2_000_000,
      AI: this.configService.get("AI_MONTHLY_BUDGET_VND", { infer: true }),
      OCR: this.configService.get("OCR_MONTHLY_BUDGET_VND", { infer: true }),
    };
    await Promise.all(
      Object.values(ProviderBudgetScope).map((scope) =>
        this.prisma.providerBudgetPolicy.upsert({
          where: { scope },
          create: { scope, monthlyLimitVnd: defaults[scope] },
          update: {},
        }),
      ),
    );
  }

  private async getAccountingSettings() {
    const settings = await this.prisma.providerAccountingSetting.upsert({
      where: { singletonKey: "default" },
      create: { singletonKey: "default" },
      update: {},
    });
    return {
      timezone: settings.timezone,
      weekStartsOn: settings.weekStartsOn,
      fxRateVndPerUsd: settings.fxRateVndPerUsd.toNumber(),
      priceFreshnessDays: settings.priceFreshnessDays,
      version: settings.version,
      updatedAt: settings.updatedAt,
    };
  }
}

function serializePriceVersion(version: {
  id: string;
  billingMode: import("@prisma/client").ProviderBillingMode;
  currency: string;
  sourceUrl: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdAt: Date;
  rates: Array<{
    id: string;
    metric: import("@prisma/client").ProviderUsageMetric;
    unitSize: Prisma.Decimal;
    unitPriceUsd: Prisma.Decimal;
    tierFrom: number | null;
    tierTo: number | null;
  }>;
}) {
  return {
    id: version.id,
    billingMode: version.billingMode,
    currency: version.currency,
    sourceUrl: version.sourceUrl,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    createdAt: version.createdAt,
    rates: version.rates.map((rate) => ({
      id: rate.id,
      metric: rate.metric,
      unitSize: rate.unitSize.toNumber(),
      unitPriceUsd: rate.unitPriceUsd.toNumber(),
      tierFrom: rate.tierFrom,
      tierTo: rate.tierTo,
    })),
  };
}

function hasCapability(value: Prisma.JsonValue | null, feature: AiGenerationType) {
  return Array.isArray(value) && value.includes(feature);
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function startOfMonthInHoChiMinh(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return new Date(Date.UTC(year, month - 1, 1) - 7 * 60 * 60 * 1000);
}

function resolveDateRange(query: ProviderUsageQueryDto) {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from
    ? new Date(query.from)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (from >= to) {
    throwBadRequest(
      "PROVIDER_USAGE_DATE_RANGE_INVALID",
      "Khoảng thời gian không hợp lệ.",
    );
  }
  if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throwBadRequest(
      "PROVIDER_USAGE_DATE_RANGE_TOO_LARGE",
      "Chỉ được thống kê tối đa 366 ngày mỗi lần.",
    );
  }
  return { from, to };
}

function buildUsageWhere(query: ProviderUsageQueryDto, from: Date, to: Date) {
  const feature = parseFeature(query.feature);
  return {
    createdAt: { gte: from, lte: to },
    ...(query.category ? { category: query.category } : {}),
    ...(query.provider ? { provider: query.provider.toUpperCase() } : {}),
    ...(feature ? { feature } : {}),
  } satisfies Prisma.ProviderUsageEventWhereInput;
}

function parseFeature(value?: string) {
  if (!value) return undefined;
  return Object.values(AiGenerationType).includes(value as AiGenerationType)
    ? (value as AiGenerationType)
    : undefined;
}

function getBucketKey(date: Date, granularity: ProviderUsageGranularity) {
  const localDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const year = localDate.getUTCFullYear();
  const month = localDate.getUTCMonth();
  const day = localDate.getUTCDate();
  if (granularity === ProviderUsageGranularity.MONTH) {
    return `${year}-${String(month + 1).padStart(2, "0")}`;
  }
  if (granularity === ProviderUsageGranularity.WEEK) {
    const mondayOffset = (localDate.getUTCDay() + 6) % 7;
    const monday = new Date(Date.UTC(year, month, day - mondayOffset));
    return monday.toISOString().slice(0, 10);
  }
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
