import type { ValidationError } from "@nestjs/common";
import { badRequestException } from "#api/common/errors/api-exception";

type ValidationErrorDetail = {
  field: string;
  messages: string[];
};

function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = "",
): ValidationErrorDetail[] {
  return errors.flatMap((error) => {
    const fieldPath = parentPath ? `${parentPath}.${error.property}` : error.property;
    const current =
      error.constraints && Object.keys(error.constraints).length > 0
        ? [
            {
              field: fieldPath,
              messages: Object.values(error.constraints),
            },
          ]
        : [];

    const children =
      error.children && error.children.length > 0
        ? flattenValidationErrors(error.children, fieldPath)
        : [];

    return [...current, ...children];
  });
}

export function createValidationException(errors: ValidationError[]) {
  return badRequestException(
    "VALIDATION_ERROR",
    "Dữ liệu không hợp lệ",
    flattenValidationErrors(errors),
  );
}
