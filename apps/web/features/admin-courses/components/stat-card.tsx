import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "sky" | "emerald" | "amber";
}) {
  const toneClass = {
    sky: "bg-sky-50 text-sky-700 border-sky-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
  }[tone];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div
        className={cn(
          "inline-flex rounded-lg border px-2 py-1 text-xs font-bold",
          toneClass,
        )}
      >
        {label}
      </div>
      <p className="mt-3 text-3xl font-extrabold text-slate-950">{value}</p>
    </div>
  );
}
