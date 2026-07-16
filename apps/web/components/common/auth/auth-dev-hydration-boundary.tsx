"use client";

import { useEffect, useState, type ReactNode } from "react";

export function AuthDevHydrationBoundary({ children }: { children: ReactNode }) {
  const [isMounted, setIsMounted] = useState(process.env.NODE_ENV !== "development");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div
        aria-hidden="true"
        suppressHydrationWarning
        className="min-h-[30rem] rounded-[1.25rem] bg-[var(--theme-surface-soft)]"
      />
    );
  }

  return children;
}
