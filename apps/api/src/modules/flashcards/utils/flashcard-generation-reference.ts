export function readFlashcardGenerationReference(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const aiGenerationId = (value as Record<string, unknown>).aiGenerationId;
  return typeof aiGenerationId === "string" && aiGenerationId.length > 0
    ? aiGenerationId
    : null;
}
