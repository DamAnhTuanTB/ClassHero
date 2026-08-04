import { Prisma, type ProviderBudgetScope } from "@prisma/client";

export async function lockProviderBudgetScopes(
  transaction: Prisma.TransactionClient,
  periodKey: string,
  scopes: ProviderBudgetScope[],
) {
  for (const scope of [...scopes].sort()) {
    const lockKey = `provider-budget:${periodKey}:${scope}`;
    await transaction.$queryRaw`
      SELECT 1::int AS acquired
      FROM pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
    `;
  }
}
