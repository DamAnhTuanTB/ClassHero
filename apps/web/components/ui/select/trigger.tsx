"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { ChevronDownIcon } from "lucide-react";
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
        "group/select-trigger flex min-h-[3.35rem] w-full touch-manipulation items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-0 text-left text-base font-semibold text-slate-950 outline-none transition hover:border-indigo-200 focus:border-[var(--auth-primary)] focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 data-[placeholder]:text-slate-400 lg:text-sm",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 ease-out group-data-[state=open]/select-trigger:rotate-180" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}
