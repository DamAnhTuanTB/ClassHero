"use client";

import {
  memo,
  type ChangeEvent,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {
  type Control,
  type UseFormGetValues,
  type UseFormRegister,
  type UseFormSetValue,
  useFormState,
} from "react-hook-form";
import { Play, Trash2 } from "lucide-react";
import {
  transcriptSegmentSchema,
  transcriptTimestampPattern,
  type TranscriptFormValues,
  validateTranscriptField,
} from "@/features/admin/lessons/schemas/lesson-video-transcript-schema";
import { cn } from "@/lib/utils";

interface LessonVideoTranscriptRowProps {
  active: boolean;
  control: Control<TranscriptFormValues>;
  getValues: UseFormGetValues<TranscriptFormValues>;
  index: number;
  isBusy: boolean;
  onPlayFromTime: (segment: TranscriptFormValues["segments"][number] | undefined) => void;
  onRemove: (index: number) => void;
  register: UseFormRegister<TranscriptFormValues>;
  rowRefs: MutableRefObject<Record<number, HTMLDivElement | null>>;
  setTimelineRevision: Dispatch<SetStateAction<number>>;
  setValue: UseFormSetValue<TranscriptFormValues>;
  striped: boolean;
  timeString: string;
}

function LessonVideoTranscriptRowComponent({
  active,
  control,
  getValues,
  index,
  isBusy,
  onPlayFromTime,
  onRemove,
  register,
  rowRefs,
  setTimelineRevision,
  setValue,
  striped,
  timeString,
}: LessonVideoTranscriptRowProps) {
  const { errors } = useFormState({
    control,
    name: [`segments.${index}.timeString`, `segments.${index}.text`],
  });

  return (
    <div
      ref={(element) => {
        rowRefs.current[index] = element;
      }}
      aria-current={active ? "true" : undefined}
      className={cn(
        "grid gap-3 border-b border-l-4 border-b-[var(--theme-border)] border-l-transparent p-4 transition-[background-color,border-color,box-shadow] duration-200 last:border-b-0 sm:grid-cols-[7.5rem_minmax(0,1fr)_2.25rem]",
        active
          ? "border-l-[var(--theme-primary)] bg-[var(--theme-primary)]/10 shadow-sm ring-1 ring-inset ring-[var(--theme-primary)]/25"
          : striped && "bg-[var(--theme-surface-sunken)]/65",
      )}
    >
      <div>
        <label
          htmlFor={`transcript-time-${index}`}
          className={cn(
            "mb-1.5 block text-xs font-semibold",
            active ? "text-[var(--theme-primary)]" : "text-[var(--theme-text-muted)]",
          )}
        >
          {active ? "Đang phát" : "Thời gian"}
        </label>
        <input
          id={`transcript-time-${index}`}
          type="text"
          inputMode="numeric"
          {...register(`segments.${index}.timeString`, {
            validate: (value) =>
              validateTranscriptField(transcriptSegmentSchema.shape.timeString, value),
            onChange: (event: ChangeEvent<HTMLInputElement>) => {
              const nextTimeString = event.target.value;
              setValue(
                `segments.${index}.time`,
                transcriptTimestampPattern.test(nextTimeString)
                  ? parseTranscriptTimestamp(nextTimeString)
                  : undefined,
                { shouldDirty: false },
              );
              setTimelineRevision((revision) => revision + 1);
            },
          })}
          className={cn(
            "h-10 w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-primary)]/10 px-3 text-sm font-bold text-[var(--theme-primary)] outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/20",
            active &&
              "border-[var(--theme-primary)] ring-2 ring-[var(--theme-primary)]/20",
          )}
        />
        {errors.segments?.[index]?.timeString && (
          <p className="mt-1 text-xs text-[var(--theme-danger)]">
            {errors.segments[index]?.timeString?.message}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor={`transcript-text-${index}`}
          className="mb-1.5 block text-xs font-semibold text-[var(--theme-text-muted)]"
        >
          Nội dung
        </label>
        <textarea
          id={`transcript-text-${index}`}
          rows={2}
          {...register(`segments.${index}.text`, {
            validate: (value) =>
              validateTranscriptField(transcriptSegmentSchema.shape.text, value),
          })}
          className="min-h-20 w-full resize-y rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] px-3 py-2 text-sm leading-6 text-[var(--theme-text-strong)] outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/20"
        />
        {errors.segments?.[index]?.text && (
          <p className="mt-1 text-xs text-[var(--theme-danger)]">
            {errors.segments[index]?.text?.message}
          </p>
        )}
      </div>

      <div className="flex items-start gap-2 sm:mt-6 sm:flex-col">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="theme-button-danger flex h-9 w-9 items-center justify-center rounded-lg"
          aria-label={`Xóa đoạn transcript ${index + 1}`}
          title="Xóa đoạn transcript"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => onPlayFromTime(getValues(`segments.${index}`))}
          disabled={isBusy || !transcriptTimestampPattern.test(timeString)}
          className="theme-button-neutral flex h-9 w-9 items-center justify-center rounded-lg text-[var(--theme-primary)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={`Phát video từ mốc ${timeString || index + 1}`}
          title="Phát video từ mốc này"
        >
          <Play className="h-4 w-4 fill-current" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export const LessonVideoTranscriptRow = memo(LessonVideoTranscriptRowComponent);

function parseTranscriptTimestamp(value: string) {
  return value
    .split(":")
    .map(Number)
    .reduce((total, part) => total * 60 + part, 0);
}
