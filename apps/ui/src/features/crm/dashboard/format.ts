/** Legacy `inr()`: Indian-grouped rupees, no decimals. */
export function inr(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0] as string;
  const last = parts[parts.length - 1] as string;
  return (
    parts.length === 1 ? first.slice(0, 2) : first.charAt(0) + last.charAt(0)
  ).toUpperCase();
}
