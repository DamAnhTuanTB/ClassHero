"use client";

import { Check, ChevronDown, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FieldLabel } from "@/components/common/forms/field-label";
import { formFocusClass } from "@/components/common/forms/form-styles";
import type { OptionFieldProps } from "@/components/common/forms/form-types";
import { cn } from "@/lib/utils";

export function OptionField({
  id,
  label,
  value,
  placeholder = "Chọn",
  options,
  error,
  disabled,
  hideLabel = false,
  isOptional = false,
  optionalLabel,
  icon,
  isDarkTheme = false,
  wrapperClassName,
  onChange,
}: OptionFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const listboxRef = useRef<HTMLDivElement | null>(null);
  const selectedOptionRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedOption = options.find((option) => option.value === value);
  const resolvedIcon = icon === null ? null : (icon ?? <UserRound className="h-5 w-5" />);

  useEffect(() => {
    if (!isOpen || !value) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const listbox = listboxRef.current;
      const selectedElement = selectedOptionRef.current;

      if (!listbox || !selectedElement) {
        return;
      }

      const centeredScrollTop =
        selectedElement.offsetTop -
        listbox.clientHeight / 2 +
        selectedElement.offsetHeight / 2;
      listbox.scrollTop = Math.max(centeredScrollTop, 0);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, value]);

  return (
    <div
      className={cn("relative", wrapperClassName)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setIsOpen(false);
        }
      }}
    >
      <FieldLabel
        id={id}
        label={label}
        hideLabel={hideLabel}
        isDarkTheme={isDarkTheme}
        isOptional={isOptional}
        optionalLabel={optionalLabel}
      />
      <div className={cn("relative", !hideLabel && "mt-2")}>
        <button
          ref={triggerRef}
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${id}-error` : undefined}
          disabled={disabled}
          onClick={() => setIsOpen((open) => !open)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsOpen(false);
              triggerRef.current?.focus();
            }

            if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setIsOpen(true);
            }
          }}
          className={cn(
            "flex min-h-[3.35rem] w-full touch-manipulation items-center justify-between gap-3 rounded-xl border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-4 py-0 text-left text-base font-semibold text-[var(--theme-text-strong)] outline-none transition hover:border-[var(--theme-input-hover-border)] focus:bg-[var(--theme-input-bg)] disabled:cursor-not-allowed disabled:bg-[var(--theme-input-bg-disabled)] disabled:text-[var(--theme-input-text-disabled)] lg:text-sm",
            formFocusClass,
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-3">
            {resolvedIcon ? (
              <span className="shrink-0 text-[var(--theme-text-muted)]">
                {resolvedIcon}
              </span>
            ) : null}
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-left",
                selectedOption
                  ? "text-[var(--theme-text-strong)]"
                  : "text-[var(--theme-text-placeholder)]",
              )}
            >
              {selectedOption?.label ?? placeholder}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 text-[var(--theme-text-muted)] transition-transform duration-200 ease-out",
              isOpen && "rotate-180",
            )}
            aria-hidden="true"
          />
        </button>
      </div>
      {isOpen ? (
        <div
          ref={listboxRef}
          role="listbox"
          aria-labelledby={id}
          className="absolute z-50 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-1.5 text-base text-[var(--theme-text-strong)] shadow-[var(--theme-shadow-lg)] lg:text-sm"
        >
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                ref={isSelected ? selectedOptionRef : undefined}
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                disabled={option.disabled}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                  triggerRef.current?.blur();
                }}
                className={cn(
                  "relative flex min-h-10 w-full items-center rounded-lg py-2 pl-9 pr-3 text-left font-bold outline-none transition",
                  isSelected
                    ? "bg-[var(--theme-primary)] text-[var(--theme-primary-foreground)] shadow-[var(--theme-shadow-sm)] ring-1 ring-[var(--theme-primary-border)] hover:bg-[var(--theme-primary)] focus:bg-[var(--theme-primary)] focus:text-[var(--theme-primary-foreground)]"
                    : "text-[var(--theme-text)] hover:bg-[var(--theme-primary-soft)] hover:text-[var(--theme-primary)] focus:bg-[var(--theme-primary-soft)] focus:text-[var(--theme-primary)] active:bg-[var(--theme-surface-muted)]",
                  option.disabled &&
                    "cursor-not-allowed opacity-55 hover:bg-transparent hover:text-[var(--theme-text)]",
                )}
              >
                <span className="absolute left-3 flex h-4 w-4 items-center justify-center">
                  {isSelected ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                </span>
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          className="mt-1.5 text-sm leading-5 text-[var(--theme-error-text)]"
        >
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
