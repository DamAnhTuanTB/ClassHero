const DEFAULT_USER_ERROR_MESSAGE =
  "Không thể hoàn tất thao tác. Vui lòng thử lại sau ít phút.";

const VIETNAMESE_CHARACTER_PATTERN =
  /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu;

const TECHNICAL_WORD_PATTERN =
  /\b(?:must|should|expected|received|required|invalid|unknown|cannot|failed|failure|point labels?|uppercase|lowercase|optional|primes?|numeric|subscripts?|string|number|boolean|object|array|undefined|null|schema|stack|trace)\b/iu;
const TECHNICAL_SIGNATURE_PATTERN =
  /(?:\b(?:TypeError|ReferenceError|SyntaxError|ZodError|PrismaClient\w*Error|AbortError)\b|\b(?:ECONN\w*|ENOTFOUND|ETIMEDOUT)\b|\b[A-Z][A-Z0-9_]{3,}\b|(?:^|\s)(?:at\s+\S+\s*\(|[\w./-]+\.(?:ts|tsx|js|jsx):\d+))/u;
const UNSAFE_ASCII_SENTENCE_PATTERN = /[A-Za-z]{3,}\s+[A-Za-z]{3,}/u;

export function getUserFacingErrorMessage(
  error: unknown,
  fallback = DEFAULT_USER_ERROR_MESSAGE,
  codeMessages: Readonly<Record<string, string>> = {},
) {
  const safeFallback = sanitizeFallback(fallback);
  const code = readErrorCode(error);
  if (code && codeMessages[code]) {
    return sanitizeUserFacingMessage(codeMessages[code], safeFallback);
  }
  return sanitizeUserFacingMessage(readErrorMessage(error), safeFallback);
}

export function sanitizeUserFacingMessage(
  message: unknown,
  fallback = DEFAULT_USER_ERROR_MESSAGE,
) {
  const safeFallback = sanitizeFallback(fallback);
  if (typeof message !== "string") return safeFallback;
  const normalized = message.replace(/\s+/gu, " ").trim();
  if (!normalized) return safeFallback;
  if (!containsTechnicalError(normalized)) return normalized;

  const vietnamesePrefix = normalized
    .split(/:\s*/u)
    .find(
      (part) =>
        part.length >= 12 &&
        VIETNAMESE_CHARACTER_PATTERN.test(part) &&
        !containsTechnicalError(part),
    );
  if (!vietnamesePrefix) return safeFallback;
  return /[.!?]$/u.test(vietnamesePrefix) ? vietnamesePrefix : `${vietnamesePrefix}.`;
}

function sanitizeFallback(fallback: string) {
  const normalized = fallback.replace(/\s+/gu, " ").trim();
  if (!normalized || containsTechnicalError(normalized)) {
    return DEFAULT_USER_ERROR_MESSAGE;
  }
  return normalized;
}

function containsTechnicalError(value: string) {
  return (
    TECHNICAL_WORD_PATTERN.test(value) ||
    TECHNICAL_SIGNATURE_PATTERN.test(value) ||
    (!VIETNAMESE_CHARACTER_PATTERN.test(value) &&
      UNSAFE_ASCII_SENTENCE_PATTERN.test(value))
  );
}

function readErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

function readErrorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (!error || typeof error !== "object" || !("message" in error)) return null;
  return typeof error.message === "string" ? error.message : null;
}
