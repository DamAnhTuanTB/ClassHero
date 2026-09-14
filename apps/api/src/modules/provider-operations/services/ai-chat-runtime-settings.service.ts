import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiProviderName, ProviderCatalogStatus } from "@prisma/client";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type { EnvConfig } from "#api/config/env.validation";

export const AI_CHAT_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AiChatImageMimeType = (typeof AI_CHAT_IMAGE_MIME_TYPES)[number];

export type ResolvedAiChatRuntimeSettings = {
  embeddingCatalogItemId: string | null;
  embeddingProvider: AiProviderName;
  embeddingModel: string;
  embeddingDimensions: number;
  maxImagesPerMessage: number;
  maxImageBytes: number;
  allowedImageMimeTypes: AiChatImageMimeType[];
  studentDailyMessageLimit: number;
  studentDailyImageLimit: number;
  version: number;
};

@Injectable()
export class AiChatRuntimeSettingsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  async get(): Promise<ResolvedAiChatRuntimeSettings> {
    const setting = await this.prisma.aiChatRuntimeSetting.findUnique({
      where: { singletonKey: "default" },
      include: { embeddingCatalogItem: true },
    });
    const catalogItem =
      setting?.embeddingCatalogItem?.status === ProviderCatalogStatus.ACTIVE &&
      setting.embeddingCatalogItem.provider === AiProviderName.OPENAI &&
      hasEmbeddingCapability(setting.embeddingCatalogItem.capabilitiesJson)
        ? setting.embeddingCatalogItem
        : null;
    const fallbackDimensions = this.config.get("OPENAI_EMBEDDING_DIMENSIONS", {
      infer: true,
    });
    return {
      embeddingCatalogItemId: catalogItem?.id ?? null,
      embeddingProvider: AiProviderName.OPENAI,
      embeddingModel:
        catalogItem?.externalKey ??
        this.config.get("OPENAI_EMBEDDING_MODEL", { infer: true }),
      embeddingDimensions:
        readEmbeddingDimensions(
          catalogItem?.capabilitiesJson,
          fallbackDimensions,
        ) ?? fallbackDimensions,
      maxImagesPerMessage:
        setting?.maxImagesPerMessage ??
        this.config.get("AI_CHAT_MAX_IMAGES_PER_MESSAGE", { infer: true }),
      maxImageBytes:
        setting == null
          ? Math.floor(
              this.config.get("MAX_CHAT_IMAGE_UPLOAD_MB", { infer: true }) *
                1024 *
                1024,
            )
          : Number(setting.maxImageBytes),
      allowedImageMimeTypes: normalizeImageMimeTypes(
        setting?.allowedImageMimeTypes,
      ),
      studentDailyMessageLimit:
        setting?.studentDailyMessageLimit ??
        this.config.get("AI_STUDENT_CHAT_DAILY_LIMIT", { infer: true }),
      studentDailyImageLimit: setting?.studentDailyImageLimit ?? 20,
      version: setting?.version ?? 0,
    };
  }
}

export function hasEmbeddingCapability(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const features = (value as Record<string, unknown>).features;
  return Array.isArray(features) && features.includes("EMBEDDING");
}

export function readEmbeddingDimensions(value: unknown, preferred?: number) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const dimensions = (value as Record<string, unknown>).dimensions;
  if (!Array.isArray(dimensions)) return null;
  const supported = dimensions.filter(
    (dimension): dimension is number =>
      typeof dimension === "number" && Number.isInteger(dimension) && dimension > 0,
  );
  if (preferred !== undefined && supported.includes(preferred)) return preferred;
  return supported[0] ?? null;
}

export function normalizeImageMimeTypes(
  values: string[] | null | undefined,
): AiChatImageMimeType[] {
  const allowed = new Set<string>(AI_CHAT_IMAGE_MIME_TYPES);
  const normalized = [...new Set(values ?? [])].filter(
    (value): value is AiChatImageMimeType => allowed.has(value),
  );
  return normalized.length > 0 ? normalized : [...AI_CHAT_IMAGE_MIME_TYPES];
}
