"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useStableTabPanelHeight() {
  const panelRef = useRef<HTMLElement>(null);
  const [minHeight, setMinHeight] = useState(0);

  const preserveCurrentHeight = useCallback(() => {
    const currentHeight = panelRef.current?.getBoundingClientRect().height;
    if (!currentHeight) {
      return;
    }

    setMinHeight((previousHeight) => Math.max(previousHeight, Math.ceil(currentHeight)));
  }, []);

  useEffect(() => {
    const resetMinHeight = () => setMinHeight(0);
    window.addEventListener("resize", resetMinHeight);

    return () => window.removeEventListener("resize", resetMinHeight);
  }, []);

  return { minHeight, panelRef, preserveCurrentHeight };
}
