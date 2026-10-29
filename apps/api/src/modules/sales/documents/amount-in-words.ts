import { Prisma } from "@texawave-erp/database";

/**
 * Indian-system amount in words for printed documents (lakh, crore):
 * 708 → "Rupees Seven Hundred Eight Only",
 * 1234567.5 → "Rupees Twelve Lakh Thirty Four Thousand Five Hundred Sixty
 * Seven and Fifty Paise Only". Pure.
 */
const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n] ?? "";
  const tens = TENS[Math.floor(n / 10)] ?? "";
  const ones = ONES[n % 10] ?? "";
  return ones ? `${tens} ${ones}` : tens;
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds] ?? ""} Hundred`);
  if (rest) parts.push(belowHundred(rest));
  return parts.join(" ");
}

/** Whole number in Indian words; "Zero" for 0. */
export function integerInWords(value: bigint): string {
  if (value === 0n) return "Zero";
  const parts: string[] = [];
  const crore = value / 10_000_000n;
  let rest = value % 10_000_000n;
  if (crore > 0n) parts.push(`${integerInWords(crore)} Crore`);
  const lakh = Number(rest / 100_000n);
  rest %= 100_000n;
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  const thousand = Number(rest / 1000n);
  rest %= 1000n;
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rest > 0n) parts.push(belowThousand(Number(rest)));
  return parts.join(" ");
}

export function amountInWords(amount: Prisma.Decimal.Value): string {
  const value = new Prisma.Decimal(amount)
    .abs()
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const rupees = BigInt(value.truncated().toFixed(0));
  const paise = value.minus(value.truncated()).times(100).toNumber();
  const words = `Rupees ${integerInWords(rupees)}`;
  return paise
    ? `${words} and ${belowHundred(paise)} Paise Only`
    : `${words} Only`;
}
