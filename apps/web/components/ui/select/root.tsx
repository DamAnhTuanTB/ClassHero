"use client";

import * as SelectPrimitive from "@radix-ui/react-select";

export function Select(props: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}
