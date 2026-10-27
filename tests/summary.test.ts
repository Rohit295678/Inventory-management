import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize } from "../src/lib/summary.ts";
import type { TransactionDTO } from "../src/lib/types.ts";

const line = (itemId: string, itemName: string, unit: string, quantity: number, weightKg: number, totalCost: number) => ({
  id: `${itemId}-${quantity}`,
  itemId,
  itemName,
  unit,
  quantity,
  weightPerUnitKg: unit === "kg" ? null : weightKg / quantity,
  weightKg,
  totalCost,
  ratePerKg: totalCost / weightKg,
});

const tx = (id: string, partyId: string, lines: TransactionDTO["lines"], paid = 0): TransactionDTO => {
  const totalAmount = lines.reduce((s, l) => s + l.totalCost, 0);
  return {
    id,
    type: "PURCHASE",
    date: "2026-10-25",
    note: null,
    party: { id: partyId, name: partyId.toUpperCase() },
    lines,
    totalAmount,
    paid,
    due: totalAmount - paid,
    settledAt: null,
  };
};

test("rolls up bills by item and by person", () => {
  const s = summarize([
    tx("t1", "ramesh", [line("rice", "Rice", "packet", 50, 1250, 62500), line("dal", "Dal", "packet", 20, 600, 54000)]),
    tx("t2", "suresh", [line("rice", "Rice", "packet", 10, 250, 13000)]),
  ]);

  assert.equal(s.bills, 2);
  assert.equal(s.totalAmount, 129500);
  assert.equal(s.totalWeightKg, 2100);

  const rice = s.byItem.find((i) => i.itemId === "rice")!;
  assert.equal(rice.quantity, 60);
  assert.equal(rice.weightKg, 1500);
  assert.equal(rice.totalCost, 75500);
  assert.equal(rice.avgRatePerKg, 50.33); // weighted, not a naive mean of rates

  assert.deepEqual(
    s.byParty.map((p) => [p.partyId, p.bills, p.totalAmount]),
    [
      ["ramesh", 1, 116500],
      ["suresh", 1, 13000],
    ]
  );
});

test("same item in different units is not summed together", () => {
  const s = summarize([tx("t1", "a", [line("rice", "Rice", "bag", 2, 50, 2500), line("rice", "Rice", "kg", 5, 5, 300)])]);
  assert.equal(s.byItem.length, 2);
});

test("paid and due add up across bills", () => {
  const s = summarize([
    tx("t1", "a", [line("rice", "Rice", "kg", 100, 100, 15000)], 3000), // part paid
    tx("t2", "a", [line("dal", "Dal", "kg", 10, 10, 900)], 900), // fully paid
  ]);
  assert.equal(s.totalPaid, 3900);
  assert.equal(s.totalDue, 12000);
});

test("empty input gives zeros", () => {
  assert.deepEqual(summarize([]), { bills: 0, totalAmount: 0, totalPaid: 0, totalDue: 0, totalWeightKg: 0, byItem: [], byParty: [] });
});
