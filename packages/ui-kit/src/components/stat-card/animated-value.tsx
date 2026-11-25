"use client";

import { AnimatedNumber } from "./animated-number";

export interface AnimatedValueProps {
  /** A number, or formatted text such as "42h 48m", "₹3.2L" or "1,200". */
  value: string | number;
  duration?: number | undefined;
}

// Indian/Western grouped ("1,20,000" / "1,200") or plain numbers, optional decimals.
const NUMBER_TOKEN = /\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

/** Formats a scaled integer back into the token's original shape. */
function tokenFormatter(token: string): {
  target: number;
  format: (v: number) => string;
} {
  const decimals = token.split(".")[1]?.length ?? 0;
  const grouped = token.includes(",");
  const scale = 10 ** decimals;
  const padTo =
    !grouped && decimals === 0 && token.startsWith("0") ? token.length : 0;
  return {
    target: Math.round(Number(token.replace(/,/g, "")) * scale),
    format: (v) => {
      const n = v / scale;
      const text = grouped
        ? n.toLocaleString("en-IN", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        : n.toFixed(decimals);
      return padTo ? text.padStart(padTo, "0") : text;
    },
  };
}

/**
 * Count-up for any metric value: every number inside the text runs through
 * `AnimatedNumber` (so "42h 48m" animates both 42 and 48), while units,
 * currency symbols and separators stay put. Keeps decimals, comma grouping and
 * leading zeros. Like `AnimatedNumber`, it renders a single copy in place, so
 * the settled text is exactly the value (no duplicate for copy/paste, page
 * search or tests); reduced motion is honoured by `AnimatedNumber`.
 */
export function AnimatedValue({ value, duration = 900 }: AnimatedValueProps) {
  const text =
    typeof value === "number"
      ? value.toLocaleString("en-IN", { maximumFractionDigits: 2 })
      : value;
  const parts: { token: string; numeric: boolean }[] = [];
  let last = 0;
  for (const match of text.matchAll(NUMBER_TOKEN)) {
    const at = match.index ?? 0;
    if (at > last) parts.push({ token: text.slice(last, at), numeric: false });
    parts.push({ token: match[0], numeric: true });
    last = at + match[0].length;
  }
  if (last < text.length)
    parts.push({ token: text.slice(last), numeric: false });

  return (
    <>
      {parts.map((p, i) => {
        if (!p.numeric) return <span key={i}>{p.token}</span>;
        const { target, format } = tokenFormatter(p.token);
        return (
          <AnimatedNumber
            key={i}
            value={target}
            duration={duration}
            formatter={format}
          />
        );
      })}
    </>
  );
}
