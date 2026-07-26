"use client";

import type { Editor } from "@tiptap/react";
import { Check, Palette, Pipette } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { QuizCustomColorDialog } from "@/features/admin/quiz/components/quiz-custom-color-dialog";
import { cn } from "@/lib/utils";

const googleDocsTextColorPalette = [
  [
    "#000000",
    "#434343",
    "#666666",
    "#999999",
    "#b7b7b7",
    "#cccccc",
    "#d9d9d9",
    "#efefef",
    "#f3f3f3",
    "#ffffff",
  ],
  [
    "#980000",
    "#ff0000",
    "#ff9900",
    "#ffff00",
    "#00ff00",
    "#00ffff",
    "#4a86e8",
    "#0000ff",
    "#9900ff",
    "#ff00ff",
  ],
  [
    "#e6b8af",
    "#f4cccc",
    "#fce5cd",
    "#fff2cc",
    "#d9ead3",
    "#d0e0e3",
    "#c9daf8",
    "#cfe2f3",
    "#d9d2e9",
    "#ead1dc",
  ],
  [
    "#dd7e6b",
    "#ea9999",
    "#f9cb9c",
    "#ffe599",
    "#b6d7a8",
    "#a2c4c9",
    "#a4c2f4",
    "#9fc5e8",
    "#b4a7d6",
    "#d5a6bd",
  ],
  [
    "#cc4125",
    "#e06666",
    "#f6b26b",
    "#ffd966",
    "#93c47d",
    "#76a5af",
    "#6d9eeb",
    "#6fa8dc",
    "#8e7cc3",
    "#c27ba0",
  ],
  [
    "#a61c00",
    "#cc0000",
    "#e69138",
    "#f1c232",
    "#6aa84f",
    "#45818e",
    "#3c78d8",
    "#3d85c6",
    "#674ea7",
    "#a64d79",
  ],
  [
    "#85200c",
    "#990000",
    "#b45f06",
    "#bf9000",
    "#38761d",
    "#134f5c",
    "#1155cc",
    "#0b5394",
    "#351c75",
    "#741b47",
  ],
  [
    "#5b0f00",
    "#660000",
    "#783f04",
    "#7f6000",
    "#274e13",
    "#0c343d",
    "#1c4587",
    "#073763",
    "#20124d",
    "#4c1130",
  ],
] as const;

