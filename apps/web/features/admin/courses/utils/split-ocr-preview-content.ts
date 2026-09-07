const DEFAULT_TARGET_CHUNK_SIZE = 12_000;

export function splitOcrPreviewContent(
  content: string,
  targetChunkSize = DEFAULT_TARGET_CHUNK_SIZE,
): string[] {
  const paragraphs = content.split(/\n{2,}/u);
  const chunks: string[] = [];
  let currentParagraphs: string[] = [];
  let currentLength = 0;
  let environmentDepth = 0;
  let fencedCodeOpen = false;
  let displayMathOpen = false;

  for (const paragraph of paragraphs) {
    currentParagraphs.push(paragraph);
    currentLength += paragraph.length + 2;

    environmentDepth += countMatches(paragraph, /\\begin\{[^}]+\}/gu);
    environmentDepth -= countMatches(paragraph, /\\end\{[^}]+\}/gu);
    environmentDepth = Math.max(0, environmentDepth);

    if (countMatches(paragraph, /```/gu) % 2 === 1) {
      fencedCodeOpen = !fencedCodeOpen;
    }
    if (countMatches(paragraph, /\$\$/gu) % 2 === 1) {
      displayMathOpen = !displayMathOpen;
    }

    if (
      currentLength >= targetChunkSize &&
      environmentDepth === 0 &&
      !fencedCodeOpen &&
      !displayMathOpen
    ) {
      chunks.push(currentParagraphs.join("\n\n"));
      currentParagraphs = [];
      currentLength = 0;
    }
  }

  if (currentParagraphs.length > 0) {
    chunks.push(currentParagraphs.join("\n\n"));
  }

  return chunks.filter((chunk) => chunk.trim().length > 0);
}

function countMatches(value: string, pattern: RegExp) {
  return value.match(pattern)?.length ?? 0;
}
