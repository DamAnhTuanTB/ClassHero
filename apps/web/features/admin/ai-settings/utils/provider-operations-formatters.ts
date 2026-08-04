import type {
  AiFeature,
  PriceRate,
  ProviderCatalogItem,
  UsageEvent,
} from "@/features/admin/ai-settings/types/provider-operations-types";

export const aiFeatureLabels: Record<AiFeature, string> = {
  SUMMARY: "Sinh tóm tắt",
  QUIZ: "Sinh câu hỏi ôn tập",
  FLASHCARD: "Sinh thẻ ghi nhớ",
  TEST: "Sinh bài kiểm tra",
};

export const priceMetricLabels: Record<PriceRate["metric"], string> = {
  INPUT_TOKEN: "Nội dung gửi vào",
  CACHED_INPUT_TOKEN: "Nội dung được dùng lại",
  OUTPUT_TOKEN: "Nội dung AI tạo ra",
  PAGE: "Trang tài liệu",
  REQUEST: "Lượt sử dụng",
};

export const providerStatusLabels: Record<ProviderCatalogItem["status"], string> = {
  ACTIVE: "Đang dùng",
  DEPRECATED: "Sắp ngừng hỗ trợ",
  DISABLED: "Đã tắt",
};

export const usageStatusLabels: Record<UsageEvent["status"], string> = {
  RUNNING: "Đang xử lý",
  SUCCEEDED: "Thành công",
  FAILED: "Không thành công",
};

export function formatCacheStatus(value: string | null) {
  if (!value) return null;
  return value.toUpperCase() === "HIT" ? "Đã dùng kết quả có sẵn" : "Xử lý mới";
}

export function formatVnd(value: number) {
  const amount = new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(value);

  return `${amount} VNĐ`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN", { notation: "compact" }).format(value);
}

export function formatDateTime(value: string | null) {
  if (!value) return "Chưa có dữ liệu";

  const parts = getDateParts(value, true);
  return `${parts.hour}:${parts.minute} ${parts.day}-${parts.month}-${parts.year}`;
}

export function formatDate(value: string) {
  const parts = getDateParts(value, false);
  return `${parts.day}-${parts.month}-${parts.year}`;
}

function getDateParts(value: string, includeTime: boolean) {
  const options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  };

  if (includeTime) {
    options.hour = "2-digit";
    options.minute = "2-digit";
    options.hourCycle = "h23";
  }

  const parts = new Intl.DateTimeFormat("en-GB", options).formatToParts(new Date(value));
  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    day: getPart("day"),
    month: getPart("month"),
    year: getPart("year"),
    hour: getPart("hour"),
    minute: getPart("minute"),
  };
}
