import { z } from "zod";

const nonnegativeDecimal = z
  .string()
  .trim()
  .min(1, "Nhập đơn giá")
  .regex(/^\d+(?:[.,]\d+)?$/, "Đơn giá phải là số không âm");

export const providerPriceVersionSchema = z.object({
  sourceUrl: z
    .string()
    .trim()
    .url("Đường dẫn chưa đúng định dạng")
    .optional()
    .or(z.literal('')),
  rates: z
    .array(
      z.object({
        metric: z.enum([
          "INPUT_TOKEN",
          "CACHED_INPUT_TOKEN",
          "OUTPUT_TOKEN",
          "PAGE",
          "REQUEST",
        ]),
        unitSize: z.number().positive(),
        unitPriceUsd: nonnegativeDecimal,
        tierFrom: z.number().nullable(),
        tierTo: z.number().nullable(),
      }),
    )
    .min(1),
});

export type ProviderPriceVersionFormValues = z.infer<typeof providerPriceVersionSchema>;

export const providerCatalogItemSchema = z.object({
  displayName: z.string().trim().min(1, "Vui lòng nhập tên hiển thị"),
  externalKey: z.string().trim().min(1, "Vui lòng nhập tên model"),
  aiConfiguration: z.enum(["TEMPERATURE", "REASONING_EFFORT"]),
  reasoningEffortLevels: z.array(z.string()).optional(),
});

export type ProviderCatalogItemFormValues = z.infer<typeof providerCatalogItemSchema>;

export const createProviderCatalogItemSchema = providerCatalogItemSchema.and(
  providerPriceVersionSchema.partial()
);

export type CreateProviderCatalogItemFormValues = z.infer<typeof createProviderCatalogItemSchema>;
