const defaultApiBaseUrl = "http://localhost:4000/api/v1";

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: BodyInit | unknown;
  cache?: RequestCache;
  token?: string;
  headers?: HeadersInit;
  keepalive?: boolean;
  timeoutMs?: number;
};

export type ApiSuccessEnvelope<
  TData,
  TMeta extends Record<string, unknown> = Record<string, unknown>,
> = {
  data: TData;
  meta?: TMeta;
};

type ApiErrorEnvelope = {
  error: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

export class ApiRequestError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor({
    statusCode,
    code,
    message,
    details,
  }: {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
  }) {
    super(message);
    this.name = "ApiRequestError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

function getApiBaseUrl() {
  let baseUrl = process.env.NEXT_PUBLIC_API_URL ?? defaultApiBaseUrl;
  if (
    typeof window !== "undefined" &&
    baseUrl.includes("localhost") &&
    window.location.hostname !== "localhost"
  ) {
    baseUrl = baseUrl.replace("localhost", window.location.hostname);
  }
  return baseUrl.replace(/\/$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSuccessEnvelope<TData>(value: unknown): value is ApiSuccessEnvelope<TData> {
  return isRecord(value) && "data" in value;
}

function parseErrorEnvelope(payload: unknown, statusCode: number) {
  if (isRecord(payload) && isRecord(payload.error)) {
    const error = payload.error as ApiErrorEnvelope["error"];

    return {
      code: typeof error.code === "string" ? error.code : "REQUEST_FAILED",
      message:
        typeof error.message === "string" ? error.message : "Chưa thể hoàn tất yêu cầu.",
      details: error.details,
    };
  }

  return {
    code: "REQUEST_FAILED",
    message:
      statusCode >= 500
        ? "Máy chủ đang bận. Vui lòng thử lại sau ít phút."
        : "Yêu cầu chưa hợp lệ.",
    details: undefined,
  };
}

async function readJsonResponse(response: Response) {
  const contentType = response.headers.get("content-type");

  if (!contentType?.includes("application/json")) {
    return undefined;
  }

  return response.json() as Promise<unknown>;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs?: number,
) {
  const normalizedTimeoutMs =
    typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0
      ? Math.floor(timeoutMs)
      : null;
  if (normalizedTimeoutMs === null) {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), normalizedTimeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ApiRequestError({
        statusCode: 408,
        code: "REQUEST_TIMEOUT",
        message: "Máy chủ phản hồi quá lâu. Vui lòng thử lại.",
        details: { timeoutMs: normalizedTimeoutMs },
      });
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

export async function apiRequest<TData>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TData> {
  const envelope = await apiRequestEnvelope<TData>(path, options);

  return envelope.data;
}

export async function apiRequestEnvelope<
  TData,
  TMeta extends Record<string, unknown> = Record<string, unknown>,
>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiSuccessEnvelope<TData, TMeta>> {
  const headers = new Headers(options.headers);
  const isFormDataBody =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  if (options.body !== undefined && !isFormDataBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const requestBody: BodyInit | undefined =
    options.body === undefined
      ? undefined
      : isFormDataBody
        ? (options.body as BodyInit)
        : JSON.stringify(options.body);

  const response = await fetchWithTimeout(
    `${getApiBaseUrl()}${path}`,
    {
      method: options.method ?? "GET",
      headers,
      body: requestBody,
      cache: options.cache,
      keepalive: options.keepalive,
    },
    options.timeoutMs,
  );
  const payload = await readJsonResponse(response);

  if (!response.ok) {
    const error = parseErrorEnvelope(payload, response.status);
    throw new ApiRequestError({
      statusCode: response.status,
      code: error.code,
      message: error.message,
      details: error.details,
    });
  }

  if (isSuccessEnvelope<TData>(payload)) {
    return payload as ApiSuccessEnvelope<TData, TMeta>;
  }

  return { data: payload as TData };
}
