"use client";

import { AlertTriangle, CheckCircle2, CircleAlert, Info, Loader2, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { Toaster, toast, useSonner } from "sonner";

const TOAST_DURATION_MS = 4200;
const toastIconClass = "h-4 w-4";

function SingleToastQueue() {
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

export function AppToaster() {
  return (
    <>
      <SingleToastQueue />
      <Toaster
        className="app-toaster"
        closeButton
        containerAriaLabel="Thong bao he thong"
        duration={TOAST_DURATION_MS}
        expand={false}
        gap={10}
        icons={{
          close: <X className="h-4 w-4" aria-hidden="true" />,
          error: (
            <span className="app-toast-status-icon">
              <CircleAlert className={toastIconClass} aria-hidden="true" />
            </span>
          ),
          info: (
            <span className="app-toast-status-icon">
              <Info className={toastIconClass} aria-hidden="true" />
            </span>
          ),
          loading: (
            <span className="app-toast-status-icon">
              <Loader2 className={`${toastIconClass} animate-spin`} aria-hidden="true" />
            </span>
          ),
          success: (
            <span className="app-toast-status-icon">
              <CheckCircle2 className={toastIconClass} aria-hidden="true" />
            </span>
          ),
          warning: (
            <span className="app-toast-status-icon">
              <AlertTriangle className={toastIconClass} aria-hidden="true" />
            </span>
          ),
        }}
        mobileOffset={12}
        offset={{ right: 20, top: 20 }}
        position="top-right"
        richColors={false}
        toastOptions={{
          classNames: {
            actionButton: "app-toast__action-button",
            cancelButton: "app-toast__cancel-button",
            closeButton: "app-toast__close-button",
            content: "app-toast__content",
            description: "app-toast__description",
            icon: "app-toast__icon",
            title: "app-toast__title",
            toast: "app-toast",
          },
        }}
        visibleToasts={1}
      />
    </>
  );
}
