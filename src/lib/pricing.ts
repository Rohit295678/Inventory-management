// Pure pricing maths shared by the API (authoritative) and the form (preview).
// No framework imports so it runs in the browser, on the server, and in tests.

export const UNITS = ["kg", "packet", "bag", "box", "piece"] as const;
export type Unit = (typeof UNITS)[number];

export type LineInput = {
  quantity: number;
  unit: string;
  weightKg?: number | null;
  ratePerKg?: number | null;
  totalCost?: number | null;
};

export type PricedLine = {
  quantity: number;
  unit: string;
  weightKg: number;
  ratePerKg: number;
  totalCost: number;
};

export class PricingError extends Error {}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const isPositive = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 0;

/**
 * Fill in whichever price the user didn't type.
 *
 * - Items sold by "kg" weigh exactly their quantity, so weightKg = quantity.
 * - If totalCost is given it wins (it's the money that actually changed
 *   hands) and ratePerKg is derived; otherwise totalCost = ratePerKg × kg.
 */
export function priceLine(input: LineInput): PricedLine {
  const { quantity, unit } = input;
  if (!isPositive(quantity)) throw new PricingError("Quantity must be greater than 0");

  const weightKg = unit === "kg" ? quantity : input.weightKg;
  if (!isPositive(weightKg)) throw new PricingError("Total weight (kg) must be greater than 0");

  if (isPositive(input.totalCost)) {
    return {
      quantity,
      unit,
      weightKg,
      totalCost: round2(input.totalCost),
      ratePerKg: round2(input.totalCost / weightKg),
    };
  }
  if (isPositive(input.ratePerKg)) {
    return {
      quantity,
      unit,
      weightKg,
      ratePerKg: round2(input.ratePerKg),
      totalCost: round2(input.ratePerKg * weightKg),
    };
  }
  throw new PricingError("Enter either the price per kg or the total cost");
}

export function sumTotals(lines: ReadonlyArray<{ totalCost: number }>): number {
  return round2(lines.reduce((acc, l) => acc + l.totalCost, 0));
}
