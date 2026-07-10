"use client";

import { Toaster } from "sonner";
import { TOAST_DURATION_MS } from "@/app/toaster/constants";
import { SingleToastQueue } from "@/app/toaster/single-toast-queue";
import { toastIcons } from "@/app/toaster/toast-icons";

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
        icons={toastIcons}
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
