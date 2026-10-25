import { test } from "node:test";
import assert from "node:assert/strict";
import { priceLine, PricingError, round2, sumTotals } from "../src/lib/pricing.ts";

test("kg items: weight = quantity, total derived from rate", () => {
  assert.deepEqual(priceLine({ quantity: 50, unit: "kg", ratePerKg: 42.5 }), {
    quantity: 50,
    unit: "kg",
    weightPerUnitKg: null,
    weightKg: 50,
    ratePerKg: 42.5,
    totalCost: 2125,
  });
});

test("kg items ignore any weightPerUnitKg the client sends", () => {
  const line = priceLine({ quantity: 10, unit: "kg", weightPerUnitKg: 999, ratePerKg: 2 });
  assert.equal(line.weightKg, 10);
  assert.equal(line.weightPerUnitKg, null);
});

test("packets: total = price per kg x weight per packet x packets", () => {
  // 50 packets of 25 kg at Rs 50/kg = 50 x 25 x 50
  const line = priceLine({ quantity: 50, unit: "packet", weightPerUnitKg: 25, ratePerKg: 50 });
  assert.equal(line.weightKg, 1250);
  assert.equal(line.totalCost, 62500);
  assert.equal(line.weightPerUnitKg, 25);
});

test("packets: rate derived from total cost and per-packet weight", () => {
  const line = priceLine({ quantity: 50, unit: "packet", weightPerUnitKg: 25, totalCost: 62500 });
  assert.equal(line.ratePerKg, 50);
  assert.equal(line.totalCost, 62500);
});

test("small packets keep gram precision and money is exact", () => {
  // 7 packets of 125 g at Rs 80/kg = 0.875 kg = Rs 70
  const line = priceLine({ quantity: 7, unit: "packet", weightPerUnitKg: 0.125, ratePerKg: 80 });
  assert.equal(line.weightKg, 0.875);
  assert.equal(line.totalCost, 70);
});

test("totalCost wins when both prices are sent", () => {
  const line = priceLine({ quantity: 3, unit: "kg", ratePerKg: 100, totalCost: 1000 });
  assert.equal(line.totalCost, 1000);
  assert.equal(line.ratePerKg, 333.33);
});

test("rejects missing price, zero quantity, and missing per-unit weight", () => {
  assert.throws(() => priceLine({ quantity: 1, unit: "kg" }), PricingError);
  assert.throws(() => priceLine({ quantity: 0, unit: "kg", ratePerKg: 5 }), PricingError);
  assert.throws(() => priceLine({ quantity: 5, unit: "bag", ratePerKg: 5 }), /Weight per bag/);
  assert.throws(() => priceLine({ quantity: 5, unit: "bag", weightPerUnitKg: Number.NaN, ratePerKg: 5 }), PricingError);
});

test("money rounding behaves (no 0.1 + 0.2 nonsense)", () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(sumTotals([{ totalCost: 0.1 }, { totalCost: 0.2 }]), 0.3);
});
