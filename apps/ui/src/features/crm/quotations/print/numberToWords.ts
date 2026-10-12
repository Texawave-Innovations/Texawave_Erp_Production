/**
 * Ported verbatim (logic unchanged) from legacy
 * `TexaWave_ERP/src/components/QuotationPrintTemplate.tsx`'s self-contained
 * `numberToWords` helper — an Indian-numbering (crore/lakh/thousand) word
 * converter, parameterised by currency/sub-unit name so it already works
 * for non-INR quotes. No external dependency.
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
];
const TEENS = [
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

function convertLessThanThousand(n: number): string {
  if (n === 0) return "";
  if (n < 10) return ONES[n]!;
  if (n < 20) return TEENS[n - 10]!;
  if (n < 100)
    return TENS[Math.floor(n / 10)]! + (n % 10 !== 0 ? " " + ONES[n % 10] : "");
  return (
    ONES[Math.floor(n / 100)]! +
    " Hundred" +
    (n % 100 !== 0 ? " " + convertLessThanThousand(n % 100) : "")
  );
}

function convertToWords(n: number): string {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const remainder = n % 1000;

  let result = "";
  if (crore > 0) result += convertLessThanThousand(crore) + " Crore ";
  if (lakh > 0) result += convertLessThanThousand(lakh) + " Lakh ";
  if (thousand > 0) result += convertLessThanThousand(thousand) + " Thousand ";
  if (remainder > 0) result += convertLessThanThousand(remainder);
  return result.trim();
}

export function numberToWords(
  num: number,
  currencyName = "Rupees",
  subunitName = "Paise",
): string {
  if (num === 0) return `${currencyName} Zero Only /-`;

  const whole = Math.floor(num);
  const fraction = Math.round((num - whole) * 100);

  let words = currencyName + " " + convertToWords(whole);
  if (fraction > 0)
    words += " and " + convertToWords(fraction) + " " + subunitName;
  return words + " Only /-";
}
