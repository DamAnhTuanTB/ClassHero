"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDownIcon } from "lucide-react";
import { formFocusClass } from "@/components/common/forms/form-styles";
import { cn } from "@/lib/utils";

export function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "group/select-trigger flex min-h-[3.35rem] w-full touch-manipulation items-center justify-between gap-3 rounded-xl border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-4 py-0 text-left text-base font-semibold text-[var(--theme-text-strong)] outline-none transition hover:border-[var(--theme-input-hover-border)] focus:bg-[var(--theme-input-bg)] disabled:cursor-not-allowed disabled:bg-[var(--theme-input-bg-disabled)] disabled:text-[var(--theme-input-text-disabled)] data-[placeholder]:text-[var(--theme-text-placeholder)] lg:text-sm",
        formFocusClass,
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="h-5 w-5 shrink-0 text-[var(--theme-text-muted)] transition-transform duration-200 ease-out group-data-[state=open]/select-trigger:rotate-180" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}
