import { Prisma } from "@prisma/client";

export function toFlashcardInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function toFlashcardRecord(
  value: Prisma.JsonValue,
  fieldName: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Stored ${fieldName} is not a JSON object`);
  }
  return value as Record<string, unknown>;
}
