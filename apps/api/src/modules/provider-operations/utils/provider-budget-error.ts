export const providerBudgetErrorCodes = {
  HARD_LIMIT: "PROVIDER_BUDGET_HARD_LIMIT",
  ESTIMATE_UNAVAILABLE: "PROVIDER_BUDGET_ESTIMATE_UNAVAILABLE",
} as const;

export type ProviderBudgetErrorCode =
  (typeof providerBudgetErrorCodes)[keyof typeof providerBudgetErrorCodes];

export class ProviderBudgetError extends Error {
  readonly code: ProviderBudgetErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ProviderBudgetErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(`${code}: ${message}`);
    this.name = "ProviderBudgetError";
    this.code = code;
    this.details = details;
  }
}

export function isProviderBudgetError(error: unknown): error is ProviderBudgetError {
  return error instanceof ProviderBudgetError;
}
