"use client";

import { CaseSensitive, MoveHorizontal, MoveVertical, Radius } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import {
  STEM_FIGURE_SCALE_PERCENT_DEFAULT,
  STEM_FIGURE_SCALE_PERCENT_MAX,
  STEM_FIGURE_SCALE_PERCENT_MIN,
  STEM_FIGURE_TEXT_OFFSET_DEFAULT,
  STEM_FIGURE_TEXT_OFFSET_MAX,
  STEM_FIGURE_TEXT_OFFSET_MIN,
  STEM_FIGURE_ANGLE_RADIUS_PT_DEFAULT,
  STEM_FIGURE_ANGLE_RADIUS_PT_MAX,
  STEM_FIGURE_ANGLE_RADIUS_PT_MIN,
  type StemFigureTextAdjustment,
  type StemFigureTextAdjustmentTarget,
} from "@/lib/stem-figure-source-actions";

type AdjustmentDraft = {
  target: StemFigureTextAdjustmentTarget;
  value: number;
};

export function StemFigureTextAdjustmentControls({
  adjustment,
  disabled,
  onCommit,
  onDraftChange,
}: {
  adjustment: StemFigureTextAdjustment;
  disabled: boolean;
  onCommit: (target: StemFigureTextAdjustmentTarget, value: number) => void;
  onDraftChange: (draft: AdjustmentDraft | null) => void;
}) {
  return (
    <div className="mt-2.5 space-y-2 border-t border-[var(--theme-border)] pt-2.5">
      <CompactSlider
        defaultValue={STEM_FIGURE_TEXT_OFFSET_DEFAULT}
        disabled={disabled}
        icon={MoveHorizontal}
        label="Ngang (x)"
        max={STEM_FIGURE_TEXT_OFFSET_MAX}
        min={STEM_FIGURE_TEXT_OFFSET_MIN}
        onCommit={(value) => onCommit("X", value)}
        onDraftChange={(value) =>
          onDraftChange(value === null ? null : { target: "X", value })
        }
        suffix="pt"
        value={adjustment.xOffsetPt}
      />
      <CompactSlider
        defaultValue={STEM_FIGURE_TEXT_OFFSET_DEFAULT}
        disabled={disabled}
        icon={MoveVertical}
        label="Dọc (y)"
        max={STEM_FIGURE_TEXT_OFFSET_MAX}
        min={STEM_FIGURE_TEXT_OFFSET_MIN}
        onCommit={(value) => onCommit("Y", value)}
        onDraftChange={(value) =>
          onDraftChange(value === null ? null : { target: "Y", value })
        }
        suffix="pt"
        value={adjustment.yOffsetPt}
      />
      <CompactSlider
        defaultValue={STEM_FIGURE_SCALE_PERCENT_DEFAULT}
        disabled={disabled}
        icon={CaseSensitive}
        label="Cỡ chữ"
        max={STEM_FIGURE_SCALE_PERCENT_MAX}
        min={STEM_FIGURE_SCALE_PERCENT_MIN}
        onCommit={(value) => onCommit("FONT_SIZE", value)}
        onDraftChange={(value) =>
          onDraftChange(value === null ? null : { target: "FONT_SIZE", value })
        }
        suffix="%"
        value={adjustment.fontSizePercentage}
      />
      {adjustment.angleRadiusPt !== undefined ? (
        <CompactSlider
          defaultValue={STEM_FIGURE_ANGLE_RADIUS_PT_DEFAULT}
          disabled={disabled}
          icon={Radius}
          label="Khoảng cách cung tới đỉnh"
          max={STEM_FIGURE_ANGLE_RADIUS_PT_MAX}
          min={STEM_FIGURE_ANGLE_RADIUS_PT_MIN}
          onCommit={(value) => onCommit("ANGLE_RADIUS", value)}
          onDraftChange={(value) =>
            onDraftChange(value === null ? null : { target: "ANGLE_RADIUS", value })
          }
          suffix="pt"
          value={adjustment.angleRadiusPt}
        />
      ) : null}
    </div>
  );
}

function CompactSlider({
  defaultValue,
  disabled,
  icon: Icon,
  label,
  max,
  min,
  onCommit,
  onDraftChange,
  suffix,
  value,
}: {
  defaultValue: number;
  disabled: boolean;
  icon: typeof MoveHorizontal;
  label: string;
  max: number;
  min: number;
  onCommit: (value: number) => void;
  onDraftChange: (value: number | null) => void;
  suffix: "%" | "pt";
  value: number;
}) {
  const id = useId();
  const [draftValue, setDraftValue] = useState(value);
  const draftValueRef = useRef(value);
  const submittedValueRef = useRef(value);

  useEffect(() => {
    draftValueRef.current = value;
    submittedValueRef.current = value;
    setDraftValue(value);
  }, [value]);

  function commitDraft() {
    const nextValue = draftValueRef.current;
    if (nextValue === value || nextValue === submittedValueRef.current) return;
    submittedValueRef.current = nextValue;
    onCommit(nextValue);
  }

  const filledPercent = ((draftValue - min) / (max - min)) * 100;
  const output = suffix === "%" ? `${draftValue}%` : formatOffset(draftValue);

  return (
    <div className="rounded-md border border-[var(--theme-border)] bg-[var(--theme-surface)] px-2.5 py-2">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden />
        <label
          className="text-[11px] font-extrabold text-[var(--theme-text-strong)]"
          htmlFor={id}
        >
          {label}
        </label>
        <output
          className="ml-auto rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-extrabold tabular-nums text-sky-700 dark:bg-sky-950/60 dark:text-sky-200"
          htmlFor={id}
        >
          {output}
        </output>
      </div>
      <input
        aria-valuetext={suffix === "%" ? `${draftValue}%` : formatOffset(draftValue)}
        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-60 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-sky-600 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-sky-600 [&::-webkit-slider-thumb]:shadow"
        disabled={disabled}
        id={id}
        max={max}
        min={min}
        onBlur={commitDraft}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          draftValueRef.current = nextValue;
          setDraftValue(nextValue);
          onDraftChange(nextValue === value ? null : nextValue);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") commitDraft();
        }}
        onPointerUp={commitDraft}
        step={1}
        style={{
          background: `linear-gradient(to right, rgb(2 132 199) 0%, rgb(2 132 199) ${filledPercent}%, var(--theme-border) ${filledPercent}%, var(--theme-border) 100%)`,
        }}
        type="range"
        value={draftValue}
      />
      <div className="mt-0.5 flex justify-between text-[9px] font-bold tabular-nums text-[var(--theme-text-muted)]">
        <span>{formatLimit(min, suffix)}</span>
        <span>{formatLimit(defaultValue, suffix)}</span>
        <span>{formatLimit(max, suffix)}</span>
      </div>
    </div>
  );
}

function formatOffset(value: number) {
  if (value > 0) return `+${value} pt`;
  if (value < 0) return `−${Math.abs(value)} pt`;
  return "0 pt";
}

function formatLimit(value: number, suffix: "%" | "pt") {
  if (suffix === "%") return `${value}%`;
  return value > 0 ? `+${value}` : value.toString();
}
