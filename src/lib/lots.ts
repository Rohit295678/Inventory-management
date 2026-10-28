import { avgRatePerKg, round2, round3 } from "./pricing.ts";
import type { Bought, ItemDTO, LotDTO, SupplierBought } from "./types.ts";

// A "lot" = one item bought at one price per kg. Buying miniket at 40 and
// later at 45 gives two lots; buying at 40 again adds to the 40 lot. Sales
// say which lot they came from, so each lot has its own stock.
// Pure functions: the DB queries live in item-stats.ts.

export type PurchaseRow = {
  partyId: string;
  partyName: string;
  ratePerKg: number; // already rounded to 2 decimals
  quantity: number;
  weightKg: number;
  totalCost: number;
  firstDate: string; // YYYY-MM-DD of the first purchase in this row
  firstCreatedAt: string; // ISO time it was entered: orders same-day lots
};

export type SaleRow = { lotRatePerKg: number | null; quantity: number; weightKg: number };

type Lot = Omit<LotDTO, "label">;

const EPSILON = 0.0005; // below this a lot counts as sold out (float dust)

export const sameRate = (a: number, b: number) => round2(a) === round2(b);

export const toBought = (quantity: number, weightKg: number, totalCost: number): Bought => ({
  quantity: round2(quantity),
  weightKg: round3(weightKg),
  totalCost: round2(totalCost),
  avgRatePerKg: avgRatePerKg(totalCost, weightKg),
});

// In-stock lots of ONE item, oldest first. Sales saved before lots existed
// (lotRatePerKg = null), or naming a lot that isn't there, come off the
// oldest stock first.
export function buildLots(purchases: ReadonlyArray<PurchaseRow>, sales: ReadonlyArray<SaleRow>): Lot[] {
  const byRate = new Map<number, PurchaseRow[]>();
  for (const p of purchases) byRate.set(round2(p.ratePerKg), [...(byRate.get(round2(p.ratePerKg)) ?? []), p]);

  const lots = [...byRate.entries()]
    .map(([ratePerKg, rows]) => {
      const sum = (key: "quantity" | "weightKg" | "totalCost") => rows.reduce((acc, r) => acc + r[key], 0);
      const suppliers: SupplierBought[] = rows
        .map((r) => ({
          partyId: r.partyId,
          partyName: r.partyName,
          ...toBought(r.quantity, r.weightKg, r.totalCost),
          minRatePerKg: ratePerKg,
          maxRatePerKg: ratePerKg,
        }))
        .sort((a, b) => b.totalCost - a.totalCost);
      const first = (key: "firstDate" | "firstCreatedAt") => rows.map((r) => r[key]).sort()[0];
      return {
        ratePerKg,
        firstBoughtOn: first("firstDate"),
        enteredAt: first("firstCreatedAt"),
        bought: toBought(sum("quantity"), sum("weightKg"), sum("totalCost")),
        suppliers,
        left: { quantity: sum("quantity"), weightKg: sum("weightKg") },
      };
    })
    // Bought earlier = older; same day -> whichever was entered first.
    .sort((a, b) => a.firstBoughtOn.localeCompare(b.firstBoughtOn) || a.enteredAt.localeCompare(b.enteredAt));

  let unassigned = 0; // quantity sold without a (known) lot
  for (const sale of sales) {
    const lot = sale.lotRatePerKg === null ? undefined : lots.find((l) => sameRate(l.ratePerKg, sale.lotRatePerKg!));
    if (lot) {
      lot.left.quantity -= sale.quantity;
      lot.left.weightKg -= sale.weightKg;
    } else {
      unassigned += sale.quantity;
    }
  }

  for (const lot of lots) {
    if (unassigned <= EPSILON) break;
    if (lot.left.quantity <= EPSILON) continue;
    const take = Math.min(lot.left.quantity, unassigned);
    lot.left.weightKg -= take * (lot.left.weightKg / lot.left.quantity); // this lot's kg per unit
    lot.left.quantity -= take;
    unassigned -= take;
  }

  return lots
    .filter((l) => l.left.quantity > EPSILON)
    .map((l) => ({
      ratePerKg: l.ratePerKg,
      firstBoughtOn: l.firstBoughtOn,
      bought: l.bought,
      suppliers: l.suppliers,
      stock: { quantity: round2(l.left.quantity), weightKg: round3(l.left.weightKg) },
    }));
}

// What the Items screen lists: one row per lot when 2+ price lots are in
// stock ("miniket-40rs/kg", "miniket-45rs/kg"), otherwise the item as one row.
export type StockRow = { key: string; label: string } & Pick<ItemDTO, "stock" | "bought" | "suppliers">;

export function stockRows(item: ItemDTO): StockRow[] {
  if (item.lots.length < 2) {
    return [{ key: item.id, label: item.name, stock: item.stock, bought: item.bought, suppliers: item.suppliers }];
  }
  return item.lots.map((lot) => ({
    key: `${item.id}@${lot.ratePerKg}`,
    label: lot.label,
    stock: lot.stock,
    bought: lot.bought,
    suppliers: lot.suppliers,
  }));
}

// "miniket-40rs/kg" when several lots are in stock, plain "miniket" when one.
export function labelLots(itemName: string, lots: ReadonlyArray<Lot>): LotDTO[] {
  return lots.map((lot) => ({ ...lot, label: lots.length > 1 ? lotName(itemName, lot.ratePerKg) : itemName }));
}

export const lotName = (itemName: string, ratePerKg: number) => `${itemName}-${round2(ratePerKg)}rs/kg`;

export class LotError extends Error {}

// Which lot a sale line comes from. With one lot in stock it's picked
// automatically; with several the seller must choose.
export function pickLot(itemName: string, lots: ReadonlyArray<LotDTO>, requested: number | null | undefined): LotDTO {
  if (!lots.length) throw new LotError(`${itemName} is out of stock`);
  if (requested !== null && requested !== undefined) {
    const lot = lots.find((l) => sameRate(l.ratePerKg, requested));
    if (!lot) throw new LotError(`${lotName(itemName, requested)} is not in stock`);
    return lot;
  }
  if (lots.length > 1) throw new LotError(`Pick which ${itemName}: ${lots.map((l) => l.label).join(" or ")}`);
  return lots[0];
}
