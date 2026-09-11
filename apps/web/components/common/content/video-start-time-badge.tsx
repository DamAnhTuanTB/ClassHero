import { Clock3 } from "lucide-react";

export function VideoStartTimeBadge({
  disabled = false,
  endSeconds,
  labelPrefix = "Bắt đầu",
  offsetSeconds = 0,
  seconds,
  showOriginalTime = false,
  onSeek,
}: {
  disabled?: boolean;
  endSeconds?: number;
  labelPrefix?: string;
  offsetSeconds?: number;
  seconds?: number;
  showOriginalTime?: boolean;
  onSeek?: (seconds: number) => void;
}) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  const playbackSeconds = Math.max(
    0,
    seconds - (Number.isFinite(offsetSeconds) ? Math.max(0, offsetSeconds) : 0),
  );
  const label = formatVideoStartTime(playbackSeconds);
  const originalLabel = formatVideoStartTime(seconds);
  const hasEndTime =
    typeof endSeconds === "number" &&
    Number.isFinite(endSeconds) &&
    endSeconds >= seconds;
  const playbackEndSeconds = hasEndTime
    ? Math.max(
        playbackSeconds,
        endSeconds - (Number.isFinite(offsetSeconds) ? Math.max(0, offsetSeconds) : 0),
      )
    : undefined;
  const endLabel =
    playbackEndSeconds === undefined
      ? undefined
      : formatVideoStartTime(playbackEndSeconds);

  const className = `ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg border-[1.5px] bg-white/70 px-2 py-1 text-[11px] font-bold normal-case tracking-normal sm:rounded-md sm:border dark:bg-slate-950/50 ${
    disabled
      ? "cursor-not-allowed border-dashed border-slate-300 text-slate-400 opacity-80 dark:border-slate-700 dark:text-slate-500"
      : "border-slate-400 text-slate-600 sm:border-slate-300 dark:border-slate-500 dark:text-slate-300 sm:dark:border-slate-600"
  }`;
  const content = (
    <>
      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
      {endLabel === undefined ? (
        <span data-video-start-label-prefix>{labelPrefix} </span>
      ) : null}
      {label}
      {endLabel === undefined ? null : (
        <>
          <span aria-hidden="true">→</span>
          {endLabel}
        </>
      )}
      {showOriginalTime ? (
        <>
          <span>·</span>
          <span>Gốc {originalLabel}</span>
        </>
      ) : null}
    </>
  );

  return onSeek || disabled ? (
    <button
      type="button"
      className={`${className} ${
        disabled
          ? ""
          : "transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-blue-950/50 dark:hover:text-blue-300"
      }`}
      data-video-original-start-seconds={showOriginalTime ? seconds : undefined}
      data-video-end-seconds={playbackEndSeconds}
      data-video-start-seconds={playbackSeconds}
      data-video-time-seconds={playbackSeconds}
      disabled={disabled}
      onClick={() => onSeek?.(playbackSeconds)}
      title={
        disabled
          ? endLabel === undefined
            ? `${labelPrefix} ${label}`
            : `Nội dung từ ${label} đến ${endLabel}`
          : endLabel !== undefined
            ? `Nội dung từ ${label} đến ${endLabel} · Xem lại từ ${label}`
            : showOriginalTime
              ? `Tua video đến ${label} (gốc ${originalLabel})`
              : `Tua video đến ${label}`
      }
    >
      {content}
    </button>
  ) : (
    <span
      className={className}
      data-video-end-seconds={playbackEndSeconds}
      data-video-original-start-seconds={showOriginalTime ? seconds : undefined}
      data-video-start-seconds={playbackSeconds}
      data-video-time-seconds={playbackSeconds}
      title={
        endLabel !== undefined
          ? `Nội dung từ ${label} đến ${endLabel}`
          : showOriginalTime
            ? `Nội dung bắt đầu tại ${label} (gốc ${originalLabel})`
            : `Nội dung bắt đầu tại ${label}`
      }
    >
      {content}
    </span>
  );
}

function formatVideoStartTime(seconds: number) {
  const wholeSeconds = Math.floor(Math.max(0, seconds));
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainder = wholeSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}
