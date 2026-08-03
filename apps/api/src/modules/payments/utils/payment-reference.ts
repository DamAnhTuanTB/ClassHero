import { randomInt } from "node:crypto";
/** Creates a readable payment reference from the selected course domain. */
export function createPaymentReference(domainName: string, grade: number | null) {
  const randomSuffix = randomInt(10_000_000, 100_000_000);
  const prefix = domainName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 12) || "KhoaHoc";
  return `${prefix}${grade ?? "NL"}MS${randomSuffix}`;
}
