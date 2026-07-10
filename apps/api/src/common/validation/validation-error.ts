import { BadRequestException, ValidationPipe } from "@nestjs/common";
import type { Type, ValidationError } from "@nestjs/common";

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
  return new BadRequestException({
    code: "VALIDATION_ERROR",
    message: "Dữ liệu không hợp lệ",
    details: flattenValidationErrors(errors),
  });
}

export function createDtoValidationPipe<T extends object>(expectedType: Type<T>) {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
    expectedType,
    exceptionFactory: createValidationException,
  });
}
