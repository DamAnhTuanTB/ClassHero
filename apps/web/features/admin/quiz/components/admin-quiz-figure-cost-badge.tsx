import { formatVnd } from "@/features/admin/ai-settings/utils/provider-operations-formatters";

export function AdminQuizFigureCostBadge({
  costVnd,
}: {
  costVnd: number | null | undefined;
}) {
  if (costVnd === null || costVnd === undefined) return null;

  return (
    <div className="mt-3 flex justify-end">
      <span
        className="inline-flex whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 shadow-sm dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
        data-testid="admin-quiz-figure-openai-cost"
        title="Chi phí OpenAI thực tế của lượt tạo ảnh này"
      >
        OpenAI · {formatVnd(costVnd)}
      </span>
    </div>
  );
}
