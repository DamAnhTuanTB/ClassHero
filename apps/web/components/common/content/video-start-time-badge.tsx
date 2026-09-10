import { Clock3 } from "lucide-react";

export function VideoStartTimeBadge({
  seconds,
  onSeek,
}: {
  seconds?: number;
  onSeek?: (seconds: number) => void;
}) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainder = wholeSeconds % 60;
  const label =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
      : `${minutes}:${String(remainder).padStart(2, "0")}`;

  const className =
    "ml-auto inline-flex shrink-0 items-center gap-1 rounded-md border border-current/15 bg-white/70 px-2 py-1 text-[11px] font-bold normal-case tracking-normal text-slate-600 dark:bg-slate-950/50 dark:text-slate-300";
  const content = (
    <>
      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
      Bắt đầu {label}
    </>
  );

  return onSeek ? (
    <button
      type="button"
      className={`${className} transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-blue-950/50 dark:hover:text-blue-300`}
      data-video-start-seconds={seconds}
      onClick={() => onSeek(seconds)}
      title={`Tua video đến ${label}`}
    >
      {content}
    </button>
  ) : (
    <span
      className={className}
      data-video-start-seconds={seconds}
      title={`Nội dung bắt đầu tại ${label}`}
    >
      {content}
    </span>
  );
}
