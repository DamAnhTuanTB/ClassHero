import { describe, expect, it } from "vitest";

import { validateEnv } from "#api/config/env.validation";
import {
  jobFailureCodes,
  normalizeJobError,
  ProviderRequestError,
  readJobErrorDetails,
} from "#api/jobs/job-error";

describe("background job provider errors", () => {
  it("maps invalid Mathpix credentials without exposing the provider response", () => {
    const error = new ProviderRequestError({
      provider: "MATHPIX",
      message: "Mathpix could not submit PDF.",
      httpStatus: 401,
      providerCode: "invalid_credentials",
    });

    expect(normalizeJobError(error)).toEqual(
      expect.objectContaining({
        code: jobFailureCodes.CREDENTIAL_INVALID,
        provider: "MATHPIX",
        httpStatus: 401,
        retryable: false,
        message: expect.stringContaining("Mathpix"),
        action: expect.stringContaining("MATHPIX_APP_ID"),
      }),
    );
  });

  it("distinguishes OpenAI quota exhaustion from a temporary rate limit", () => {
    const quota = Object.assign(new Error("You exceeded your current quota."), {
      status: 429,
      code: "insufficient_quota",
    });
    const rateLimit = Object.assign(new Error("Too many requests"), {
      status: 429,
      code: "rate_limit_exceeded",
    });

    expect(normalizeJobError(quota, "OPENAI").code).toBe(
      jobFailureCodes.QUOTA_EXCEEDED,
    );
    expect(normalizeJobError(rateLimit, "OPENAI")).toEqual(
      expect.objectContaining({
        code: jobFailureCodes.RATE_LIMITED,
        retryable: true,
      }),
    );
  });

  it("maps timeout and bad input to different retry policies", () => {
    const timeout = new ProviderRequestError({
      provider: "MATHPIX",
      message: "Request timed out",
      providerCode: "TimeoutError",
    });
    const badInput = new ProviderRequestError({
      provider: "MATHPIX",
      message: "Mathpix rejected the request",
      httpStatus: 400,
    });

    expect(normalizeJobError(timeout)).toEqual(
      expect.objectContaining({ code: jobFailureCodes.TIMEOUT, retryable: true }),
    );
    expect(normalizeJobError(badInput)).toEqual(
      expect.objectContaining({
        code: jobFailureCodes.REQUEST_INVALID,
        retryable: false,
      }),
    );
  });

  it("reads only complete structured error details from a durable job result", () => {
    const details = normalizeJobError(
      Object.assign(new Error("Incorrect API key provided"), { status: 401 }),
      "OPENAI",
    );

    expect(readJobErrorDetails({ errorDetails: details })).toEqual(details);
    expect(readJobErrorDetails({ errorDetails: { code: "INCOMPLETE" } })).toBeNull();
  });

  it("does not blame a configured provider for an unrelated internal error", () => {
    expect(normalizeJobError(new Error("Persistence mapping failed"), "OPENAI")).toEqual(
      expect.objectContaining({
        code: jobFailureCodes.JOB_FAILED,
        provider: null,
      }),
    );
  });
});

describe("provider environment placeholders", () => {
  const baseEnv = {
    NODE_ENV: "development",
    WEB_URL: "http://localhost:3000",
    API_URL: "http://localhost:4000",
    DATABASE_URL: "postgresql://user:password@localhost:5432/app",
    JWT_ACCESS_SECRET: "local-access-secret",
    JWT_REFRESH_SECRET: "local-refresh-secret",
    REDIS_URL: "redis://localhost:6379",
    S3_ENDPOINT: "http://localhost:9000",
    S3_ACCESS_KEY_ID: "local-access-key",
    S3_SECRET_ACCESS_KEY: "local-secret-key",
    S3_BUCKET_NAME: "learning-path",
  };

  it("rejects placeholder OpenAI credentials before API or worker startup", () => {
    expect(() => validateEnv({ ...baseEnv, OPENAI_API_KEY: "change-me" })).toThrow(
      /OPENAI_API_KEY must not use a placeholder value/u,
    );
  });

  it("rejects placeholder Mathpix credentials when paid OCR is enabled", () => {
    expect(() =>
      validateEnv({
        ...baseEnv,
        OCR_PAID_ENABLED: "true",
        MATHPIX_APP_ID: "change-me",
        MATHPIX_APP_KEY: "replace-me",
      }),
    ).toThrow(/MATHPIX_APP_ID must contain a real credential/u);
  });
});
