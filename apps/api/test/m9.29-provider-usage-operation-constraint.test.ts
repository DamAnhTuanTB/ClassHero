import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PROVIDER_USAGE_OPERATIONS } from "@learning-path/shared";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260909190000_allow_test_solution_usage_operations/migration.sql",
);

describe("M9.29 provider usage operation constraint", () => {
  it("keeps the database allowlist aligned with every supported usage operation", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain(
      'DROP CONSTRAINT IF EXISTS "provider_usage_events_operation_check"',
    );
    expect(migration).toContain('ADD CONSTRAINT "provider_usage_events_operation_check"');

    for (const operation of PROVIDER_USAGE_OPERATIONS) {
      expect(migration).toContain(`'${operation}'`);
    }
  });
});
