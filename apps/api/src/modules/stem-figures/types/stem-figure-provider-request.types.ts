import type { StemFigureDiagnosticBatch } from "@learning-path/shared";

import type { ResolvedAiStructuredRequestTrace } from "#api/modules/ai/services/ai-provider-call.service";
import type { StemFigureGenerationBrief } from "#api/modules/stem-figures/types/stem-figure-generation.types";

export type StemFigureProviderRequestSnapshot = {
  version: 1;
  idempotencyKey: string;
  callKind: "CREATE_NEW" | "COMPILER_REPAIR" | "VALIDATOR_REPAIR";
  repairKind: "AUTO_COMPILER" | "MANUAL_COMPILER" | "MANUAL_VALIDATOR" | null;
  callSequence: number;
  createdAt: string;
  request: ResolvedAiStructuredRequestTrace;
  generationBrief: StemFigureGenerationBrief | null;
  referenceImages: Array<{
    order: number;
    objectKey: string;
    mimeType: string;
    label: string;
    packetPageNumber: number | null;
    source: "OCR_CROP" | "PDF_PAGE" | "CURRENT_FIGURE";
    sourceTarget?: StemFigureGenerationBrief["referenceAssets"][number]["sourceTarget"];
    detail: "low" | "high" | "auto" | "original";
    byteLength: number | null;
    sha256: string;
  }>;
  latexSource: string | null;
  diagnosticBatch: StemFigureDiagnosticBatch | null;
};

export type StemFigureProviderRequestSnapshotCollection = {
  version: 1;
  calls: StemFigureProviderRequestSnapshot[];
};
