import type { AiProviderName } from "@prisma/client";
import type { ZodError } from "zod";

import type {
  AiProviderOutputMetadata,
  AiOutputSchema,
  AiTokenUsage,
} from "#api/modules/ai/types/ai-text.types";

export type AiProviderOutputErrorCode =
  | "OPENAI_INCOMPLETE_MAX_OUTPUT_TOKENS"
  | "OPENAI_INCOMPLETE_CONTENT_FILTER"
  | "OPENAI_REFUSED"
  | "OPENAI_STRUCTURED_OUTPUT_MISSING";

export type AiProviderOutputFailureDetails = {
  provider: AiProviderName;
  model: string;
  providerRequestId?: string;
  usage?: AiTokenUsage;
  providerUsageRaw?: unknown;
  inputFileOperations?: AiProviderOutputMetadata["inputFileOperations"];
  latencyMs?: number;
  responseStatus: string | null;
  incompleteReason: string | null;
  hasRefusal: boolean;
  maxOutputTokens?: number;
};

export class AiOutputValidationError extends Error {
  readonly code: string;

  constructor(message: string, options?: { cause?: unknown; code?: string }) {
    super(message, options);
    this.name = "AiOutputValidationError";
    this.code = options?.code ?? "AI_OUTPUT_INVALID";
  }
}

export class AiProviderOutputError extends AiOutputValidationError {
  constructor(
    code: AiProviderOutputErrorCode,
    message: string,
    readonly details: AiProviderOutputFailureDetails,
  ) {
    super(message, { code });
    this.name = "AiProviderOutputError";
  }
}

export function isAiProviderOutputError(error: unknown): error is AiProviderOutputError {
  return error instanceof AiProviderOutputError;
}

export function parseAiStructuredOutput<TOutput>(
  schema: AiOutputSchema<TOutput>,
  value: unknown,
): TOutput {
  const parsed = schema.safeParse(sanitizeAiStructuredOutput(value));

  if (parsed.success) {
    return parsed.data;
  }

  throw new AiOutputValidationError(
    `AI structured output failed schema validation: ${formatZodError(parsed.error)}`,
    { cause: parsed.error },
  );
}

/**
 * PostgreSQL jsonb cannot represent U+0000 even though it is valid inside a
 * parsed JavaScript string. Provider output is JSON-compatible, so remove only
 * that non-semantic character recursively before the final Zod persistence
 * gate. Other control characters and valid Unicode remain untouched.
 */
function sanitizeAiStructuredOutput(value: unknown): unknown {
  if (typeof value === "string") {
    return value.replaceAll("\u0000", "");
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeAiStructuredOutput);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key.replaceAll("\u0000", ""),
        sanitizeAiStructuredOutput(entryValue),
      ]),
    );
  }
  return value;
}

export function assertAiOutputName(outputName: string): void {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(outputName)) {
    throw new AiOutputValidationError(
      "AI outputName must contain only letters, numbers, underscores, or hyphens and be at most 64 characters.",
    );
  }
}

function formatZodError(error: ZodError): string {
  return error.issues
    .slice(0, 5)
    .map((issue) => `${issue.path.join(".") || "output"}: ${issue.message}`)
    .join("; ");
}
