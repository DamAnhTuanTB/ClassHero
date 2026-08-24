export const CANONICAL_NUMERIC_ANSWER_PATTERN =
  /^[-+]?(?:\d+(?:[.,]\d+)?(?:[eE][-+]?\d+)?|\d+\s*\/\s*[1-9]\d*)$/u;

type RationalNumber = {
  numerator: bigint;
  denominator: bigint;
};

const MAX_NUMERIC_ANSWER_LENGTH = 500;
const MAX_DECIMAL_EXPONENT = 1_000;

export function areEquivalentNumericAnswers(left: string, right: string) {
  const leftValue = parseNumericAnswer(left);
  const rightValue = parseNumericAnswer(right);
  if (!leftValue || !rightValue) return false;

  return (
    leftValue.numerator * rightValue.denominator ===
    rightValue.numerator * leftValue.denominator
  );
}

export function isSupportedNumericAnswer(value: string) {
  return parseNumericAnswer(value) !== null;
}

export function areEquivalentTextInputAnswers(left: string, right: string) {
  if (areEquivalentNumericAnswers(left, right)) {
    return true;
  }

  return normalizeTextInputAnswer(left) === normalizeTextInputAnswer(right);
}

function parseNumericAnswer(value: string): RationalNumber | null {
  const normalized = unwrapMathDelimiters(value)
    .replaceAll("−", "-")
    .replaceAll("{,}", ",")
    .replace(/\s+/gu, "");
  if (!normalized || normalized.length > MAX_NUMERIC_ANSWER_LENGTH) return null;

  const latexFraction = normalized.match(
    /^\\(?:dfrac|tfrac|frac)\{([+-]?\d+)\}\{([+-]?\d+)\}$/u,
  );
  if (latexFraction) {
    return createFraction(latexFraction[1], latexFraction[2]);
  }

  const plainFraction = normalized.match(/^([+-]?\d+)\/([+-]?\d+)$/u);
  if (plainFraction) {
    return createFraction(plainFraction[1], plainFraction[2]);
  }

  const decimal = normalized.match(/^([+-]?)(\d+)(?:[.,](\d+))?(?:[eE]([+-]?\d+))?$/u);
  if (!decimal) return null;

  const sign = decimal[1] === "-" ? -1n : 1n;
  const integerDigits = decimal[2] ?? "";
  const fractionDigits = decimal[3] ?? "";
  const exponent = Number(decimal[4] ?? "0") - fractionDigits.length;
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > MAX_DECIMAL_EXPONENT) {
    return null;
  }

  const digits = BigInt(`${integerDigits}${fractionDigits}`);
  if (exponent >= 0) {
    return {
      numerator: sign * digits * 10n ** BigInt(exponent),
      denominator: 1n,
    };
  }
  return {
    numerator: sign * digits,
    denominator: 10n ** BigInt(-exponent),
  };
}

function createFraction(
  numeratorText: string | undefined,
  denominatorText: string | undefined,
): RationalNumber | null {
  if (!numeratorText || !denominatorText) return null;
  const denominator = BigInt(denominatorText);
  if (denominator === 0n) return null;
  return {
    numerator: BigInt(numeratorText),
    denominator,
  };
}

function unwrapMathDelimiters(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("$") && trimmed.endsWith("$") && trimmed.length >= 2) {
    return trimmed.slice(1, -1).trim();
  }
  if (trimmed.startsWith("\\(") && trimmed.endsWith("\\)") && trimmed.length >= 4) {
    return trimmed.slice(2, -2).trim();
  }
  return trimmed;
}

function normalizeTextInputAnswer(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("vi");
}
