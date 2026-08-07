"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { SelectScrollDownButton } from "@/components/common/ui/select/scroll-down-button";
import { SelectScrollUpButton } from "@/components/common/ui/select/scroll-up-button";
import { cn } from "@/lib/utils";

export function SelectContent({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        className={cn(
          "z-50 max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-1.5 text-[var(--theme-text-strong)] shadow-[var(--theme-shadow-lg)]",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className,
        )}
        {...props}
      >
        {position === "item-aligned" && <SelectScrollUpButton />}
        <SelectPrimitive.Viewport
          className={cn(
            "p-0",
            position === "popper" &&
              "w-full min-w-[var(--radix-select-trigger-width)] max-h-[50vh] overflow-y-auto",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        {position === "item-aligned" && <SelectScrollDownButton />}
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}
