import type {
  AiFeature,
  PriceRate,
  ProviderCatalogItem,
  ProviderUsageOperation,
  UsageEvent,
} from "@/features/admin/ai-settings/types/provider-operations-types";

export const aiFeatureLabels: Record<AiFeature, string> = {
  SUMMARY: "Sinh Kiến thức",
  VIDEO_SUMMARY: "Tóm tắt video bằng AI",
  QUIZ: "Sinh câu hỏi ôn tập",
  FLASHCARD: "Sinh thẻ ghi nhớ",
  TEST: "Sinh bài kiểm tra",
  CHAT: "Chat với AI",
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

const usagePurposeLabelsByResourceType: Record<string, string> = {
  QUIZ_FIGURE: "Tạo hình minh họa Quiz",
  FLASHCARD_FIGURE: "Tạo hình minh họa Flashcard",
  STEM_FIGURE: "Tạo hình minh họa",
};

const usageOperationLabels: Record<ProviderUsageOperation, string> = {
  SUMMARY_GENERATION: "Sinh kiến thức",
  VIDEO_SUMMARY_GENERATION: "Tóm tắt Video",
  QUIZ_GENERATION: "Tạo bộ Quiz",
  FLASHCARD_GENERATION: "Tạo bộ Flashcard",
  TEST_GENERATION: "Tạo bài kiểm tra",
  EXPLANATION_GENERATION: "Tạo lời giải AI",
  CHAT_RESPONSE_GENERATION: "Trả lời chat AI",
  CHAT_TITLE_GENERATION: "Đặt tên cuộc trò chuyện",
  EMBEDDING_GENERATION: "Tạo embedding",
  DOCUMENT_EXTRACTION: "Trích xuất tài liệu",
  DIAGRAM_GENERATION: "Tạo ảnh mới",
  QUIZ_SOLUTION_REFINEMENT: "Tinh chỉnh lời giải",
  QUIZ_SOLUTION_REGENERATION: "Tạo lại lời giải",
  TEST_SOLUTION_REFINEMENT: "Tinh chỉnh lời giải Test",
  TEST_SOLUTION_REGENERATION: "Tạo lại lời giải Test",
  SUMMARY_FIGURE_GENERATION: "Tạo ảnh mới",
  SUMMARY_QUESTION_FIGURE_GENERATION: "Tạo ảnh đề bài",
  SUMMARY_SOLUTION_FIGURE_GENERATION: "Tạo ảnh lời giải",
  SUMMARY_FIGURE_EDITING: "Chỉnh sửa ảnh",
  SUMMARY_FIGURE_REPAIR: "Sửa lỗi ảnh",
  QUIZ_QUESTION_FIGURE_GENERATION: "Tạo ảnh đề Quiz",
  QUIZ_QUESTION_FIGURE_EDITING: "Chỉnh sửa ảnh đề Quiz",
  QUIZ_QUESTION_FIGURE_REFINEMENT: "Tinh chỉnh ảnh đề Quiz",
  QUIZ_SOLUTION_FIGURE_GENERATION: "Tạo ảnh lời giải Quiz",
  QUIZ_SOLUTION_FIGURE_EDITING: "Chỉnh sửa ảnh lời giải Quiz",
  QUIZ_SOLUTION_FIGURE_REFINEMENT: "Tinh chỉnh ảnh lời giải Quiz",
  TEST_QUESTION_FIGURE_GENERATION: "Tạo ảnh đề Test",
  TEST_QUESTION_FIGURE_EDITING: "Chỉnh sửa ảnh đề Test",
  TEST_QUESTION_FIGURE_REFINEMENT: "Tinh chỉnh ảnh đề Test",
  TEST_SOLUTION_FIGURE_GENERATION: "Tạo ảnh lời giải Test",
  TEST_SOLUTION_FIGURE_EDITING: "Chỉnh sửa ảnh lời giải Test",
  TEST_SOLUTION_FIGURE_REFINEMENT: "Tinh chỉnh ảnh lời giải Test",
  FLASHCARD_SOLUTION_FIGURE_GENERATION: "Tạo ảnh lời giải Flashcard",
};

const reasoningEffortLabels: Record<string, string> = {
  none: "Không",
  minimal: "Tối thiểu",
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
  xhigh: "Rất cao",
  max: "Tối đa",
};

export function formatCacheStatus(value: string | null) {
  if (!value) return null;
  return value.toUpperCase() === "HIT" ? "Đã dùng kết quả có sẵn" : "Xử lý mới";
}

export function formatUsagePurpose(event: UsageEvent) {
  if (event.operation) {
    return usageOperationLabels[event.operation];
  }
  const resourceType = event.backgroundJob?.resourceType;
  if (resourceType && usagePurposeLabelsByResourceType[resourceType]) {
    return usagePurposeLabelsByResourceType[resourceType];
  }
  if (event.feature) {
    const phaseLabel =
      event.purpose === "IMAGE"
        ? "Phase 2 · Tạo hình"
        : event.purpose === "TEXT"
          ? "Phase 1 · Tạo nội dung"
          : null;
    return phaseLabel
      ? `${aiFeatureLabels[event.feature]} · ${phaseLabel}`
      : aiFeatureLabels[event.feature];
  }
  return event.category === "OCR_SERVICE" ? "Xử lý tài liệu" : "Gọi mô hình AI";
}

export function formatUsageTarget(event: UsageEvent) {
  if (event.category !== "AI_MODEL") return null;
  return event.targetLabel?.trim() || "Chưa xác định";
}

export function formatUsageDuration(value: number | null, status?: UsageEvent["status"]) {
  if (value === null) {
    return status === "RUNNING" ? "Đang xử lý" : "Chưa ghi nhận";
  }
  if (value < 1_000) return `${formatNumber(value)} ms`;
  if (value < 60_000) {
    return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value / 1_000)} giây`;
  }
  const totalSeconds = Math.round(value / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds === 0 ? `${minutes} phút` : `${minutes} phút ${seconds} giây`;
}

export function formatReasoningEffort(event: UsageEvent) {
  if (event.category !== "AI_MODEL") return "Không áp dụng";
  if (event.reasoningEffort) {
    return reasoningEffortLabels[event.reasoningEffort] ?? event.reasoningEffort;
  }
  return event.operation ? "Mặc định model" : "Chưa ghi nhận";
}

export function formatVnd(value: number) {
  const amount = new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(value);

  return `${amount} VNĐ`;
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
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
