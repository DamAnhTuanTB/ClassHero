import type { ProviderRouteCandidate } from "#api/modules/provider-operations/types/provider-operations.types";

export function supportsHighDetailPdfInput(candidate: ProviderRouteCandidate) {
  if (candidate.provider !== "OPENAI") return false;
  const capabilities = candidate.capabilitiesJson;
  if (!isRecord(capabilities) || capabilities.pdfInput !== true) return false;
  return (
    Array.isArray(capabilities.pdfDetailLevels) &&
    capabilities.pdfDetailLevels.includes("high")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
