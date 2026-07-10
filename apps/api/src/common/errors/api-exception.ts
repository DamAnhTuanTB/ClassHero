import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

export type ApiErrorBody = {
  code: string;
  message: string;
  details?: unknown;
};

export function createApiErrorBody(
  code: string,
  message: string,
  details?: unknown,
): ApiErrorBody {
  return {
    code,
    message,
    ...(details !== undefined ? { details } : {}),
  };
}

export function badRequestException(code: string, message: string, details?: unknown) {
  return new BadRequestException(createApiErrorBody(code, message, details));
}

export function unauthorizedException(code: string, message: string, details?: unknown) {
  return new UnauthorizedException(createApiErrorBody(code, message, details));
}

export function forbiddenException(code: string, message: string, details?: unknown) {
  return new ForbiddenException(createApiErrorBody(code, message, details));
}

export function notFoundException(code: string, message: string, details?: unknown) {
  return new NotFoundException(createApiErrorBody(code, message, details));
}

export function conflictException(code: string, message: string, details?: unknown) {
  return new ConflictException(createApiErrorBody(code, message, details));
}

export function internalServerErrorException(
  code: string,
  message: string,
  details?: unknown,
) {
  return new InternalServerErrorException(createApiErrorBody(code, message, details));
}

export function throwBadRequest(code: string, message: string, details?: unknown): never {
  throw badRequestException(code, message, details);
}

export function throwUnauthorized(
  code: string,
  message: string,
  details?: unknown,
): never {
  throw unauthorizedException(code, message, details);
}

export function throwForbidden(code: string, message: string, details?: unknown): never {
  throw forbiddenException(code, message, details);
}

export function throwNotFound(code: string, message: string, details?: unknown): never {
  throw notFoundException(code, message, details);
}

export function throwConflict(code: string, message: string, details?: unknown): never {
  throw conflictException(code, message, details);
}

export function throwInternalServerError(
  code: string,
  message: string,
  details?: unknown,
): never {
  throw internalServerErrorException(code, message, details);
}
