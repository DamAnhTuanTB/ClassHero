import { z } from "zod";

const nonnegativeDecimal = z
  .string()
  .trim()
  .min(1, "Nhập đơn giá")
  .regex(/^\d+(?:[.,]\d+)?$/, "Đơn giá phải là số không âm");

export const providerPriceVersionSchema = z.object({
  effectiveFrom: z.string().min(1, "Chọn ngày hiệu lực"),
  sourceUrl: z
    .string()
    .trim()
    .min(1, "Nhập đường dẫn nguồn giá")
    .url("Đường dẫn chưa đúng định dạng"),
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
