import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const passwordKeyLength = 64;
const scryptParams = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 64 * 1024 * 1024,
} as const;

export const passwordResetTtlMs = 15 * 60 * 1000;

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = await deriveScryptKey(password, salt, scryptParams);

  return [
    "scrypt",
    "v1",
    String(scryptParams.N),
    String(scryptParams.r),
    String(scryptParams.p),
    salt,
    derivedKey.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, storedHash: string) {
  const parts = storedHash.split("$");

  if (parts[0] !== "scrypt") {
    return false;
  }

  if (parts.length === 3) {
    const salt = parts[1];
    const expectedHash = parts[2];

    if (!salt || !expectedHash) {
      return false;
    }

    const actualHash = await deriveScryptKey(password, salt);
    return safeCompareHex(actualHash, expectedHash);
  }

  if (parts.length === 7 && parts[1] === "v1") {
    const nValue = parts[2];
    const rValue = parts[3];
    const pValue = parts[4];
    const salt = parts[5];
    const expectedHash = parts[6];

    if (!nValue || !rValue || !pValue || !salt || !expectedHash) {
      return false;
    }

    const actualHash = await deriveScryptKey(password, salt, {
      N: Number(nValue),
      r: Number(rValue),
      p: Number(pValue),
      maxmem: 64 * 1024 * 1024,
    });

    return safeCompareBase64Url(actualHash, expectedHash);
  }

  return false;
}

function deriveScryptKey(
  password: string,
  salt: string,
  options?: Parameters<typeof scrypt>[3],
) {
  return new Promise<Buffer>((resolve, reject) => {
    const callback = (error: Error | null, derivedKey: Buffer) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    };

    if (options) {
      scrypt(password, salt, passwordKeyLength, options, callback);
      return;
    }

    scrypt(password, salt, passwordKeyLength, callback);
  });
}

function safeCompareHex(actual: Buffer, expectedHex: string) {
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function safeCompareBase64Url(actual: Buffer, expectedBase64Url: string) {
  const expected = Buffer.from(expectedBase64Url, "base64url");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function hashRefreshToken(token: string) {
  return hashOpaqueToken(token);
}

export function hashPasswordResetToken(token: string) {
  return hashOpaqueToken(token);
}

function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function parseDurationMs(value: string) {
  const normalizedValue = value.trim().toLowerCase();
  const match = /^(\d+)(ms|s|m|h|d)?$/.exec(normalizedValue);

  if (!match) {
    throw new Error(`Invalid duration value: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2] ?? "s";
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  } as const;

  return amount * multipliers[unit as keyof typeof multipliers];
}
