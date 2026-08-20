import { createHash } from "node:crypto";
import {
  stemFigureDiagnosticBatchSchema,
  type StemFigureDiagnosticBatch,
} from "@learning-path/shared";

type DiagnosticIssueInput = {
  code: string;
  severity?: "ERROR" | "WARNING";
  message: string;
  file?: string | null;
  line?: number | null;
  column?: number | null;
  element?: string | null;
  path?: string | null;
};

export function createStemFigureDiagnosticBatch(input: {
  attemptId: string;
  sourceVersion: number;
  sourceHash: string;
  category: "COMPILER" | "SOURCE_POLICY" | "VALIDATOR" | "INFRASTRUCTURE";
  issues: DiagnosticIssueInput[];
  rawLogExcerpt?: string;
  collectionComplete: boolean;
  createdAt?: Date;
}): StemFigureDiagnosticBatch {
  const issues = deduplicateIssues(input.issues).map((issue) => ({
    code: issue.code.trim().slice(0, 160),
    severity: issue.severity ?? "ERROR",
    message: issue.message.trim().slice(0, 4_000) || issue.code,
    file: issue.file?.trim().slice(0, 500) || null,
    line: positiveIntegerOrNull(issue.line),
    column: nonnegativeIntegerOrNull(issue.column),
    element: issue.element?.trim().slice(0, 200) || null,
    path: issue.path?.trim().slice(0, 500) || null,
  }));
  if (issues.length === 0) {
    issues.push({
      code: `${input.category}_FAILED`,
      severity: "ERROR",
      message: `${input.category} failed without structured diagnostics.`,
      file: null,
      line: null,
      column: null,
      element: null,
      path: null,
    });
  }
  const createdAt = (input.createdAt ?? new Date()).toISOString();
  const payloadWithoutHash = {
    attemptId: input.attemptId,
    sourceVersion: input.sourceVersion,
    sourceHash: input.sourceHash,
    category: input.category,
    issues,
    rawLogExcerpt: (input.rawLogExcerpt ?? "").slice(-80_000),
    collectionComplete: input.collectionComplete,
    createdAt,
  };
  const batchHash = createHash("sha256")
    .update(JSON.stringify(payloadWithoutHash))
    .digest("hex");
  return stemFigureDiagnosticBatchSchema.parse({
    ...payloadWithoutHash,
    batchHash,
  });
}

export function parseStemFigureDiagnosticBatch(
  value: unknown,
): StemFigureDiagnosticBatch | null {
  const parsed = stemFigureDiagnosticBatchSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function deduplicateIssues(issues: DiagnosticIssueInput[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = JSON.stringify(issue);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function positiveIntegerOrNull(value: number | null | undefined) {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : null;
}

function nonnegativeIntegerOrNull(value: number | null | undefined) {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
}
