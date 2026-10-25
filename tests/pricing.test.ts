import { test } from "node:test";
import assert from "node:assert/strict";
import { avgRatePerKg, priceLine, PricingError, round2, sumTotals } from "../src/lib/pricing.ts";

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

test("price per kg is required (no total-cost shortcut)", () => {
  assert.throws(() => priceLine({ quantity: 3, unit: "kg" }), /Price per kg/);
  assert.throws(() => priceLine({ quantity: 3, unit: "kg", ratePerKg: 0 }), /Price per kg/);
});

test("average price per kg is weighted by kg, not a plain average", () => {
  // 100 kg @ 40 + 10 kg @ 60 = 4600 / 110 kg
  assert.equal(avgRatePerKg(4600, 110), 41.82);
  assert.equal(avgRatePerKg(0, 0), 0); // nothing bought yet
});

test("small packets keep gram precision and money is exact", () => {
  // 7 packets of 125 g at Rs 80/kg = 0.875 kg = Rs 70
  const line = priceLine({ quantity: 7, unit: "packet", weightPerUnitKg: 0.125, ratePerKg: 80 });
  assert.equal(line.weightKg, 0.875);
  assert.equal(line.totalCost, 70);
});

test("rejects zero quantity and missing per-unit weight", () => {
  assert.throws(() => priceLine({ quantity: 0, unit: "kg", ratePerKg: 5 }), PricingError);
  assert.throws(() => priceLine({ quantity: 5, unit: "bag", ratePerKg: 5 }), /Weight per bag/);
  assert.throws(() => priceLine({ quantity: 5, unit: "bag", weightPerUnitKg: Number.NaN, ratePerKg: 5 }), PricingError);
});

test("money rounding behaves (no 0.1 + 0.2 nonsense)", () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(sumTotals([{ totalCost: 0.1 }, { totalCost: 0.2 }]), 0.3);
});
