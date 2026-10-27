import { prisma } from "@/lib/db";
import { avgRatePerKg, round2, round3 } from "@/lib/pricing";
import type { Bought, ItemStats, SupplierBought } from "@/lib/types";

const ZERO_BOUGHT: Bought = { quantity: 0, weightKg: 0, totalCost: 0, avgRatePerKg: 0 };

export const EMPTY_STATS: ItemStats = {
  stock: { quantity: 0, weightKg: 0 },
  bought: ZERO_BOUGHT,
  suppliers: [],
};

type SupplierRow = {
  itemId: string;
  partyId: string;
  partyName: string;
  quantity: number;
  weightKg: number;
  totalCost: number;
  minRate: number;
  maxRate: number;
};

// Purchases per (item, supplier). Raw SQL because Prisma's groupBy can't group
// by a field of a related table (the supplier lives on the bill, not the line).
// Values are bound parameters, never string-concatenated.
function purchasesBySupplier(userId: string) {
  return prisma.$queryRaw<SupplierRow[]>`
    SELECT l.item_id                  AS "itemId",
           p.id                       AS "partyId",
           p.name                     AS "partyName",
           SUM(l.quantity)::float8    AS "quantity",
           SUM(l.weight_kg)::float8   AS "weightKg",
           SUM(l.total_cost)::float8  AS "totalCost",
           MIN(l.rate_per_kg)::float8 AS "minRate",
           MAX(l.rate_per_kg)::float8 AS "maxRate"
    FROM transaction_lines l
    JOIN transactions t ON t.id = l.transaction_id
    JOIN parties p      ON p.id = t.party_id
    WHERE t.user_id = ${userId} AND t.type = 'PURCHASE'
    GROUP BY l.item_id, p.id, p.name
    ORDER BY SUM(l.total_cost) DESC`;
}

function soldByItem(userId: string) {
  return prisma.transactionLine.groupBy({
    by: ["itemId"],
    where: { transaction: { userId, type: "SALE" } },
    _sum: { quantity: true, weightKg: true },
  });
}

const toBought = (quantity: number, weightKg: number, totalCost: number): Bought => ({
  quantity: round2(quantity),
  weightKg: round3(weightKg),
  totalCost: round2(totalCost),
  avgRatePerKg: avgRatePerKg(totalCost, weightKg),
});

// Per item: stock on hand (bought - sold), what was paid to suppliers in
// total, and the same broken down per supplier (prices differ per supplier).
export async function getItemStats(userId: string): Promise<Map<string, ItemStats>> {
  const [supplierRows, sold] = await Promise.all([purchasesBySupplier(userId), soldByItem(userId)]);

  const suppliersByItem = new Map<string, SupplierBought[]>();
  for (const r of supplierRows) {
    const supplier: SupplierBought = {
      partyId: r.partyId,
      partyName: r.partyName,
      ...toBought(r.quantity, r.weightKg, r.totalCost),
      minRatePerKg: round2(r.minRate),
      maxRatePerKg: round2(r.maxRate),
    };
    suppliersByItem.set(r.itemId, [...(suppliersByItem.get(r.itemId) ?? []), supplier]);
  }
  const soldById = new Map(sold.map((row) => [row.itemId, row._sum]));

  const stats = new Map<string, ItemStats>();
  for (const id of new Set([...suppliersByItem.keys(), ...soldById.keys()])) {
    const suppliers = suppliersByItem.get(id) ?? [];
    // Item totals = sum of its supplier rows, so the two can never disagree.
    const sum = (key: "quantity" | "weightKg" | "totalCost") => suppliers.reduce((acc, s) => acc + s[key], 0);
    const bought = toBought(sum("quantity"), sum("weightKg"), sum("totalCost"));
    const s = soldById.get(id);

    stats.set(id, {
      stock: {
        quantity: round2(bought.quantity - (s?.quantity ?? 0)),
        weightKg: round3(bought.weightKg - (s?.weightKg ?? 0)),
      },
      bought,
      suppliers,
    });
  }
  return stats;
}
