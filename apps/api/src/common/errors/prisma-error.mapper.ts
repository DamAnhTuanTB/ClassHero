import { Prisma } from "@prisma/client";

export function isPrismaKnownRequestError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError;
}

export function isPrismaUniqueConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return isPrismaKnownRequestError(error) && error.code === "P2002";
}

export function isPrismaRecordNotFoundError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return isPrismaKnownRequestError(error) && error.code === "P2025";
}

export function isPrismaForeignKeyConstraintError(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return isPrismaKnownRequestError(error) && error.code === "P2003";
}

export function getPrismaUniqueTarget(error: unknown): string[] {
  if (!isPrismaUniqueConstraintError(error)) {
    return [];
  }

  const target = error.meta?.target;

  return Array.isArray(target)
    ? target.filter((item): item is string => typeof item === "string")
    : [];
}
