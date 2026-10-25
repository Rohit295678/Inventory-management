// Display formatting. Indian grouping (1,23,456.50) because that's who's
// using this. One place to change if that ever stops being true.

const number = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatNumber(n: number): string {
  return number.format(n);
}

// `symbol` is overridable because PDF core fonts have no ₹ glyph.
export function formatMoney(n: number, symbol = "\u20b9"): string {
  return `${symbol}${money.format(n)}`;
}

export function formatKg(n: number): string {
  return `${number.format(n)} kg`;
}

// "1 bill", "3 bills", "2.5 packets".
export function plural(n: number, word: string): string {
  return `${number.format(n)} ${word}${n === 1 ? "" : "s"}`;
}

export function formatQty(quantity: number, unit: string): string {
  return unit === "kg" ? formatKg(quantity) : plural(quantity, unit);
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateRange(from?: string, to?: string): string {
  if (from && to) return from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;
  if (from) return `From ${formatDate(from)}`;
  if (to) return `Up to ${formatDate(to)}`;
  return "All dates";
}
