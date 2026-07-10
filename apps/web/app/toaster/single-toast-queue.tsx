"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { toast, useSonner } from "sonner";
import { TOAST_DURATION_MS } from "@/app/toaster/constants";

export function SingleToastQueue() {
  const { toasts } = useSonner();
  const dismissedToastIds = useRef(new Set<string | number>());
  const latestToast = toasts[0];

  useLayoutEffect(() => {
    const [currentToast, ...olderToasts] = toasts;

    if (!currentToast) {
      dismissedToastIds.current.clear();
      return;
    }

    dismissedToastIds.current.delete(currentToast.id);

    olderToasts.forEach((olderToast) => {
      if (dismissedToastIds.current.has(olderToast.id)) {
        return;
      }

      dismissedToastIds.current.add(olderToast.id);
      toast.dismiss(olderToast.id);
    });
  }, [toasts]);

  useEffect(() => {
    if (!latestToast || latestToast.type === "loading") {
      return;
    }

    const duration = latestToast.duration ?? TOAST_DURATION_MS;

    if (duration === Infinity) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      toast.dismiss(latestToast.id);
    }, duration);

    return () => window.clearTimeout(timeoutId);
  }, [latestToast?.duration, latestToast?.id, latestToast?.type]);

  return null;
}
