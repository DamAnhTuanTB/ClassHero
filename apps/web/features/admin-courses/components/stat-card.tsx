import { cn } from "@/lib/utils";

export function StatCard({
  isDarkTheme = false,
  label,
  value,
  tone,
}: {
  isDarkTheme?: boolean;
  label: string;
  value: number;
  tone: "sky" | "emerald" | "amber";
}) {
  const toneClass = isDarkTheme
    ? {
        sky: "bg-sky-500/10 text-sky-200 border-sky-500/20",
        emerald: "bg-emerald-500/10 text-emerald-200 border-emerald-500/20",
        amber: "bg-amber-500/10 text-amber-200 border-amber-500/20",
      }[tone]
    : {
        sky: "bg-sky-50 text-sky-700 border-sky-100",
        emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
        amber: "bg-amber-50 text-amber-700 border-amber-100",
      }[tone];

  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        isDarkTheme
          ? "border-slate-800 bg-slate-900"
          : "border-slate-200 bg-white",
      )}
    >
      <div
        className={cn(
          "inline-flex rounded-lg border px-2 py-1 text-xs font-bold",
          toneClass,
        )}
      >
        {label}
      </div>
      <p
        className={cn(
          "mt-3 text-3xl font-extrabold",
          isDarkTheme ? "text-white" : "text-slate-950",
        )}
      >
        {value}
      </p>
    </div>
  );
}
