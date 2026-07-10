import { z } from "zod";

type RequiredTrimmedTextOptions = {
  requiredMessage: string;
  minLength?: number;
  minMessage?: string;
  maxLength?: number;
  maxMessage?: string;
};

export function requiredTrimmedText({
  requiredMessage,
  minLength,
  minMessage,
  maxLength,
  maxMessage,
}: RequiredTrimmedTextOptions) {
  let schema = z.string().trim().min(1, requiredMessage);

  if (minLength && minLength > 1) {
    schema = schema.min(minLength, minMessage ?? `Tối thiểu ${minLength} ký tự`);
  }

  if (maxLength) {
    schema = schema.max(maxLength, maxMessage);
  }

  return schema;
}
