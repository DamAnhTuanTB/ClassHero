const PAYMENT_CHECKOUT_HISTORY_PREFIX = "classhero.payment-checkout-history";
const PAYMENT_CHECKOUT_HISTORY_TTL_MS = 2 * 60 * 60 * 1000;

export type PaymentCheckoutHistory = {
  paymentId: string;
  originHref: string;
  historyLength: number;
  createdAt: number;
};

function getStorageKey(paymentId: string) {
  return `${PAYMENT_CHECKOUT_HISTORY_PREFIX}:${paymentId}`;
}

function isSameOriginHref(href: string) {
  try {
    return new URL(href, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function rememberPaymentCheckoutHistory(paymentId: string) {
  if (typeof window === "undefined" || !paymentId) return;

  const marker: PaymentCheckoutHistory = {
    paymentId,
    originHref: window.location.href,
    historyLength: window.history.length,
    createdAt: Date.now(),
  };

  try {
    window.sessionStorage.setItem(getStorageKey(paymentId), JSON.stringify(marker));
  } catch {
    // The checkout remains usable when sessionStorage is blocked.
  }
}

export function readPaymentCheckoutHistory(paymentId: string) {
  if (typeof window === "undefined" || !paymentId) return null;

  try {
    const rawMarker = window.sessionStorage.getItem(getStorageKey(paymentId));
    if (!rawMarker) return null;

    const marker = JSON.parse(rawMarker) as Partial<PaymentCheckoutHistory>;
    const isValid =
      marker.paymentId === paymentId &&
      typeof marker.originHref === "string" &&
      isSameOriginHref(marker.originHref) &&
      typeof marker.historyLength === "number" &&
      Number.isInteger(marker.historyLength) &&
      marker.historyLength > 0 &&
      typeof marker.createdAt === "number" &&
      Date.now() - marker.createdAt <= PAYMENT_CHECKOUT_HISTORY_TTL_MS;

    if (!isValid) {
      clearPaymentCheckoutHistory(paymentId);
      return null;
    }

    return marker as PaymentCheckoutHistory;
  } catch {
    clearPaymentCheckoutHistory(paymentId);
    return null;
  }
}

export function clearPaymentCheckoutHistory(paymentId: string) {
  if (typeof window === "undefined" || !paymentId) return;

  try {
    window.sessionStorage.removeItem(getStorageKey(paymentId));
  } catch {
    // Nothing else is required when sessionStorage is blocked.
  }
}
