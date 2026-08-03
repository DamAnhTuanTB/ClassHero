import type { AiFeature } from "@/features/admin/ai-settings/types/provider-operations-types";

export const aiFeatureLabels: Record<AiFeature, string> = {
  SUMMARY: "Sinh tóm tắt",
  QUIZ: "Sinh Quiz",
  FLASHCARD: "Sinh Flashcard",
  TEST: "Sinh bài kiểm tra",
};

export function formatVnd(value: number) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN", { notation: "compact" }).format(value);
}

export function formatDateTime(value: string | null) {
  if (!value) return "Chưa có dữ liệu";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}
