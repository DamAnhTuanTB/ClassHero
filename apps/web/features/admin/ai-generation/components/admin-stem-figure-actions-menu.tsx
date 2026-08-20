"use client";

import {
  Bot,
  Code2,
  EllipsisVertical,
  ImageUp,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type MenuAction = {
  destructive?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  icon: typeof Code2;
  label: string;
  onSelect: () => void;
};

export function AdminStemFigureActionsMenu({
  canEditCode,
  canRetryInfrastructure,
  isCreating,
  isReplacing,
  isRetrying,
  onCreateWithAi,
  onDelete,
  onEditCode,
  onCreateWithCode,
  onReplaceImage,
  onRetryInfrastructure,
}: {
  canRetryInfrastructure: boolean;
  isCreating: boolean;
  isReplacing: boolean;
  isRetrying: boolean;
  onCreateWithAi: () => void;
  onDelete: () => void;
  onEditCode: () => void;
  onCreateWithCode: () => void;
  onReplaceImage: () => void;
  onRetryInfrastructure: () => void;
  canEditCode: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const menuWidth = menuRef.current?.offsetWidth ?? 288;
    const menuHeight = menuRef.current?.offsetHeight ?? 320;
    const gap = 8;
    const viewportPadding = 12;
    const hasRoomBelow = trigger.bottom + gap + menuHeight <= window.innerHeight;
    setMenuPosition({
      left: Math.max(
        viewportPadding,
        Math.min(
          trigger.right - menuWidth,
          window.innerWidth - menuWidth - viewportPadding,
        ),
      ),
      top: hasRoomBelow
        ? trigger.bottom + gap
        : Math.max(viewportPadding, trigger.top - menuHeight - gap),
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setIsOpen(false);
      }
    };
    window.addEventListener("pointerdown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape, true);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("pointerdown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape, true);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
  }, [isOpen, updateMenuPosition]);

  const actions: MenuAction[] = [
    {
      disabled: !canEditCode,
      disabledReason: "Ảnh này không có mã TeX/TikZ để chỉnh sửa.",
      icon: Code2,
      label: "Chỉnh sửa bằng mã code",
      onSelect: onEditCode,
    },
    {
      icon: Code2,
      label: "Tạo mới bằng mã code",
      onSelect: onCreateWithCode,
    },
    {
      disabled: isCreating,
      icon: isCreating ? Loader2 : Bot,
      label: "Tạo mới bằng AI",
      onSelect: onCreateWithAi,
    },
    {
      disabled: isReplacing,
      icon: isReplacing ? Loader2 : ImageUp,
      label: "Tải ảnh lên",
      onSelect: onReplaceImage,
    },
    ...(canRetryInfrastructure
      ? [
          {
            disabled: isRetrying,
            icon: isRetrying ? Loader2 : RotateCcw,
            label: "Thử xử lý lại",
            onSelect: onRetryInfrastructure,
          } satisfies MenuAction,
        ]
      : []),
  ];

  return (
    <div ref={rootRef} className="absolute right-3 top-3 z-20 sm:right-4 sm:top-4">
      <button
        ref={triggerRef}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Mở menu thao tác hình"
        className={`grid h-9 w-9 cursor-pointer place-items-center rounded-lg border bg-[var(--theme-surface)]/95 text-[var(--theme-text-muted)] shadow-sm backdrop-blur transition hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] ${
          isOpen
            ? "border-[var(--theme-primary)] text-[var(--theme-primary)]"
            : "border-[var(--theme-border)]"
        }`}
        onClick={() => setIsOpen((open) => !open)}
        type="button"
      >
        <EllipsisVertical className="h-5 w-5" aria-hidden="true" />
      </button>

      {isOpen
        ? createPortal(
            <div
              ref={menuRef}
              aria-label="Thao tác hình"
              className="fixed z-[120] w-72 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-1.5 shadow-xl"
              role="menu"
              style={{
                left: menuPosition?.left ?? 0,
                top: menuPosition?.top ?? 0,
                visibility: menuPosition ? "visible" : "hidden",
              }}
            >
              {actions.map((action) => (
                <MenuItem
                  action={action}
                  key={action.label}
                  onClose={() => setIsOpen(false)}
                />
              ))}
              <div className="my-1 border-t border-[var(--theme-border)]" />
              <MenuItem
                action={{
                  destructive: true,
                  icon: Trash2,
                  label: "Xóa",
                  onSelect: onDelete,
                }}
                onClose={() => setIsOpen(false)}
              />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function MenuItem({ action, onClose }: { action: MenuAction; onClose: () => void }) {
  const Icon = action.icon;
  return (
    <button
      className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
        action.destructive
          ? "text-red-600 hover:bg-red-50 focus-visible:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/50 dark:focus-visible:bg-red-950/50"
          : "text-[var(--theme-text-strong)] hover:bg-[var(--theme-surface-soft)] focus-visible:bg-[var(--theme-surface-soft)]"
      } focus-visible:outline-none`}
      disabled={action.disabled}
      title={action.disabled ? action.disabledReason : undefined}
      onClick={() => {
        onClose();
        action.onSelect();
      }}
      role="menuitem"
      type="button"
    >
      <Icon
        className={`h-4 w-4 shrink-0 ${
          action.disabled && Icon === Loader2 ? "animate-spin" : ""
        }`}
        aria-hidden="true"
      />
      <span className="whitespace-nowrap">{action.label}</span>
    </button>
  );
}
