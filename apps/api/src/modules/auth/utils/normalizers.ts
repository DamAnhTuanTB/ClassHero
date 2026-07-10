export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string) {
  return phone.trim();
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function normalizeNameForIdentityMatch(name: string) {
  return normalizeName(name).normalize("NFC").toLocaleLowerCase("vi-VN");
}

export function normalizeNullableText(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized : null;
}

export function normalizeIdentifier(identifier: string) {
  return identifier.trim();
}

export function parseBirthYear(value: number) {
  return new Date(`${value}-01-01T00:00:00.000Z`);
}

export function normalizeOptionalSecret(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  const unsafeValues = new Set(["change-me", "changeme"]);

  return normalized && !unsafeValues.has(normalized.toLowerCase())
    ? normalized
    : undefined;
}
