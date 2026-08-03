import type { ZodError } from "zod";

import type { AiOutputSchema } from "#api/modules/ai/types/ai-text.types";

export class AiOutputValidationError extends Error {
  readonly code = "AI_OUTPUT_INVALID";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AiOutputValidationError";
  }
}

export function parseAiStructuredOutput<TOutput>(
  schema: AiOutputSchema<TOutput>,
  value: unknown,
): TOutput {
  const parsed = schema.safeParse(value);

  if (parsed.success) {
    return parsed.data;
  }

  throw new AiOutputValidationError(
    `AI structured output failed schema validation: ${formatZodError(parsed.error)}`,
    { cause: parsed.error },
  );
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
