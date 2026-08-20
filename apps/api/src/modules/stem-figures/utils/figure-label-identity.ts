export function extractFigureIdentity(value: string) {
  return extractFigureIdentities(value)[0] ?? null;
}

export function extractFigureIdentities(value: string) {
  const normalized = normalizeFigureLabelText(value);
  const identities = new Set<string>();
  const pattern =
    /\b(?:hinh|figure|fig)\s*[:.#-]?\s*([0-9]+(?:\s*[.-]\s*[0-9]+)*(?:\s*[a-z])?)/gu;
  for (const match of normalized.matchAll(pattern)) {
    const identity = match[1]?.replace(/\s+/gu, "").replace(/-/gu, ".");
    if (identity) identities.add(identity);
  }
  return [...identities];
}

export function normalizeFigureLabelText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/đ/gu, "d")
    .toLowerCase();
}
