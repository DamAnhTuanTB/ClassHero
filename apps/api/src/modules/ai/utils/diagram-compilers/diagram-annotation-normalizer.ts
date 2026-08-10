export function compactGeometryMeasureText(target: string, text: string) {
  const equalityIndex = text.indexOf("=");
  if (equalityIndex < 0) {
    const compact = text.trim();
    if (
      /^[-+]?\d+(?:[.,]\d+)?(?:\/\d+)?\s*(?:mm|cm|dm|m|km|°|%|rad)?$/iu.test(
        compact,
      )
    ) {
      return compact;
    }
    return !/\s/u.test(compact) && compact.length <= 4 ? compact : null;
  }

  const left = text.slice(0, equalityIndex).trim();
  const right = text.slice(equalityIndex + 1).trim();
  const normalizedTarget = normalizeGeometryName(target);
  const normalizedLeft = normalizeGeometryName(left);
  const isTargetAssignment =
    normalizedTarget.length > 0 && normalizedTarget === normalizedLeft;
  const hasNumericMeasure = /\d/u.test(right);

  // Relations such as AB = CD belong to EQUAL_LENGTH markers. Only a numeric
  // assignment such as AB = 3 cm becomes optional textbook text on segment AB.
  return isTargetAssignment && hasNumericMeasure ? right : null;
}

export function isIncompleteInequalityLabel(text: string) {
  return /^(?:≥|≤|>|<|>=|<=)/u.test(text.replaceAll(/\s/gu, ""));
}

function normalizeGeometryName(value: string) {
  return [...value.replaceAll(/[^\p{L}\p{N}′']/gu, "")].sort().join("");
}
