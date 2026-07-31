"use client";

import { useEffect } from "react";

let activeScrollLocks = 0;
let previousBodyOverflow = "";
let previousDocumentOverflow = "";

export function useDocumentScrollLock(isLocked = true) {
  useEffect(() => {
    if (!isLocked) {
      return;
    }

    const body = document.body;
    const documentElement = document.documentElement;

    if (activeScrollLocks === 0) {
      previousBodyOverflow = body.style.overflow;
      previousDocumentOverflow = documentElement.style.overflow;
    }

    activeScrollLocks += 1;
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";

    return () => {
      activeScrollLocks = Math.max(0, activeScrollLocks - 1);

      if (activeScrollLocks === 0) {
        body.style.overflow = previousBodyOverflow;
        documentElement.style.overflow = previousDocumentOverflow;
      }
    };
  }, [isLocked]);
}
