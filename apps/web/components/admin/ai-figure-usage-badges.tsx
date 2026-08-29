import { Database } from "lucide-react";

import { formatVnd } from "@/features/admin/ai-settings/utils/provider-operations-formatters";
import { cn } from "@/lib/utils";

export function AdminAiFigureUsageBadges({
  cachedInputTokens,
  className,
  costVnd,
  testIdPrefix = "admin-ai-figure",
}: {
  cachedInputTokens: number | null | undefined;
  className?: string;
  costVnd: number | null | undefined;
  testIdPrefix?: string;
}) {
  const cacheHit = typeof cachedInputTokens === "number" && cachedInputTokens > 0;
  const hasCost = costVnd !== null && costVnd !== undefined;

  if (!cacheHit && !hasCost) return null;

  return (
    <div className={cn("mt-3 flex flex-wrap justify-end gap-2", className)}>
      {cacheHit ? (
        <span
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 shadow-sm dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200"
          data-testid={`${testIdPrefix}-openai-cache`}
          title={`Đã tái sử dụng ${cachedInputTokens.toLocaleString("vi-VN")} token đầu vào từ cache OpenAI`}
        >
          <Database className="h-3.5 w-3.5" aria-hidden="true" />
          Cache OpenAI
        </span>
      ) : null}
      {hasCost ? (
        <span
          className="inline-flex whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 shadow-sm dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
          data-testid={`${testIdPrefix}-openai-cost`}
          title="Chi phí OpenAI thực tế của lượt tạo ảnh này"
        >
          OpenAI · {formatVnd(costVnd)}
        </span>
      ) : null}
    </div>
  );
}
