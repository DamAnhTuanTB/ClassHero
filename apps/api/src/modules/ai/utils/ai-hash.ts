import { createHash } from "node:crypto";

export function hashAiValue(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(normalizeValue(value)))
    .digest("hex");
}

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeValue);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, normalizeValue(item)]),
    );
  }

  return value;
}
