import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLots, labelLots, LotError, pickLot, stockRows, type PurchaseRow, type SaleRow } from "../src/lib/lots.ts";
import type { ItemDTO } from "../src/lib/types.ts";

// The shop's example: miniket bought twice from the same supplier.
const buy = (ratePerKg: number, packets: number, firstDate: string, partyId = "ramesh", time = "10:00"): PurchaseRow => ({
  partyId,
  partyName: partyId.toUpperCase(),
  ratePerKg,
  quantity: packets,
  weightKg: packets * 26,
  totalCost: packets * 26 * ratePerKg,
  firstDate,
  firstCreatedAt: `${firstDate}T${time}:00.000Z`,
});
const sell = (lotRatePerKg: number | null, packets: number): SaleRow => ({ lotRatePerKg, quantity: packets, weightKg: packets * 26 });
const miniket = (purchases: PurchaseRow[], sales: SaleRow[] = []) => labelLots("miniket", buildLots(purchases, sales));
const summary = (lots: ReturnType<typeof miniket>) => lots.map((l) => [l.label, l.stock.quantity, l.stock.weightKg]);

const twoPrices = [buy(45, 30, "2026-10-05"), buy(40, 20, "2026-10-01")];

test("two prices in stock -> two named lots, oldest first, each with its own stock", () => {
  assert.deepEqual(summary(miniket(twoPrices)), [
    ["miniket-40rs/kg", 20, 520],
    ["miniket-45rs/kg", 30, 780],
  ]);
});

test("selling from a lot only reduces that lot", () => {
  assert.deepEqual(summary(miniket(twoPrices, [sell(40, 10)])), [
    ["miniket-40rs/kg", 10, 260],
    ["miniket-45rs/kg", 30, 780],
  ]);
});

test("once a lot is sold out, the one left is plain 'miniket'", () => {
  assert.deepEqual(summary(miniket(twoPrices, [sell(40, 20)])), [["miniket", 30, 780]]);
});

test("buying again at the same price adds to that lot", () => {
  const lots = miniket([buy(40, 20, "2026-10-01"), buy(40, 5, "2026-10-09", "suresh")]);
  assert.deepEqual(summary(lots), [["miniket", 25, 650]]);
  assert.equal(lots[0].suppliers.length, 2);
  assert.equal(lots[0].firstBoughtOn, "2026-10-01");
});

test("old sales without a lot come off the oldest stock first", () => {
  assert.deepEqual(summary(miniket(twoPrices, [sell(null, 25)])), [["miniket", 25, 650]]); // 20 from 40, 5 from 45
});

test("same day: the lot entered first counts as older (not the cheaper one)", () => {
  const lots = miniket([buy(40, 5, "2026-10-05", "b", "11:00"), buy(45, 5, "2026-10-05", "a", "09:00")]);
  assert.deepEqual(lots.map((l) => l.ratePerKg), [45, 40]);
});

test("stockRows: a row per lot only when 2+ lots are in stock", () => {
  const item = (lots: ReturnType<typeof miniket>) =>
    ({ id: "m", name: "miniket", stock: { quantity: 50, weightKg: 1300 }, bought: lots[0]?.bought, suppliers: [], lots }) as unknown as ItemDTO;
  assert.deepEqual(stockRows(item(miniket(twoPrices))).map((r) => [r.key, r.label, r.stock.quantity]), [
    ["m@40", "miniket-40rs/kg", 20],
    ["m@45", "miniket-45rs/kg", 30],
  ]);
  // One lot -> the item itself as one row (its whole history, plain name)
  assert.deepEqual(stockRows(item(miniket([buy(40, 20, "2026-10-01")]))).map((r) => [r.key, r.label, r.stock.quantity]), [["m", "miniket", 50]]);
});

test("pickLot: auto with one lot, must choose with several, clear errors", () => {
  const two = miniket(twoPrices);
  assert.equal(pickLot("miniket", two, 45).ratePerKg, 45);
  assert.throws(() => pickLot("miniket", two, null), new LotError("Pick which miniket: miniket-40rs/kg or miniket-45rs/kg"));
  assert.throws(() => pickLot("miniket", two, 50), new LotError("miniket-50rs/kg is not in stock"));
  assert.equal(pickLot("miniket", miniket([buy(40, 20, "2026-10-01")]), undefined).ratePerKg, 40);
  assert.throws(() => pickLot("miniket", [], null), new LotError("miniket is out of stock"));
});
