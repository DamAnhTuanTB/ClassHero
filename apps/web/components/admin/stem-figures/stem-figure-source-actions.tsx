"use client";

import {
  Check,
  ChevronDown,
  Compass,
  Eraser,
  CaseSensitive,
  Hash,
  LoaderCircle,
  Minus,
  RotateCcw,
  Ruler,
  Settings2,
  Trash2,
  WandSparkles,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import { StemFigureTextAdjustmentControls } from "@/components/admin/stem-figures/stem-figure-text-adjustment-controls";
import { StemFigureQuickAngleForm } from "@/components/admin/stem-figures/stem-figure-quick-angle-form";
import { StemFigureQuickCircleCenterForm } from "@/components/admin/stem-figures/stem-figure-quick-circle-center-form";
import { StemFigureQuickMidpointForm } from "@/components/admin/stem-figures/stem-figure-quick-midpoint-form";
import { StemFigureQuickSegmentForm } from "@/components/admin/stem-figures/stem-figure-quick-segment-form";
import type {
  StemFigureMidpointAction,
  StemFigureQuickAngleInput,
  StemFigureQuickAngleRemovalInput,
  StemFigureQuickCircleCenterInput,
  StemFigureQuickMidpointInput,
  StemFigureQuickSegmentInput,
  StemFigureSegmentAction,
} from "@/lib/stem-figure-geometry-actions";
import {
  extractStemFigureTextSlots,
  readStemFigureScalePercentage,
  STEM_FIGURE_SCALE_PERCENT_DEFAULT,
  STEM_FIGURE_SCALE_PERCENT_MAX,
  STEM_FIGURE_SCALE_PERCENT_MIN,
  type StemFigureQuickAction,
  type StemFigureScaleTarget,
  type StemFigureTextAdjustmentTarget,
  type StemFigureTextSlotDisplayKind,
  type StemFigureTextSlot,
} from "@/lib/stem-figure-source-actions";

type QuickTool = {
  action: StemFigureQuickAction;
  description: string;
  icon: typeof Ruler;
  label: string;
};

const TOOL_GROUPS: Array<{ label: string; tools: QuickTool[] }> = [
  {
    label: "Ẩn thông tin",
    tools: [
      {
        action: "REMOVE_LENGTH_LABELS",
        description: "Ví dụ: 5 m, 12 cm",
        icon: Ruler,
        label: "Ẩn độ dài",
      },
      {
        action: "REMOVE_ANGLE_MEASUREMENTS",
        description: "Ví dụ: 60°, 90°",
        icon: Compass,
        label: "Ẩn số đo góc",
      },
      {
        action: "REMOVE_NUMERIC_LABELS",
        description: "Chỉ nhãn là số, như −3 hoặc 1/2",
        icon: Hash,
        label: "Ẩn nhãn số",
      },
    ],
  },
  {
    label: "Đường nét",
    tools: [
      {
        action: "REMOVE_DASHED_PATHS",
        description: "Xóa đường đứt hoặc chấm",
        icon: Eraser,
        label: "Xóa nét phụ",
      },
      {
        action: "SET_LINE_WEIGHT_THIN",
        description: "Nét mảnh, nhẹ",
        icon: Minus,
        label: "Nét mảnh",
      },
      {
        action: "SET_LINE_WEIGHT_NORMAL",
        description: "Độ đậm dễ đọc",
        icon: Minus,
        label: "Nét vừa",
      },
      {
        action: "SET_LINE_WEIGHT_BOLD",
        description: "Nét rõ, nổi bật",
        icon: Minus,
        label: "Nét đậm",
      },
    ],
  },
];

export type StemFigureSourceActionsHandle = {
  flushPendingChange: () => Promise<boolean>;
};

type StemFigureSourceActionsProps = {
  canUndo: boolean;
  disabled: boolean;
  onAction: (action: StemFigureQuickAction) => void;
  onQuickAngleAdd: (input: StemFigureQuickAngleInput) => Promise<boolean>;
  onQuickAngleRemove: (input: StemFigureQuickAngleRemovalInput) => Promise<boolean>;
  onQuickCircleCenterAdd: (input: StemFigureQuickCircleCenterInput) => Promise<boolean>;
  onQuickMidpointUpdate: (
    action: StemFigureMidpointAction,
    input: StemFigureQuickMidpointInput,
  ) => Promise<boolean>;
  onQuickSegmentUpdate: (
    action: StemFigureSegmentAction,
    input: StemFigureQuickSegmentInput,
  ) => Promise<boolean>;
  onScaleChange: (target: StemFigureScaleTarget, percentage: number) => Promise<void>;
  onTextSlotAdjustmentChange: (
    slotId: string,
    target: StemFigureTextAdjustmentTarget,
    value: number,
  ) => Promise<void>;
  onTextSlotChange: (slotId: string, value: string) => Promise<void>;
  onUndo: () => void;
  source: string;
};

export const StemFigureSourceActions = forwardRef<
  StemFigureSourceActionsHandle,
  StemFigureSourceActionsProps
>(function StemFigureSourceActions(
  {
    canUndo,
    disabled,
    onAction,
    onQuickAngleAdd,
    onQuickAngleRemove,
    onQuickCircleCenterAdd,
    onQuickMidpointUpdate,
    onQuickSegmentUpdate,
    onScaleChange,
    onTextSlotAdjustmentChange,
    onTextSlotChange,
    onUndo,
    source,
  },
  ref,
) {
  const [expandedSlotIndex, setExpandedSlotIndex] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [pendingApplySlotId, setPendingApplySlotId] = useState<string | null>(null);
  const [pendingSlotId, setPendingSlotId] = useState<string | null>(null);
  const [textDrafts, setTextDrafts] = useState<Record<string, string>>({});
  const activeSlotIdRef = useRef<string | null>(null);
  const commitPromiseRef = useRef<Promise<boolean> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pendingScaleDraftRef = useRef<{
    percentage: number;
    target: StemFigureScaleTarget;
  } | null>(null);
  const scaleCommitPromiseRef = useRef<Promise<boolean> | null>(null);
  const adjustmentCommitPromiseRef = useRef<Promise<boolean> | null>(null);
  const deferBlurCommitForFlushRef = useRef(false);
  const pendingAdjustmentDraftRef = useRef<{
    slotId: string;
    target: StemFigureTextAdjustmentTarget;
    value: number;
  } | null>(null);
  const skipCommitSlotRef = useRef<string | null>(null);
  const textDraftsRef = useRef<Record<string, string>>({});
  const textExtraction = useMemo(() => extractStemFigureTextSlots(source), [source]);
  const textSlotDisplayNames = useMemo(
    () => createTextSlotDisplayNames(textExtraction.slots),
    [textExtraction.slots],
  );

  useEffect(() => {
    const nextDrafts = Object.fromEntries(
      textExtraction.slots.map((slot) => [slot.id, slot.value]),
    );
    textDraftsRef.current = nextDrafts;
    setTextDrafts(nextDrafts);
  }, [textExtraction]);

  useEffect(() => {
    if (isOpen) return;
    setExpandedSlotIndex(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("[data-stem-figure-quick-actions-keep-open]")
      ) {
        deferBlurCommitForFlushRef.current = true;
        return;
      }
      if (!containerRef.current?.contains(target as Node)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  function commitTextSlot(slot: StemFigureTextSlot): Promise<boolean> {
    if (deferBlurCommitForFlushRef.current) return Promise.resolve(false);
    if (commitPromiseRef.current) return commitPromiseRef.current;
    if (skipCommitSlotRef.current === slot.id) {
      skipCommitSlotRef.current = null;
      return Promise.resolve(false);
    }
    const nextValue = textDraftsRef.current[slot.id] ?? slot.value;
    if (nextValue.trim() === slot.value) return Promise.resolve(false);

    const promise = (async () => {
      setPendingApplySlotId(slot.id);
      setPendingSlotId(slot.id);
      try {
        await onTextSlotChange(slot.id, nextValue);
        return true;
      } finally {
        setPendingApplySlotId(null);
        setPendingSlotId(null);
      }
    })();
    commitPromiseRef.current = promise;
    void promise.finally(() => {
      if (commitPromiseRef.current === promise) commitPromiseRef.current = null;
    });
    return promise;
  }

  function commitScale(
    target: StemFigureScaleTarget,
    percentage: number,
  ): Promise<boolean> {
    if (deferBlurCommitForFlushRef.current) return Promise.resolve(false);
    if (scaleCommitPromiseRef.current) return scaleCommitPromiseRef.current;
    pendingScaleDraftRef.current = null;
    const promise = onScaleChange(target, percentage).then(() => true);
    scaleCommitPromiseRef.current = promise;
    void promise.finally(() => {
      if (scaleCommitPromiseRef.current === promise) {
        scaleCommitPromiseRef.current = null;
      }
    });
    return promise;
  }

  function commitTextSlotAdjustment(
    slotId: string,
    target: StemFigureTextAdjustmentTarget,
    value: number,
  ): Promise<boolean> {
    if (deferBlurCommitForFlushRef.current) return Promise.resolve(false);
    if (adjustmentCommitPromiseRef.current) {
      return adjustmentCommitPromiseRef.current;
    }
    pendingAdjustmentDraftRef.current = null;
    const promise = (async () => {
      setPendingSlotId(slotId);
      try {
        await onTextSlotAdjustmentChange(slotId, target, value);
        return true;
      } finally {
        setPendingSlotId(null);
      }
    })();
    adjustmentCommitPromiseRef.current = promise;
    void promise.finally(() => {
      if (adjustmentCommitPromiseRef.current === promise) {
        adjustmentCommitPromiseRef.current = null;
      }
    });
    return promise;
  }

  useImperativeHandle(ref, () => ({
    flushPendingChange() {
      deferBlurCommitForFlushRef.current = false;
      if (commitPromiseRef.current) return commitPromiseRef.current;
      if (scaleCommitPromiseRef.current) return scaleCommitPromiseRef.current;
      if (adjustmentCommitPromiseRef.current) {
        return adjustmentCommitPromiseRef.current;
      }
      const activeSlot = textExtraction.slots.find(
        (slot) => slot.id === activeSlotIdRef.current,
      );
      const activeValue = activeSlot
        ? (textDraftsRef.current[activeSlot.id] ?? activeSlot.value).trim()
        : null;
      if (activeSlot && activeValue !== activeSlot.value) {
        return commitTextSlot(activeSlot);
      }
      const pendingScale = pendingScaleDraftRef.current;
      if (pendingScale) return commitScale(pendingScale.target, pendingScale.percentage);
      const pendingAdjustment = pendingAdjustmentDraftRef.current;
      return pendingAdjustment
        ? commitTextSlotAdjustment(
            pendingAdjustment.slotId,
            pendingAdjustment.target,
            pendingAdjustment.value,
          )
        : Promise.resolve(false);
    },
  }));

  async function deleteTextSlot(slot: StemFigureTextSlot) {
    setPendingSlotId(slot.id);
    try {
      await onTextSlotChange(slot.id, "");
    } finally {
      setPendingSlotId(null);
    }
  }

  return (
    <div
      className="relative z-30 shrink-0 border-b border-[var(--theme-border)] bg-[var(--theme-surface-soft)]"
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen) {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen(false);
        }
      }}
      ref={containerRef}
    >
      <div className="flex min-h-14 items-center justify-between gap-2 px-3 py-2">
        <button
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          className="theme-button-neutral inline-flex min-h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs font-extrabold"
          onClick={() => setIsOpen((value) => !value)}
          type="button"
        >
          <WandSparkles className="h-4 w-4 text-sky-600" aria-hidden="true" />
          Chỉnh nhanh
          <ChevronDown
            className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>

        <button
          className="theme-button-neutral ml-auto inline-flex min-h-10 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-3 text-xs font-extrabold disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || !canUndo}
          onClick={onUndo}
          type="button"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Hoàn tác
        </button>
      </div>

      {isOpen ? (
        <div
          aria-label="Công cụ chỉnh nhanh hình vẽ"
          className="absolute left-3 right-3 top-[calc(100%+0.5rem)] z-50 max-h-[min(32rem,68dvh)] space-y-3 overflow-y-auto rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3 shadow-[0_18px_48px_-18px_rgb(15_23_42_/_36%)]"
          data-testid="stem-figure-quick-actions-popover"
          role="dialog"
        >
          <p className="text-xs leading-5 text-[var(--theme-text-muted)]">
            Chọn một thao tác, hệ thống sẽ tự biên dịch để bạn xem kết quả. Chỉ lưu hình
            khi bạn bấm <strong>Áp dụng</strong>.
          </p>
          <StemFigureQuickAngleForm
            disabled={disabled || pendingSlotId !== null}
            onAdd={onQuickAngleAdd}
            onRemove={onQuickAngleRemove}
            source={source}
          />
          <StemFigureQuickSegmentForm
            disabled={disabled || pendingSlotId !== null}
            onUpdate={onQuickSegmentUpdate}
            source={source}
          />
          <StemFigureQuickMidpointForm
            disabled={disabled || pendingSlotId !== null}
            onUpdate={onQuickMidpointUpdate}
          />
          <StemFigureQuickCircleCenterForm
            disabled={disabled || pendingSlotId !== null}
            onAdd={onQuickCircleCenterAdd}
          />
          <section>
            <h4 className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--theme-text-muted)]">
              Nhãn và số đo ({textExtraction.slots.length})
            </h4>
            {textExtraction.slots.length > 0 ? (
              <div className="grid max-h-[26rem] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                {textExtraction.slots.map((slot, index) => {
                  const slotPending = pendingSlotId === slot.id;
                  const slotApplying = pendingApplySlotId === slot.id;
                  const slotDraftValue = textDrafts[slot.id] ?? slot.value;
                  const slotDirty = slotDraftValue.trim() !== slot.value;
                  const displayName =
                    textSlotDisplayNames[index] ??
                    `${TEXT_SLOT_LABELS[slot.displayKind]} ${index + 1}`;
                  return (
                    <div
                      className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-2.5"
                      data-testid="stem-figure-text-slot"
                      key={slot.id}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <label
                          className="text-[11px] font-extrabold text-[var(--theme-text-muted)]"
                          htmlFor={`stem-figure-text-slot-${index}`}
                        >
                          {displayName}
                        </label>
                        <div className="flex items-center gap-1.5">
                          <button
                            aria-label={`Áp dụng ${displayName.toLocaleLowerCase("vi")}`}
                            className="theme-button-primary inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-40"
                            disabled={disabled || pendingSlotId !== null || !slotDirty}
                            onClick={() => void commitTextSlot(slot)}
                            onPointerDown={() => {
                              if (
                                document.activeElement?.id ===
                                `stem-figure-text-slot-${index}`
                              ) {
                                skipCommitSlotRef.current = slot.id;
                              }
                            }}
                            title={`Áp dụng ${displayName.toLocaleLowerCase("vi")} và biên dịch`}
                            type="button"
                          >
                            {slotApplying ? (
                              <LoaderCircle
                                className="h-3.5 w-3.5 animate-spin"
                                aria-hidden
                              />
                            ) : (
                              <Check className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </button>
                          <button
                            aria-expanded={expandedSlotIndex === index}
                            aria-label={`Cài đặt ${displayName.toLocaleLowerCase("vi")}`}
                            className="theme-button-neutral inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={disabled || pendingSlotId !== null}
                            onClick={() =>
                              setExpandedSlotIndex((current) =>
                                current === index ? null : index,
                              )
                            }
                            title="Tinh chỉnh vị trí và cỡ chữ"
                            type="button"
                          >
                            <Settings2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button
                            aria-label={`Xóa ${displayName.toLocaleLowerCase("vi")}`}
                            className="theme-button-danger inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={disabled || pendingSlotId !== null}
                            onClick={() => {
                              setExpandedSlotIndex(null);
                              void deleteTextSlot(slot);
                            }}
                            onPointerDown={() => {
                              if (
                                document.activeElement?.id ===
                                `stem-figure-text-slot-${index}`
                              ) {
                                skipCommitSlotRef.current = slot.id;
                              }
                            }}
                            title={`Xóa ${TEXT_SLOT_LABELS[slot.displayKind].toLocaleLowerCase("vi")} này`}
                            type="button"
                          >
                            {slotPending && !slotApplying ? (
                              <LoaderCircle
                                className="h-3.5 w-3.5 animate-spin"
                                aria-hidden
                              />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </button>
                        </div>
                      </div>
                      <input
                        aria-label={displayName}
                        autoComplete="off"
                        className="min-h-10 w-full rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-3 text-base font-semibold text-[var(--theme-text-strong)] outline-none transition hover:border-[var(--theme-input-hover-border)] focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:bg-[var(--theme-input-bg-disabled)] lg:text-sm"
                        disabled={disabled || pendingSlotId !== null}
                        id={`stem-figure-text-slot-${index}`}
                        onBlur={() => void commitTextSlot(slot)}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          textDraftsRef.current = {
                            ...textDraftsRef.current,
                            [slot.id]: nextValue,
                          };
                          setTextDrafts((current) => ({
                            ...current,
                            [slot.id]: nextValue,
                          }));
                        }}
                        onFocus={() => {
                          activeSlotIdRef.current = slot.id;
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            event.currentTarget.blur();
                            return;
                          }
                          if (event.key === "Escape") {
                            event.preventDefault();
                            event.stopPropagation();
                            skipCommitSlotRef.current = slot.id;
                            textDraftsRef.current = {
                              ...textDraftsRef.current,
                              [slot.id]: slot.value,
                            };
                            setTextDrafts((current) => ({
                              ...current,
                              [slot.id]: slot.value,
                            }));
                            event.currentTarget.blur();
                          }
                        }}
                        spellCheck={false}
                        value={textDrafts[slot.id] ?? slot.value}
                      />
                      {expandedSlotIndex === index ? (
                        slot.adjustment ? (
                          <StemFigureTextAdjustmentControls
                            adjustment={slot.adjustment}
                            disabled={disabled || pendingSlotId !== null}
                            onCommit={(target, value) =>
                              void commitTextSlotAdjustment(slot.id, target, value)
                            }
                            onDraftChange={(draft) => {
                              pendingAdjustmentDraftRef.current = draft
                                ? { ...draft, slotId: slot.id }
                                : null;
                            }}
                          />
                        ) : (
                          <p className="mt-2.5 rounded-md border border-amber-300/70 bg-amber-50 px-2.5 py-2 text-[11px] leading-4 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200">
                            Vị trí và cỡ chữ của mục này cần chỉnh trực tiếp trong mã.
                          </p>
                        )
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-[var(--theme-border)] px-3 py-2.5 text-xs leading-5 text-[var(--theme-text-muted)]">
                Hình này không có nhãn hoặc số đo có thể chỉnh nhanh.
              </p>
            )}
            {textExtraction.unsupportedCount > 0 ? (
              <p className="mt-2 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200">
                Có {textExtraction.unsupportedCount} nội dung chưa thể tách an toàn. Vui
                lòng sửa trực tiếp trong mã.
              </p>
            ) : null}
          </section>
          {TOOL_GROUPS.map((group) => (
            <section key={group.label}>
              <h4 className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--theme-text-muted)]">
                {group.label}
              </h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.tools.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <button
                      className="theme-button-neutral flex min-h-12 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={disabled}
                      key={tool.action}
                      onClick={() => onAction(tool.action)}
                      type="button"
                    >
                      <Icon
                        className="h-4 w-4 shrink-0 text-sky-600"
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="block whitespace-nowrap text-xs font-extrabold text-[var(--theme-text-strong)]">
                          {tool.label}
                        </span>
                        <span className="block text-[11px] leading-4 text-[var(--theme-text-muted)]">
                          {tool.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          <section>
            <h4 className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--theme-text-muted)]">
              Kích thước
            </h4>
            <ScaleSliderControl
              description="Thu phóng toàn bộ hình so với kích thước gốc"
              disabled={disabled}
              icon={Ruler}
              label="Toàn bộ hình"
              onCommit={(percentage) => void commitScale("DISPLAY", percentage)}
              onDraftChange={(percentage) => {
                pendingScaleDraftRef.current =
                  percentage === null ? null : { percentage, target: "DISPLAY" };
              }}
              value={readStemFigureScalePercentage(source, "DISPLAY")}
            />
          </section>
          <section>
            <h4 className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[var(--theme-text-muted)]">
              Cỡ chữ nhãn
            </h4>
            <div className="space-y-2">
              <LabelSizeControl
                description="Tên điểm, đỉnh, nút hoặc mốc"
                disabled={disabled}
                label="Nhãn chính"
                onCommit={(percentage) => void commitScale("PRIMARY_LABEL", percentage)}
                onDraftChange={(percentage) => {
                  pendingScaleDraftRef.current =
                    percentage === null ? null : { percentage, target: "PRIMARY_LABEL" };
                }}
                value={readStemFigureScalePercentage(source, "PRIMARY_LABEL")}
              />
              <LabelSizeControl
                description="Số đo độ dài, góc và giá trị số"
                disabled={disabled}
                label="Nhãn phụ"
                onCommit={(percentage) => void commitScale("SECONDARY_LABEL", percentage)}
                onDraftChange={(percentage) => {
                  pendingScaleDraftRef.current =
                    percentage === null
                      ? null
                      : { percentage, target: "SECONDARY_LABEL" };
                }}
                value={readStemFigureScalePercentage(source, "SECONDARY_LABEL")}
              />
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
});

const TEXT_SLOT_LABELS: Record<StemFigureTextSlotDisplayKind, string> = {
  ANGLE: "Góc",
  ANNOTATION: "Chú thích",
  COMPONENT_LABEL: "Linh kiện",
  LABEL: "Nhãn",
  LENGTH: "Độ dài",
  POINT: "Điểm",
  VALUE: "Giá trị",
};

function createTextSlotDisplayNames(slots: StemFigureTextSlot[]) {
  const counts = new Map<StemFigureTextSlotDisplayKind, number>();
  return slots.map((slot) => {
    const count = (counts.get(slot.displayKind) ?? 0) + 1;
    counts.set(slot.displayKind, count);
    return `${TEXT_SLOT_LABELS[slot.displayKind]} ${count}`;
  });
}

function LabelSizeControl({
  description,
  disabled,
  label,
  onCommit,
  onDraftChange,
  value,
}: {
  description: string;
  disabled: boolean;
  label: string;
  onCommit: (percentage: number) => void;
  onDraftChange: (percentage: number | null) => void;
  value: number;
}) {
  return (
    <ScaleSliderControl
      description={description}
      disabled={disabled}
      icon={CaseSensitive}
      label={label}
      onCommit={onCommit}
      onDraftChange={onDraftChange}
      value={value}
    />
  );
}

function ScaleSliderControl({
  description,
  disabled,
  icon: Icon,
  label,
  onCommit,
  onDraftChange,
  value,
}: {
  description: string;
  disabled: boolean;
  icon: typeof Ruler;
  label: string;
  onCommit: (percentage: number) => void;
  onDraftChange: (percentage: number | null) => void;
  value: number;
}) {
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

  const filledPercent =
    ((draftValue - STEM_FIGURE_SCALE_PERCENT_MIN) /
      (STEM_FIGURE_SCALE_PERCENT_MAX - STEM_FIGURE_SCALE_PERCENT_MIN)) *
    100;

  return (
    <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-2.5">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-[var(--theme-text-strong)]">
            {label}
          </p>
          <p className="text-[11px] leading-4 text-[var(--theme-text-muted)]">
            {description}
          </p>
        </div>
        <output
          className="ml-auto shrink-0 rounded-md bg-sky-100 px-2 py-1 text-xs font-extrabold tabular-nums text-sky-700 dark:bg-sky-950/60 dark:text-sky-200"
          htmlFor={`stem-figure-scale-${label}`}
        >
          {draftValue}%
        </output>
      </div>
      <div className="mt-3">
        <input
          aria-label={`${label} (%)`}
          aria-valuetext={`${draftValue}% so với kích thước gốc`}
          className="h-2 w-full cursor-pointer appearance-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 disabled:cursor-not-allowed disabled:opacity-60 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-sky-600 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-sky-600 [&::-webkit-slider-thumb]:shadow"
          disabled={disabled}
          id={`stem-figure-scale-${label}`}
          max={STEM_FIGURE_SCALE_PERCENT_MAX}
          min={STEM_FIGURE_SCALE_PERCENT_MIN}
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
        <div className="mt-1 flex justify-between text-[10px] font-bold tabular-nums text-[var(--theme-text-muted)]">
          <span>{STEM_FIGURE_SCALE_PERCENT_MIN}%</span>
          <span>{STEM_FIGURE_SCALE_PERCENT_DEFAULT}%</span>
          <span>{STEM_FIGURE_SCALE_PERCENT_MAX}%</span>
        </div>
      </div>
    </div>
  );
}
