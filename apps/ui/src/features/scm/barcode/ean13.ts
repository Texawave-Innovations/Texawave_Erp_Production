// EAN-13 helpers + encoder (dependency-free). Used for the derived barcode of
// a SKU that has no real merchandise barcode assigned.

const L = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
];
const R = L.map((p) => [...p].map((c) => (c === "0" ? "1" : "0")).join(""));
const G = R.map((p) => [...p].reverse().join(""));
const PARITY = [
  "LLLLLL",
  "LLGLGG",
  "LLGGLG",
  "LLGGGL",
  "LGLLGG",
  "LGGLLG",
  "LGGGLL",
  "LGLGLG",
  "LGLGGL",
  "LGGLGL",
];

/** Simple, stable string hash (djb2) — a deterministic numeric seed only. */
function hashString(value: string): number {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash + value.charCodeAt(i)) >>> 0;
  }
  return hash >>> 0;
}

/** Standard EAN-13 check digit for a 12-digit payload. */
export function computeEan13CheckDigit(digits12: string): string {
  const digits = digits12.padStart(12, "0").slice(-12).split("").map(Number);
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  return String((10 - (sum % 10)) % 10);
}

/** A stable 13-digit EAN-13 from any product code, prefixed "20" (a GS1
 * in-store range) so it is visibly not a real assigned GTIN. */
export function deriveEan13FromCode(productCode: string): string {
  const seed = hashString(productCode.toUpperCase())
    .toString()
    .padStart(10, "0")
    .slice(0, 10);
  const digits12 = `20${seed}`.slice(0, 12);
  return digits12 + computeEan13CheckDigit(digits12);
}

/** Renders `value` as EAN-13: a 12/13-digit numeric value as-is (check digit
 * recomputed), anything else via the derived pseudo-GTIN. */
export function toEan13(value: string): string {
  const digitsOnly = value.replace(/\D/g, "");
  if (digitsOnly.length >= 12) {
    return (
      digitsOnly.slice(0, 12) + computeEan13CheckDigit(digitsOnly.slice(0, 12))
    );
  }
  return deriveEan13FromCode(value);
}

/** The 95 modules of an EAN-13 symbol ("1" = bar). */
export function ean13Modules(value13: string): string {
  const digits = value13.split("").map(Number);
  const parity = PARITY[digits[0]!]!;
  let out = "101";
  for (let i = 0; i < 6; i++) {
    const d = digits[1 + i]!;
    out += parity[i] === "L" ? L[d]! : G[d]!;
  }
  out += "01010";
  for (let i = 0; i < 6; i++) out += R[digits[7 + i]!]!;
  return out + "101";
}
