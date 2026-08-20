export type TexRendererFailureCategory = "SOURCE" | "INFRASTRUCTURE";

export type TexRendererSuccess = {
  ok: true;
  svg: string;
  log: string;
  durationMs: number;
  rendererVersion: string;
};

export type TexRendererFailure = {
  ok: false;
  category: TexRendererFailureCategory;
  code: string;
  log: string;
  durationMs?: number;
  rendererVersion?: string;
  issues: Array<{
    code: string;
    severity: "ERROR" | "WARNING";
    message: string;
    file: string | null;
    line: number | null;
    column: number | null;
    element: string | null;
    path: string | null;
  }>;
  collectionComplete: boolean;
};

export type TexRendererResult = TexRendererSuccess | TexRendererFailure;

export type SvgValidationIssue = {
  code: string;
  message: string;
  repairableBySource: boolean;
};

export type SvgValidationResult =
  | {
      ok: true;
      sanitizedSvg: string;
      sha256: string;
      width: number | null;
      height: number | null;
      viewBox: [number, number, number, number];
      nodeCount: number;
      validatorVersion: string;
    }
  | {
      ok: false;
      issues: SvgValidationIssue[];
      validatorVersion: string;
    };
