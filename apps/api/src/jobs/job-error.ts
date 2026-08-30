export function getJobErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown job error";
}

export const jobFailureCodes = {
  CREDENTIAL_MISSING: "PROVIDER_CREDENTIAL_MISSING",
  CREDENTIAL_INVALID: "PROVIDER_CREDENTIAL_INVALID",
  QUOTA_EXCEEDED: "PROVIDER_QUOTA_EXCEEDED",
  RATE_LIMITED: "PROVIDER_RATE_LIMITED",
  TIMEOUT: "PROVIDER_TIMEOUT",
  UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  REQUEST_INVALID: "PROVIDER_REQUEST_INVALID",
  JOB_FAILED: "JOB_FAILED",
} as const;

export type JobFailureCode =
  (typeof jobFailureCodes)[keyof typeof jobFailureCodes] | string;
export type JobProvider = "OPENAI" | "MATHPIX" | "GEMINI";

export type JobErrorDetails = {
  code: JobFailureCode;
  provider: JobProvider | null;
  message: string;
  action: string;
  httpStatus: number | null;
  retryable: boolean;
};

export class ProviderRequestError extends Error {
  readonly provider: JobProvider;
  readonly httpStatus: number | null;
  readonly providerCode: string | null;

  constructor(input: {
    provider: JobProvider;
    message: string;
    httpStatus?: number | null;
    providerCode?: string | null;
    cause?: unknown;
  }) {
    super(input.message, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = "ProviderRequestError";
    this.provider = input.provider;
    this.httpStatus = input.httpStatus ?? null;
    this.providerCode = input.providerCode ?? null;
  }
}

export function normalizeJobError(
  error: unknown,
  providerHint?: JobProvider | null,
): JobErrorDetails {
  const status = readNumber(error, "status") ?? readNumber(error, "httpStatus");
  const errorCode = readErrorCode(error);
  const normalizedCode = errorCode?.toLowerCase() ?? "";
  const normalizedMessage = getJobErrorMessage(error).toLowerCase();
  const provider =
    readProvider(error) ??
    (isProviderShapedError(error, status, normalizedCode, normalizedMessage)
      ? (providerHint ?? null)
      : null);

  if (isKnownSafeError(error)) {
    return {
      code: error.code,
      provider,
      message: sanitizeStoredMessage(error.message, "Tác vụ không thể hoàn tất."),
      action: "Kiểm tra lại dữ liệu hoặc cấu hình của tác vụ rồi thử lại.",
      httpStatus: status,
      retryable: false,
    };
  }

  if (
    normalizedCode.includes("missing") ||
    normalizedMessage.includes("api key is missing") ||
    normalizedMessage.includes("api key not configured")
  ) {
    return providerFailure(
      jobFailureCodes.CREDENTIAL_MISSING,
      provider,
      status,
      false,
    );
  }

  if (
    status === 401 ||
    status === 403 ||
    normalizedCode.includes("invalid_api_key") ||
    normalizedCode.includes("authentication") ||
    normalizedMessage.includes("incorrect api key") ||
    normalizedMessage.includes("invalid credentials")
  ) {
    return providerFailure(
      jobFailureCodes.CREDENTIAL_INVALID,
      provider,
      status,
      false,
    );
  }

  if (
    normalizedCode.includes("insufficient_quota") ||
    normalizedCode.includes("quota_exceeded") ||
    normalizedMessage.includes("insufficient quota") ||
    normalizedMessage.includes("exceeded your current quota")
  ) {
    return providerFailure(jobFailureCodes.QUOTA_EXCEEDED, provider, status, false);
  }

  if (status === 429) {
    return providerFailure(jobFailureCodes.RATE_LIMITED, provider, status, true);
  }

  if (
    status === 408 ||
    normalizedCode.includes("timeout") ||
    normalizedMessage.includes("timeout") ||
    normalizedMessage.includes("timed out") ||
    readString(error, "name") === "AbortError" ||
    readString(error, "name") === "TimeoutError"
  ) {
    return providerFailure(jobFailureCodes.TIMEOUT, provider, status, true);
  }

  if (
    (status !== null && status >= 500) ||
    ["econnreset", "econnrefused", "enotfound", "eai_again"].some((code) =>
      normalizedCode.includes(code),
    )
  ) {
    return providerFailure(jobFailureCodes.UNAVAILABLE, provider, status, true);
  }

  if (status === 400 || status === 404 || status === 409 || status === 422) {
    return providerFailure(jobFailureCodes.REQUEST_INVALID, provider, status, false);
  }

  if (provider) {
    return providerFailure(jobFailureCodes.UNAVAILABLE, provider, status, true);
  }

  return {
    code: jobFailureCodes.JOB_FAILED,
    provider: null,
    message: "Tác vụ nền gặp lỗi và chưa thể hoàn tất.",
    action: "Thử lại tác vụ. Nếu lỗi lặp lại, kiểm tra log của API và worker.",
    httpStatus: status,
    retryable: true,
  };
}

export function readJobErrorDetails(result: unknown): JobErrorDetails | null {
  if (!isRecord(result) || !isRecord(result.errorDetails)) return null;
  const details = result.errorDetails;
  const code = readString(details, "code");
  const message = readString(details, "message");
  const action = readString(details, "action");
  const provider = readString(details, "provider");
  const retryable = details.retryable;
  if (!code || !message || !action || typeof retryable !== "boolean") return null;

  return {
    code,
    provider:
      provider === "OPENAI" || provider === "MATHPIX" || provider === "GEMINI"
        ? provider
        : null,
    message,
    action,
    httpStatus: readNumber(details, "httpStatus"),
    retryable,
  };
}

function providerFailure(
  code: (typeof jobFailureCodes)[keyof typeof jobFailureCodes],
  provider: JobProvider | null,
  httpStatus: number | null,
  retryable: boolean,
): JobErrorDetails {
  const label = providerLabel(provider);
  const configuration = providerConfiguration(provider);
  const copy = {
    [jobFailureCodes.CREDENTIAL_MISSING]: {
      message: `Backend chưa được cấu hình thông tin xác thực ${label}.`,
      action: `Kiểm tra ${configuration} trong cấu hình backend rồi khởi động lại API và worker.`,
    },
    [jobFailureCodes.CREDENTIAL_INVALID]: {
      message: `Thông tin xác thực ${label} không hợp lệ hoặc đã bị thu hồi.`,
      action: `Cập nhật ${configuration} trong cấu hình backend rồi khởi động lại API và worker.`,
    },
    [jobFailureCodes.QUOTA_EXCEEDED]: {
      message: `Tài khoản ${label} đã hết hạn mức sử dụng.`,
      action: `Kiểm tra quota hoặc thanh toán của ${label}, sau đó thử lại.`,
    },
    [jobFailureCodes.RATE_LIMITED]: {
      message: `${label} đang giới hạn tần suất gọi.`,
      action: "Chờ một lúc rồi thử lại; giảm số job chạy đồng thời nếu lỗi lặp lại.",
    },
    [jobFailureCodes.TIMEOUT]: {
      message: `${label} phản hồi quá thời gian cho phép.`,
      action: "Kiểm tra kết nối mạng và trạng thái provider rồi thử lại.",
    },
    [jobFailureCodes.UNAVAILABLE]: {
      message: `${label} tạm thời không khả dụng hoặc kết nối đã bị gián đoạn.`,
      action: "Kiểm tra kết nối mạng, trạng thái provider và log worker rồi thử lại.",
    },
    [jobFailureCodes.REQUEST_INVALID]: {
      message: `Yêu cầu gửi đến ${label} không hợp lệ.`,
      action: "Kiểm tra cấu hình model, file đầu vào và log worker trước khi thử lại.",
    },
    [jobFailureCodes.JOB_FAILED]: {
      message: "Tác vụ nền gặp lỗi và chưa thể hoàn tất.",
      action: "Thử lại tác vụ. Nếu lỗi lặp lại, kiểm tra log của API và worker.",
    },
  }[code];

  return { code, provider, httpStatus, retryable, ...copy };
}

function providerLabel(provider: JobProvider | null) {
  if (provider === "OPENAI") return "OpenAI";
  if (provider === "MATHPIX") return "Mathpix";
  if (provider === "GEMINI") return "Gemini";
  return "dịch vụ bên thứ ba";
}

function providerConfiguration(provider: JobProvider | null) {
  if (provider === "OPENAI") return "OPENAI_API_KEY";
  if (provider === "MATHPIX") return "MATHPIX_APP_ID và MATHPIX_APP_KEY";
  if (provider === "GEMINI") return "GEMINI_API_KEY";
  return "biến môi trường của provider";
}

function readProvider(error: unknown): JobProvider | null {
  if (!isRecord(error)) return null;
  const direct = readString(error, "provider");
  const details = isRecord(error.details) ? readString(error.details, "provider") : null;
  const value = (direct ?? details)?.toUpperCase();
  if (value === "OPENAI" || value === "MATHPIX" || value === "GEMINI") return value;
  const signature = `${readString(error, "name") ?? ""} ${getJobErrorMessage(error)}`;
  if (/openai/iu.test(signature)) return "OPENAI";
  if (/mathpix/iu.test(signature)) return "MATHPIX";
  if (/gemini|google generative/iu.test(signature)) return "GEMINI";
  return null;
}

function readErrorCode(error: unknown): string | null {
  if (!isRecord(error)) return null;
  return readString(error, "providerCode") ?? readString(error, "code");
}

function isProviderShapedError(
  error: unknown,
  status: number | null,
  normalizedCode: string,
  normalizedMessage: string,
) {
  if (error instanceof ProviderRequestError || status !== null) return true;
  const name = readString(error, "name")?.toLowerCase() ?? "";
  return (
    normalizedCode.length > 0 ||
    /api|provider|connection|rate.?limit|timeout/u.test(name) ||
    /api key|provider|quota|rate.?limit|timeout|timed out|connection/u.test(
      normalizedMessage,
    )
  );
}

function isKnownSafeError(error: unknown): error is Error & { code: string } {
  if (!(error instanceof Error) || !isRecord(error)) return false;
  const code = readString(error, "code");
  return Boolean(
    code &&
      (code.startsWith("OPENAI_INCOMPLETE_") ||
        code === "OPENAI_REFUSED" ||
        code === "OPENAI_STRUCTURED_OUTPUT_MISSING" ||
        code === "AI_OUTPUT_INVALID" ||
        code.startsWith("PROVIDER_BUDGET_")),
  );
}

function sanitizeStoredMessage(message: string, fallback: string) {
  const normalized = message.replace(/[\r\n]+/gu, " ").trim().slice(0, 1_000);
  return normalized || fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown, key: string): string | null {
  if (!isRecord(value)) return null;
  const item = value[key];
  return typeof item === "string" && item.length > 0 ? item : null;
}

function readNumber(value: unknown, key: string): number | null {
  if (!isRecord(value)) return null;
  const item = value[key];
  return typeof item === "number" && Number.isFinite(item) ? item : null;
}
