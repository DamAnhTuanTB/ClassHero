"use client";

import { Check, ChevronDown, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FieldLabel } from "@/components/forms/field-label";
import { formFocusClass } from "@/components/forms/form-styles";
import type { OptionFieldProps } from "@/components/forms/form-types";
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
            "flex min-h-[3.35rem] w-full touch-manipulation items-center justify-between gap-3 rounded-xl border px-4 py-0 text-left text-base font-semibold outline-none transition focus:ring-4 disabled:cursor-not-allowed lg:text-sm",
            isDarkTheme
              ? "border-slate-700 bg-slate-950 text-slate-100 hover:border-sky-500/50 focus:border-sky-500 focus:bg-slate-950 focus:ring-sky-500/15 disabled:bg-slate-900 disabled:text-slate-500"
              : [
                  "border-slate-200 bg-white text-slate-950 hover:border-indigo-200 focus:bg-white disabled:bg-slate-100 disabled:text-slate-500",
                  formFocusClass,
                ],
          )}
        >
          <span className="flex min-w-0 flex-1 items-center gap-3">
            {resolvedIcon ? (
              <span
                className={cn(
                  "shrink-0",
                  isDarkTheme ? "text-slate-400" : "text-slate-500",
                )}
              >
                {resolvedIcon}
              </span>
            ) : null}
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-left",
                selectedOption
                  ? isDarkTheme
                    ? "text-slate-100"
                    : "text-slate-950"
                  : isDarkTheme
                    ? "text-slate-500"
                    : "text-slate-400",
              )}
            >
              {selectedOption?.label ?? placeholder}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "h-5 w-5 shrink-0 transition-transform duration-200 ease-out",
              isDarkTheme ? "text-slate-400" : "text-slate-500",
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
          className={cn(
            "absolute z-50 mt-2 max-h-64 w-full overflow-auto rounded-xl border p-1.5 text-base shadow-xl lg:text-sm",
            isDarkTheme
              ? "border-slate-700 bg-slate-900 text-slate-100 shadow-slate-950/40"
              : "border-slate-200 bg-white text-slate-950 shadow-slate-900/12",
          )}
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
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                  triggerRef.current?.focus();
                }}
                className={cn(
                  "relative flex min-h-10 w-full items-center rounded-lg py-2 pl-9 pr-3 text-left font-bold outline-none transition",
                  isSelected
                    ? "bg-sky-500 text-white shadow-sm shadow-sky-400/15 ring-1 ring-sky-400 hover:bg-sky-500 focus:bg-sky-500 focus:text-white"
                    : isDarkTheme
                      ? "text-slate-300 hover:bg-slate-800 hover:text-sky-200 focus:bg-slate-800 focus:text-sky-200 active:bg-slate-700"
                      : "text-slate-700 hover:bg-sky-100 hover:text-sky-800 focus:bg-sky-100 focus:text-sky-800 active:bg-sky-200",
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
        <p id={`${id}-error`} className="mt-1.5 text-sm leading-5 text-red-600">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