export function QuizTextColorPicker({
  disabled,
  editor,
}: {
  disabled: boolean;
  editor: Editor | null;
}) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customDraftColor, setCustomDraftColor] = useState("#000000");
  const [popoverLayout, setPopoverLayout] = useState<{
    left: number;
    maxHeight: number;
    top: number;
  } | null>(null);
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const activeColor = readActiveTextColor(editor);

  useEffect(() => {
    if (open) {
      setCustomDraftColor(isHexColor(activeColor) ? activeColor : "#000000");
    }
  }, [activeColor, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target) &&
        !panelRef.current?.contains(event.target)
      ) {
        setOpen(false);
        setCustomOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setCustomOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !triggerRef.current) {
      setPopoverLayout(null);
      return;
    }

    const trigger = triggerRef.current;
    const updateLayout = () => {
      const bounds = trigger.getBoundingClientRect();
      const viewportMargin = 8;
      const panelWidth = window.innerWidth >= 640 ? 312 : 272;
      const spaceBelow = window.innerHeight - bounds.bottom - viewportMargin * 2;
      const spaceAbove = bounds.top - viewportMargin * 2;
      const placeAbove = spaceBelow < 260 && spaceAbove > spaceBelow;
      const availableHeight = Math.max(180, placeAbove ? spaceAbove : spaceBelow);

      setPopoverLayout({
        left: Math.min(
          Math.max(bounds.left, viewportMargin),
          window.innerWidth - panelWidth - viewportMargin,
        ),
        maxHeight: availableHeight,
        top: placeAbove
          ? viewportMargin
          : Math.min(bounds.bottom + viewportMargin, window.innerHeight - viewportMargin),
      });
    };

    setPortalTarget(trigger.closest("[data-admin-theme]") ?? document.body);
    updateLayout();
    window.addEventListener("resize", updateLayout);
    window.addEventListener("scroll", updateLayout, true);
    return () => {
      window.removeEventListener("resize", updateLayout);
      window.removeEventListener("scroll", updateLayout, true);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setCustomOpen(false);
    }
  }, [disabled]);

  const preserveSelection = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const applyColor = (color: string) => {
    editor?.chain().focus().setColor(color).run();
    setOpen(false);
    setCustomOpen(false);
  };

  const resetColor = () => {
    editor?.chain().focus().unsetColor().run();
    setOpen(false);
    setCustomOpen(false);
  };

  const closePicker = () => {
    setOpen(false);
    setCustomOpen(false);
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Màu chữ"
        disabled={disabled || !editor}
        onMouseDown={preserveSelection}
        onClick={() => {
          if (open) {
            closePicker();
          } else {
            setOpen(true);
          }
        }}
        className={cn(
          "relative grid h-9 w-9 cursor-pointer place-items-center rounded-lg border text-[var(--theme-text-muted)] transition hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)] disabled:cursor-not-allowed disabled:opacity-35",
          open
            ? "border-[var(--theme-primary)] bg-[var(--theme-primary-subtle)] text-[var(--theme-primary)]"
            : "border-transparent",
        )}
      >
        <Palette aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" />
        <span
          aria-hidden="true"
          className="absolute inset-x-2 bottom-1 h-0.5 rounded-full"
          style={{ backgroundColor: activeColor ?? "var(--theme-text-strong)" }}
        />
      </button>

      {open && portalTarget && popoverLayout
        ? createPortal(
            customOpen ? (
              <div
                ref={panelRef}
                className="fixed inset-0 z-[110] grid place-items-center bg-black/30 p-4 backdrop-blur-[1px]"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    closePicker();
                  }
                }}
              >
                <QuizCustomColorDialog
                  color={customDraftColor}
                  onCancel={closePicker}
                  onChange={setCustomDraftColor}
                  onConfirm={() => applyColor(customDraftColor)}
                />
              </div>
            ) : (
              <div
                ref={panelRef}
                role="dialog"
                aria-label="Chọn màu chữ"
                className="fixed z-[100] w-[17rem] overflow-y-auto overscroll-contain rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-2.5 shadow-xl sm:w-[19.5rem]"
                style={{
                  left: popoverLayout.left,
                  maxHeight: popoverLayout.maxHeight,
                  top: popoverLayout.top,
                }}
              >
                <button
                  type="button"
                  onMouseDown={preserveSelection}
                  onClick={resetColor}
                  className={cn(
                    "mb-2 flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-xs font-semibold text-[var(--theme-text-strong)] transition hover:bg-[var(--theme-surface-soft)]",
                    !activeColor &&
                      "bg-[var(--theme-primary-subtle)] text-[var(--theme-primary)]",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)]"
                  />
                  Màu văn bản mặc định
                  {!activeColor ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
                </button>

                <div
                  className="grid grid-cols-10 gap-1"
                  role="grid"
                  aria-label="Bảng màu chữ"
                >
                  {googleDocsTextColorPalette.flat().map((color) => {
                    const selected = activeColor?.toLowerCase() === color.toLowerCase();
                    return (
                      <button
                        key={color}
                        type="button"
                        role="gridcell"
                        aria-label={`Màu chữ ${color}`}
                        aria-selected={selected}
                        onMouseDown={preserveSelection}
                        onClick={() => applyColor(color)}
                        className={cn(
                          "relative grid aspect-square min-h-5 cursor-pointer place-items-center rounded-full border border-black/15 transition hover:z-10 hover:scale-110 hover:ring-2 hover:ring-[var(--theme-primary)] hover:ring-offset-1 hover:ring-offset-[var(--theme-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--theme-surface)]",
                          selected &&
                            "ring-2 ring-[var(--theme-primary)] ring-offset-1 ring-offset-[var(--theme-surface)]",
                        )}
                        style={{ backgroundColor: color }}
                      >
                        {selected ? (
                          <Check
                            className={cn(
                              "h-3.5 w-3.5 drop-shadow-sm",
                              isLightColor(color) ? "text-slate-900" : "text-white",
                            )}
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onMouseDown={preserveSelection}
                  onClick={() => {
                    setCustomDraftColor(
                      isHexColor(activeColor) ? activeColor : "#000000",
                    );
                    setCustomOpen(true);
                  }}
                  className="mt-2 flex h-9 w-full cursor-pointer items-center gap-2 rounded-md bg-[var(--theme-surface-soft)] px-2.5 text-xs font-bold uppercase tracking-wide text-[var(--theme-text-strong)] transition hover:bg-[var(--theme-primary-subtle)]"
                >
                  <Pipette className="h-4 w-4 shrink-0 text-[var(--theme-text-muted)]" />
                  <span className="truncate">Màu tùy chỉnh</span>
                  <span
                    aria-hidden="true"
                    className="ml-auto h-5 w-5 shrink-0 rounded border border-[var(--theme-border)]"
                    style={{ backgroundColor: customDraftColor }}
                  />
                </button>
              </div>
            ),
            portalTarget,
          )
        : null}
    </div>
  );
}

function readActiveTextColor(editor: Editor | null) {
  const color = editor?.getAttributes("textStyle").color;
  return typeof color === "string" && color.length > 0 ? color : null;
}

function isHexColor(color: string | null): color is string {
  return Boolean(color && /^#[\da-f]{6}$/i.test(color));
}

function isLightColor(color: string) {
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  return red * 0.299 + green * 0.587 + blue * 0.114 > 170;
}
