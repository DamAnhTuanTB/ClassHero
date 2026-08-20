const SUBPART_MARKER_PATTERN =
  /(?:^|[^\S\r\n\u2028\u2029]+)(?:(?:[-+*]|\d+[.)])[^\S\r\n\u2028\u2029]+)?(?:\*{1,2}|_{1,2})?([a-h])\)(?:\*{1,2}|_{1,2})?(?=[^\S\r\n\u2028\u2029]+|[\p{L}\p{N}]|[-\\$([{+\uE000])/gimu;

const INLINE_SUBPART_SPACING_PATTERN =
  /[^\S\r\n\u2028\u2029]+((?:(?:[-+*]|\d+[.)])[^\S\r\n\u2028\u2029]+)?)(?=(?:\*{1,2}|_{1,2})?[a-h]\)(?:\*{1,2}|_{1,2})?(?=[^\S\r\n\u2028\u2029]+|[\p{L}\p{N}]|[-\\$([{+\uE000]))/giu;

const PROTECTED_MARKDOWN_OR_MATH_PATTERN =
  /```[\s\S]*?```|~~~[\s\S]*?~~~|```[\s\S]*$|~~~[\s\S]*$|``[^\r\n]*?``|`[^`\r\n]*`|`[^`\r\n]*$|\\begin\{([A-Za-z*]+)\}[\s\S]*?\\end\{\1\}|\\begin\{[A-Za-z*]+\}[\s\S]*$|(?<!\\)\$\$[\s\S]*?(?<!\\)\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|(?<!\\)\$(?:\\.|[^$\\\r\n])+(?<!\\)\$/gu;

export function normalizeInlineSubpartBreaks(value: string) {
  const maskedValue = maskProtectedMarkdownAndMath(value);
  const subpartMarkers = [...maskedValue.matchAll(SUBPART_MARKER_PATTERN)].map((match) =>
    match[1]!.toLocaleLowerCase("vi"),
  );

  if (!hasSequentialSubpartPair(subpartMarkers)) return value;

  const replacements = [...maskedValue.matchAll(INLINE_SUBPART_SPACING_PATTERN)].filter(
    (match) => !isLineLeadingIndentationOrListPrefix(maskedValue, match.index),
  );

  return replacements.reduceRight((result, match) => {
    const start = match.index;
    const listPrefix = match[1] ?? "";
    return `${result.slice(0, start)}\n${listPrefix}${result.slice(start + match[0].length)}`;
  }, value);
}

function maskProtectedMarkdownAndMath(value: string) {
  return value.replace(PROTECTED_MARKDOWN_OR_MATH_PATTERN, (segment) =>
    segment.replace(/[^\r\n]/g, "\uE000"),
  );
}

function hasSequentialSubpartPair(markers: string[]) {
  return markers.some(
    (marker, index) =>
      index > 0 && marker.charCodeAt(0) === markers[index - 1]!.charCodeAt(0) + 1,
  );
}

function isLineLeadingIndentationOrListPrefix(value: string, index: number) {
  const lineStart =
    Math.max(
      value.lastIndexOf("\n", index - 1),
      value.lastIndexOf("\r", index - 1),
      value.lastIndexOf("\u2028", index - 1),
      value.lastIndexOf("\u2029", index - 1),
      -1,
    ) + 1;
  const linePrefix = value.slice(lineStart, index);
  return /^[^\S\r\n\u2028\u2029]*(?:(?:[-+*]|\d+[.)])[^\S\r\n\u2028\u2029]*)?$/u.test(
    linePrefix,
  );
}
