"use client";

import { Pipette, X } from "lucide-react";
import { useMemo, type KeyboardEvent, type PointerEvent } from "react";

type RgbColor = {
  blue: number;
  green: number;
  red: number;
};

type HsvColor = {
  hue: number;
  saturation: number;
  value: number;
};

export function QuizCustomColorDialog({
  color,
  onCancel,
  onChange,
  onConfirm,
}: {
  color: string;
  onCancel: () => void;
  onChange: (color: string) => void;
  onConfirm: () => void;
}) {
  const rgb = useMemo(() => hexToRgb(color), [color]);
  const hsv = useMemo(() => rgbToHsv(rgb), [rgb]);

  const updateSaturationAndValue = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const saturation = clamp(
      (event.clientX - bounds.left) / Math.max(bounds.width, 1),
      0,
      1,
    );
    const value = clamp(
      1 - (event.clientY - bounds.top) / Math.max(bounds.height, 1),
      0,
      1,
    );
    onChange(hsvToHex({ ...hsv, saturation, value }));
  };

  const updateRgbChannel = (channel: keyof RgbColor, rawValue: string) => {
    const numericValue = Number.parseInt(rawValue.replace(/\D/g, ""), 10);
    onChange(
      rgbToHex({
        ...rgb,
        [channel]: clamp(Number.isFinite(numericValue) ? numericValue : 0, 0, 255),
      }),
    );
  };

  const adjustColorByKeyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    const nextHsv = { ...hsv };

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      nextHsv.saturation = clamp(
        hsv.saturation + (event.key === "ArrowRight" ? step : -step),
        0,
        1,
      );
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      nextHsv.value = clamp(hsv.value + (event.key === "ArrowUp" ? step : -step), 0, 1);
    } else {
      return;
    }

    event.preventDefault();
    onChange(hsvToHex(nextHsv));
  };

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label="Màu tùy chỉnh"
      className="flex max-h-[min(34rem,calc(100dvh-2rem))] w-full max-w-[23rem] flex-col overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-2xl"
    >
      <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-[var(--theme-border)] px-4">
        <Pipette className="h-4 w-4 text-[var(--theme-primary)]" aria-hidden="true" />
        <h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
          Màu tùy chỉnh
        </h3>
        <button
          type="button"
          aria-label="Đóng bảng màu tùy chỉnh"
          onClick={onCancel}
          className="ml-auto grid h-9 w-9 place-items-center rounded-lg text-[var(--theme-text-muted)] transition hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div
          role="slider"
          tabIndex={0}
          aria-label="Độ bão hòa và độ sáng"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={Math.round(hsv.value * 100)}
          aria-valuetext={`${Math.round(hsv.saturation * 100)}% bão hòa, ${Math.round(hsv.value * 100)}% độ sáng`}
          onKeyDown={adjustColorByKeyboard}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            updateSaturationAndValue(event);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              updateSaturationAndValue(event);
            }
          }}
          className="relative aspect-[4/3] w-full cursor-crosshair touch-none overflow-hidden rounded-lg border border-[var(--theme-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
          style={{ backgroundColor: `hsl(${hsv.hue} 100% 50%)` }}
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(to_right,#fff,transparent)]"
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-[linear-gradient(to_top,#000,transparent)]"
          />
          <span
            aria-hidden="true"
            className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(15,23,42,0.72)]"
            style={{
              left: `${hsv.saturation * 100}%`,
              top: `${(1 - hsv.value) * 100}%`,
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <span
            aria-label={`Màu đang chọn ${color.toUpperCase()}`}
            className="h-11 w-11 shrink-0 rounded-full border border-[var(--theme-border)] shadow-sm"
            style={{ backgroundColor: color }}
          />
          <input
            type="range"
            min="0"
            max="359"
            value={Math.round(hsv.hue)}
            aria-label="Sắc độ màu"
            onChange={(event) =>
              onChange(
                hsvToHex({
                  ...hsv,
                  hue: Number.parseInt(event.target.value, 10),
                }),
              )
            }
            className="h-4 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-[linear-gradient(to_right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-[var(--theme-text-strong)] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-[var(--theme-text-strong)] [&::-webkit-slider-thumb]:shadow"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["red", "R"],
              ["green", "G"],
              ["blue", "B"],
            ] as const
          ).map(([channel, label]) => (
            <label
              key={channel}
              className="grid gap-1.5 text-center text-xs font-bold text-[var(--theme-text-muted)]"
            >
              <input
                type="text"
                inputMode="numeric"
                value={rgb[channel]}
                aria-label={`Giá trị màu ${label}`}
                onChange={(event) => updateRgbChannel(channel, event.target.value)}
                className="h-10 min-w-0 rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-2 text-center text-base font-bold text-[var(--theme-text-strong)] outline-none transition focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary-subtle)]"
              />
              {label}
            </label>
          ))}
        </div>

        <div className="rounded-lg bg-[var(--theme-surface-soft)] px-3 py-2 text-center font-mono text-sm font-bold uppercase text-[var(--theme-text-strong)]">
          {color}
        </div>
      </div>

      <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-[var(--theme-border)] p-3">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 whitespace-nowrap rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 text-sm font-extrabold text-[var(--theme-text-strong)] transition hover:bg-[var(--theme-surface-soft)]"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="theme-button-primary h-10 whitespace-nowrap rounded-lg px-4 text-sm font-extrabold"
        >
          OK
        </button>
      </footer>
    </section>
  );
}

function hexToRgb(color: string): RgbColor {
  const normalized = /^#[\da-f]{6}$/i.test(color) ? color : "#000000";
  return {
    red: Number.parseInt(normalized.slice(1, 3), 16),
    green: Number.parseInt(normalized.slice(3, 5), 16),
    blue: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex({ blue, green, red }: RgbColor) {
  return `#${[red, green, blue]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function rgbToHsv({ blue, green, red }: RgbColor): HsvColor {
  const normalizedRed = red / 255;
  const normalizedGreen = green / 255;
  const normalizedBlue = blue / 255;
  const max = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
  const min = Math.min(normalizedRed, normalizedGreen, normalizedBlue);
  const delta = max - min;
  let hue = 0;

  if (delta > 0) {
    if (max === normalizedRed) {
      hue = 60 * (((normalizedGreen - normalizedBlue) / delta) % 6);
    } else if (max === normalizedGreen) {
      hue = 60 * ((normalizedBlue - normalizedRed) / delta + 2);
    } else {
      hue = 60 * ((normalizedRed - normalizedGreen) / delta + 4);
    }
  }

  return {
    hue: hue < 0 ? hue + 360 : hue,
    saturation: max === 0 ? 0 : delta / max,
    value: max,
  };
}

function hsvToHex({ hue, saturation, value }: HsvColor) {
  const chroma = value * saturation;
  const hueSection = hue / 60;
  const intermediate = chroma * (1 - Math.abs((hueSection % 2) - 1));
  const offset = value - chroma;
  let channels: [number, number, number];

  if (hueSection < 1) {
    channels = [chroma, intermediate, 0];
  } else if (hueSection < 2) {
    channels = [intermediate, chroma, 0];
  } else if (hueSection < 3) {
    channels = [0, chroma, intermediate];
  } else if (hueSection < 4) {
    channels = [0, intermediate, chroma];
  } else if (hueSection < 5) {
    channels = [intermediate, 0, chroma];
  } else {
    channels = [chroma, 0, intermediate];
  }

  return rgbToHex({
    red: (channels[0] + offset) * 255,
    green: (channels[1] + offset) * 255,
    blue: (channels[2] + offset) * 255,
  });
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
