import { test } from "node:test";
import assert from "node:assert/strict";
import { priceLine, PricingError, round2, sumTotals } from "../src/lib/pricing.ts";

test("kg items: weight = quantity, total derived from rate", () => {
  assert.deepEqual(priceLine({ quantity: 50, unit: "kg", ratePerKg: 42.5 }), {
    quantity: 50,
    unit: "kg",
    weightKg: 50,
    ratePerKg: 42.5,
    totalCost: 2125,
  });
});

test("kg items ignore any weightKg the client sends", () => {
  assert.equal(priceLine({ quantity: 10, unit: "kg", weightKg: 999, ratePerKg: 2 }).weightKg, 10);
});

test("packet items use weightKg; rate derived from total", () => {
  // 50 packets of rice, 25 kg each = 1250 kg, paid 62,500 total
  const line = priceLine({ quantity: 50, unit: "packet", weightKg: 1250, totalCost: 62500 });
  assert.equal(line.ratePerKg, 50);
  assert.equal(line.totalCost, 62500);
});

test("totalCost wins when both prices are sent", () => {
  const line = priceLine({ quantity: 3, unit: "kg", ratePerKg: 100, totalCost: 1000 });
  assert.equal(line.totalCost, 1000);
  assert.equal(line.ratePerKg, 333.33);
});

test("rejects missing price, zero quantity, and missing weight for packets", () => {
  assert.throws(() => priceLine({ quantity: 1, unit: "kg" }), PricingError);
  assert.throws(() => priceLine({ quantity: 0, unit: "kg", ratePerKg: 5 }), PricingError);
  assert.throws(() => priceLine({ quantity: 5, unit: "bag", ratePerKg: 5 }), PricingError);
  assert.throws(() => priceLine({ quantity: 5, unit: "bag", weightKg: Number.NaN, ratePerKg: 5 }), PricingError);
});

test("money rounding behaves (no 0.1 + 0.2 nonsense)", () => {
  assert.equal(round2(1.005), 1.01);
  assert.equal(sumTotals([{ totalCost: 0.1 }, { totalCost: 0.2 }]), 0.3);
});
