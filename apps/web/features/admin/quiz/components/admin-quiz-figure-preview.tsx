import { Loader2 } from "lucide-react";
import { readStemFigureDisplayScale } from "@learning-path/shared";

import { AdminFigureCandidateProgress } from "@/components/admin/admin-figure-candidate-progress";
import { AdminAiFigureUsageBadges } from "@/components/admin/ai-figure-usage-badges";
import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";
import type { AdminQuizFigure } from "@/features/admin/quiz/api/admin-quiz-api";
import { AdminQuizFigureActionFrame } from "@/features/admin/quiz/components/admin-quiz-figure-action-frame";
import { getStemFigureDisplayPercent } from "@/lib/stem-figure-display";
import { cn } from "@/lib/utils";

const PROCESSING_STATUSES = new Set<AdminQuizFigure["status"]>([
  "QUEUED",
  "RENDERING",
  "REPAIRING",
]);

export function AdminQuizFigurePreview({
  figure,
  questionId,
  role,
  setId,
}: {
  figure: AdminQuizFigure;
  questionId: string;
  role: "QUESTION" | "SOLUTION";
  setId: string;
}) {
  const imageUrl = figure.currentRevision?.deliveryFile?.publicUrl;
  const roleLabel = role === "QUESTION" ? "Hình đề" : "Hình lời giải";
  const isProcessing = PROCESSING_STATUSES.has(figure.status);
  const displayPercent = getStemFigureDisplayPercent(
    figure.currentRevision?.displayScale ??
      readStemFigureDisplayScale(figure.currentRevision?.latexSource),
  );

  if (imageUrl) {
    return (
      <AdminQuizFigureActionFrame figure={figure} questionId={questionId} setId={setId}>
        <figure
          aria-label={`${roleLabel} Quiz`}
          className="mx-auto w-full max-w-2xl rounded-xl border border-[var(--theme-border)] bg-white p-3 shadow-sm dark:bg-white"
          data-testid={`admin-quiz-${role.toLowerCase()}-figure`}
          style={displayPercent === null ? undefined : { width: `${displayPercent}%` }}
        >
          <img
            src={imageUrl}
            alt={figure.currentRevision?.altText || roleLabel}
            className="mx-auto max-h-[28rem] w-full object-contain"
            decoding="async"
            loading="lazy"
          />
          {figure.currentRevision?.caption ? (
            <figcaption className="mt-2 text-center text-sm font-medium leading-relaxed text-slate-600">
              <MathpixMarkdownRenderer content={figure.currentRevision.caption} />
            </figcaption>
          ) : null}
          <AdminAiFigureUsageBadges
            cachedInputTokens={figure.openAiCachedInputTokens}
            costVnd={figure.openAiGenerationCostVnd}
            testIdPrefix="admin-quiz-figure"
          />
        </figure>
        {isProcessing ? <AdminFigureCandidateProgress /> : null}
      </AdminQuizFigureActionFrame>
    );
  }

  return (
    <AdminQuizFigureActionFrame figure={figure} questionId={questionId} setId={setId}>
      <div
        aria-live="polite"
        className={cn(
          "flex min-h-20 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold",
          isProcessing
            ? "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
            : "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
        )}
        data-testid={`admin-quiz-${role.toLowerCase()}-figure-status`}
        role={isProcessing ? "status" : "alert"}
      >
        {isProcessing ? (
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
        ) : null}
        <span>
          {isProcessing
            ? `${roleLabel} đang được tạo...`
            : `${roleLabel} chưa tạo thành công. Hãy kiểm tra hoặc tạo lại hình.`}
        </span>
      </div>
    </AdminQuizFigureActionFrame>
  );
}
