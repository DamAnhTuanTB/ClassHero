"use client";

import { useEffect, useRef, useState } from "react";

const loadingRevealDelayMs = 300;
const minimumLoadingVisibleMs = 300;

export function useStableLoadingVisibility(isPending: boolean) {
  const [isVisible, setIsVisible] = useState(false);
  const visibleSinceRef = useRef(0);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (isPending && !isVisible) {
      timeoutId = setTimeout(() => {
        visibleSinceRef.current = Date.now();
        setIsVisible(true);
      }, loadingRevealDelayMs);
    } else if (!isPending && isVisible) {
      const visibleDuration = Date.now() - visibleSinceRef.current;
      const remainingVisibleTime = Math.max(0, minimumLoadingVisibleMs - visibleDuration);

      timeoutId = setTimeout(() => {
        visibleSinceRef.current = 0;
        setIsVisible(false);
      }, remainingVisibleTime);
    }

    return () => {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [isPending, isVisible]);

  return isVisible;
}
