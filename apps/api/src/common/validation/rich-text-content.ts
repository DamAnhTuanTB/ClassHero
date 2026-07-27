export function getTiptapText(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(getTiptapText).join(" ");
  }

  if (typeof value !== "object" || value === null) {
    return "";
  }

  const node = value as Record<string, unknown>;
  const attrs =
    typeof node.attrs === "object" && node.attrs !== null && !Array.isArray(node.attrs)
      ? (node.attrs as Record<string, unknown>)
      : undefined;
  const structuralText =
    node.type === "inlineMath" || node.type === "blockMath"
      ? typeof attrs?.latex === "string"
        ? attrs.latex
        : ""
      : node.type === "image"
        ? typeof attrs?.alt === "string" && attrs.alt.trim()
          ? attrs.alt
          : typeof attrs?.src === "string" && attrs.src.trim()
            ? "[Hình ảnh]"
            : ""
        : node.type === "table"
          ? "[Bảng]"
          : "";

  return [
    typeof node.text === "string" ? node.text : "",
    structuralText,
    getTiptapText(node.content),
  ]
    .filter(Boolean)
    .join(" ");
}

export function hasTiptapContent(value: unknown) {
  return getTiptapText(value).trim().length > 0;
}
