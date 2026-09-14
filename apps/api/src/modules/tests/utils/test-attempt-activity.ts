import { AttemptStatus } from "@prisma/client";
import type { PrismaService } from "#api/common/prisma/prisma.service";

export const TEST_ATTEMPT_EXPIRY_GRACE_MS = 60_000;

type TestAttemptActivityPrisma = Pick<PrismaService, "testAttempt">;

export async function hasActiveStudentTestAttempt(
  prisma: TestAttemptActivityPrisma,
  studentUserId: string,
  now = new Date(),
) {
  const attempts = await prisma.testAttempt.findMany({
    where: {
      studentUserId,
      status: AttemptStatus.IN_PROGRESS,
    },
    select: {
      id: true,
      startedAt: true,
      testSet: { select: { durationSeconds: true } },
    },
  });
  const nowMs = now.getTime();
  const expiredIds = attempts.flatMap((attempt) => {
    const expiresAtMs =
      attempt.startedAt.getTime() +
      Math.max(0, attempt.testSet.durationSeconds) * 1_000 +
      TEST_ATTEMPT_EXPIRY_GRACE_MS;
    return expiresAtMs <= nowMs ? [attempt.id] : [];
  });

  if (expiredIds.length > 0) {
    await prisma.testAttempt.updateMany({
      where: {
        id: { in: expiredIds },
        studentUserId,
        status: AttemptStatus.IN_PROGRESS,
      },
      data: { status: AttemptStatus.CANCELLED },
    });
  }

  return attempts.some((attempt) => !expiredIds.includes(attempt.id));
}
