// Pure pricing maths shared by the API (authoritative) and the form (preview).
// No framework imports so it runs in the browser, on the server, and in tests.

export const UNITS = ["kg", "packet", "bag", "box", "piece"] as const;
export type Unit = (typeof UNITS)[number];

export type LineInput = {
  quantity: number;
  unit: string;
  weightPerUnitKg?: number | null; // e.g. 25 for a 25 kg packet; ignored for "kg"
  ratePerKg?: number | null;
};

export type PricedLine = {
  quantity: number;
  unit: string;
  weightPerUnitKg: number | null; // null for items counted in kg
  weightKg: number; // total weight = quantity x weightPerUnitKg
  ratePerKg: number;
  totalCost: number;
};

export class PricingError extends Error {}

function roundTo(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * factor) / factor;
}

// Money: 2 decimals (paise).
export const round2 = (n: number) => roundTo(n, 2);
// Weight: 3 decimals (grams), so 7 x 0.125 kg stays 0.875 kg.
export const round3 = (n: number) => roundTo(n, 3);

const isPositive = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;

/**
 * Work out total weight and total cost from the price per kg.
 *
 * - "kg" items weigh exactly their quantity.
 * - Other units (packet, bag, ...) need the weight of ONE unit:
 *     total weight = quantity x weightPerUnitKg
 * - totalCost = ratePerKg x weightPerUnitKg x quantity
 *
 * Money is rounded only at the end, from the unrounded weight.
 */
export function priceLine(input: LineInput): PricedLine {
  const { quantity, unit } = input;
  if (!isPositive(quantity)) throw new PricingError("Quantity must be greater than 0");

  const byKg = unit === "kg";
  const weightPerUnitKg = byKg ? null : input.weightPerUnitKg;
  if (!byKg && !isPositive(weightPerUnitKg)) {
    throw new PricingError(`Weight per ${unit} (kg) must be greater than 0`);
  }
  if (!isPositive(input.ratePerKg)) throw new PricingError("Price per kg must be greater than 0");

  const exactWeight = byKg ? quantity : quantity * weightPerUnitKg!;
  return {
    quantity,
    unit,
    weightPerUnitKg: weightPerUnitKg ?? null,
    weightKg: round3(exactWeight),
    ratePerKg: round2(input.ratePerKg),
    totalCost: round2(input.ratePerKg * exactWeight),
  };
}

// Weighted average price per kg: 100 kg @ 40 + 10 kg @ 60 is 41.82, not 50.
export function avgRatePerKg(totalCost: number, weightKg: number): number {
  return weightKg > 0 ? round2(totalCost / weightKg) : 0;
}

export function sumTotals(lines: ReadonlyArray<{ totalCost: number }>): number {
  return round2(lines.reduce((acc, l) => acc + l.totalCost, 0));
}
