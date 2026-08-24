"use client";

export type AdminAiEstimatedCost = {
  available: boolean;
  inputUpperBoundVnd: number | null;
  outputUpperBoundVnd: number | null;
  upperBoundVnd: number | null;
};

export type AdminAiRequestStatistic = {
  label: string;
  value: string;
  onClick?: () => void;
};

export function AdminAiRequestStatistics({
  details,
  estimatedCost,
  note,
}: {
  details: AdminAiRequestStatistic[];
  estimatedCost: AdminAiEstimatedCost;
  note?: string;
}) {
  const costDetails: AdminAiRequestStatistic[] = [
    {
      label: "Chi phí input ước tính",
      value: formatEstimatedCost(
        estimatedCost.available,
        estimatedCost.inputUpperBoundVnd,
      ),
    },
    {
      label: "Chi phí output tối đa",
      value: formatEstimatedCost(
        estimatedCost.available,
        estimatedCost.outputUpperBoundVnd,
      ),
    },
    {
      label: "Tổng chi phí tối đa",
      value: formatEstimatedCost(estimatedCost.available, estimatedCost.upperBoundVnd),
    },
  ];

  return (
    <div className="rounded-xl border border-[var(--theme-border)] bg-[var(--theme-bg-subtle)] p-3 text-sm">
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {[...details, ...costDetails].map((detail) => (
          <div key={detail.label}>
            <dt className="font-bold text-[var(--theme-text-muted)]">{detail.label}</dt>
            <dd className="mt-0.5 break-words font-extrabold text-[var(--theme-text-strong)]">
              {detail.onClick ? (
                <button
                  className="text-left text-[var(--theme-primary)] underline decoration-transparent underline-offset-2 transition hover:decoration-current focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
                  onClick={detail.onClick}
                  type="button"
                >
                  {detail.value} · Xem chi tiết
                </button>
              ) : (
                detail.value
              )}
            </dd>
          </div>
        ))}
      </dl>
      {note ? (
        <p className="mt-3 border-t border-[var(--theme-border)] pt-3 text-xs font-bold leading-5 text-[var(--theme-text-muted)]">
          {note}
        </p>
      ) : null}
    </div>
  );
}

function formatEstimatedCost(available: boolean, value: number | null) {
  return available && value !== null
    ? `≈ ${value.toLocaleString("vi-VN")} ₫`
    : "Chưa đủ bảng giá để tính";
}
