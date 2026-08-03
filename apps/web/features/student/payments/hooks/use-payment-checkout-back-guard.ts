"use client";

import { useEffect } from "react";
import {
  clearPaymentCheckoutHistory,
  readPaymentCheckoutHistory,
} from "@/features/student/payments/utils/payment-checkout-history";

const PAYMENT_RESULT_HISTORY_STATE_KEY = "__classHeroPaymentResultHistory";
const MAX_PROVIDER_HISTORY_ENTRIES = 10;

type PaymentResultHistoryState = {
  paymentId: string;
  originHref: string;
  providerEntryCount: number;
  position: "base" | "guard";
};

function readResultHistoryState(paymentId: string) {
  const historyState = window.history.state as Record<string, unknown> | null;
  const paymentState = historyState?.[
    PAYMENT_RESULT_HISTORY_STATE_KEY
  ] as Partial<PaymentResultHistoryState> | undefined;

  if (
    paymentState?.paymentId !== paymentId ||
    typeof paymentState.originHref !== "string" ||
    typeof paymentState.providerEntryCount !== "number" ||
    !Number.isInteger(paymentState.providerEntryCount) ||
    (paymentState.position !== "base" && paymentState.position !== "guard")
  ) {
    return null;
  }

  return paymentState as PaymentResultHistoryState;
}

function withPaymentHistoryState(paymentState: PaymentResultHistoryState) {
  const currentState = window.history.state;
  const safeCurrentState =
    typeof currentState === "object" && currentState !== null ? currentState : {};

  return {
    ...safeCurrentState,
    [PAYMENT_RESULT_HISTORY_STATE_KEY]: paymentState,
  };
}

export function usePaymentCheckoutBackGuard({
  enabled,
  fallbackHref,
  paymentId,
}: {
  enabled: boolean;
  fallbackHref: string;
  paymentId: string;
}) {
  useEffect(() => {
    if (!enabled) return;

    const existingState = readResultHistoryState(paymentId);
    const checkoutHistory = readPaymentCheckoutHistory(paymentId);
    const providerEntryCount =
      existingState?.providerEntryCount ??
      (checkoutHistory
        ? window.history.length - checkoutHistory.historyLength
        : 0);
    const originHref = existingState?.originHref ?? checkoutHistory?.originHref;
    const hasSafeProviderHistory =
      typeof originHref === "string" &&
      providerEntryCount >= 1 &&
      providerEntryCount <= MAX_PROVIDER_HISTORY_ENTRIES;

    if (!hasSafeProviderHistory) return;

    if (!existingState || existingState.position === "base") {
      const baseState: PaymentResultHistoryState = {
        paymentId,
        originHref,
        providerEntryCount,
        position: "base",
      };
      const guardState: PaymentResultHistoryState = {
        ...baseState,
        position: "guard",
      };

      window.history.replaceState(
        withPaymentHistoryState(baseState),
        "",
        window.location.href,
      );
      window.history.pushState(
        withPaymentHistoryState(guardState),
        "",
        window.location.href,
      );
    }

    const handlePopState = (event: PopStateEvent) => {
      const eventState = event.state as Record<string, unknown> | null;
      const paymentState = eventState?.[
        PAYMENT_RESULT_HISTORY_STATE_KEY
      ] as Partial<PaymentResultHistoryState> | undefined;

      if (
        paymentState?.paymentId !== paymentId ||
        paymentState.position !== "base"
      ) {
        return;
      }

      clearPaymentCheckoutHistory(paymentId);

      if (
        Number.isInteger(paymentState.providerEntryCount) &&
        Number(paymentState.providerEntryCount) >= 1 &&
        Number(paymentState.providerEntryCount) <= MAX_PROVIDER_HISTORY_ENTRIES
      ) {
        window.history.go(-Number(paymentState.providerEntryCount));
        return;
      }

      window.location.replace(originHref || fallbackHref);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [enabled, fallbackHref, paymentId]);
}
