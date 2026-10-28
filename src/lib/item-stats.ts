import { prisma } from "@/lib/db";
import { toISODate } from "@/lib/domain";
import { buildLots, labelLots, toBought, type PurchaseRow, type SaleRow } from "@/lib/lots";
import { round2, round3 } from "@/lib/pricing";
import type { Bought, ItemStats, SupplierBought } from "@/lib/types";

const ZERO_BOUGHT: Bought = { quantity: 0, weightKg: 0, totalCost: 0, avgRatePerKg: 0 };

export const EMPTY_STATS: ItemStats = {
  stock: { quantity: 0, weightKg: 0 },
  bought: ZERO_BOUGHT,
  suppliers: [],
  lots: [],
};

type PurchaseSqlRow = Omit<PurchaseRow, "firstDate" | "firstCreatedAt"> & {
  itemId: string;
  itemName: string;
  firstDate: Date;
  firstCreatedAt: Date;
};

// Purchases per (item, supplier, price per kg). Raw SQL because Prisma's
// groupBy can't group by a field of a related table (the supplier lives on
// the bill, not the line). Values are bound parameters, never concatenated.
// Supplier totals, item totals and price lots are all built from these rows,
// so they can never disagree.
function purchaseRows(userId: string) {
  return prisma.$queryRaw<PurchaseSqlRow[]>`
    SELECT l.item_id                                 AS "itemId",
           i.name                                    AS "itemName",
           p.id                                      AS "partyId",
           p.name                                    AS "partyName",
           ROUND(l.rate_per_kg::numeric, 2)::float8  AS "ratePerKg",
           SUM(l.quantity)::float8                   AS "quantity",
           SUM(l.weight_kg)::float8                  AS "weightKg",
           SUM(l.total_cost)::float8                 AS "totalCost",
           MIN(t.date)                               AS "firstDate",
           MIN(t.created_at)                         AS "firstCreatedAt"
    FROM transaction_lines l
    JOIN transactions t ON t.id = l.transaction_id
    JOIN parties p      ON p.id = t.party_id
    JOIN items i        ON i.id = l.item_id
    WHERE t.user_id = ${userId} AND t.type = 'PURCHASE'
    GROUP BY l.item_id, i.name, p.id, p.name, ROUND(l.rate_per_kg::numeric, 2)`;
}

// Sold per (item, lot). lotRatePerKg is null for sales saved before lots.
function soldByLot(userId: string) {
  return prisma.transactionLine.groupBy({
    by: ["itemId", "lotRatePerKg"],
    where: { transaction: { userId, type: "SALE" } },
    _sum: { quantity: true, weightKg: true },
  });
}

// One row per supplier: totals and the price range they charged.
function bySupplier(rows: ReadonlyArray<PurchaseRow>): SupplierBought[] {
  const groups = new Map<string, PurchaseRow[]>();
  for (const r of rows) groups.set(r.partyId, [...(groups.get(r.partyId) ?? []), r]);
  return [...groups.values()]
    .map((list) => {
      const sum = (key: "quantity" | "weightKg" | "totalCost") => list.reduce((acc, r) => acc + r[key], 0);
      const rates = list.map((r) => r.ratePerKg);
      return {
        partyId: list[0].partyId,
        partyName: list[0].partyName,
        ...toBought(sum("quantity"), sum("weightKg"), sum("totalCost")),
        minRatePerKg: Math.min(...rates),
        maxRatePerKg: Math.max(...rates),
      };
    })
    .sort((a, b) => b.totalCost - a.totalCost);
}

// Per item: stock on hand (bought - sold), what was paid in total and per
// supplier, and the stock split into price lots ("miniket-40rs/kg").
export async function getItemStats(userId: string): Promise<Map<string, ItemStats>> {
  const [purchased, sold] = await Promise.all([purchaseRows(userId), soldByLot(userId)]);

  const purchasesByItem = new Map<string, { name: string; rows: PurchaseRow[] }>();
  for (const { itemId, itemName, firstDate, firstCreatedAt, ...row } of purchased) {
    const entry = purchasesByItem.get(itemId) ?? { name: itemName, rows: [] };
    entry.rows.push({ ...row, firstDate: toISODate(firstDate), firstCreatedAt: firstCreatedAt.toISOString() });
    purchasesByItem.set(itemId, entry);
  }
  const salesByItem = new Map<string, SaleRow[]>();
  for (const s of sold) {
    const row = { lotRatePerKg: s.lotRatePerKg, quantity: s._sum.quantity ?? 0, weightKg: s._sum.weightKg ?? 0 };
    salesByItem.set(s.itemId, [...(salesByItem.get(s.itemId) ?? []), row]);
  }

  const stats = new Map<string, ItemStats>();
  for (const id of new Set([...purchasesByItem.keys(), ...salesByItem.keys()])) {
    const { name = "", rows = [] } = purchasesByItem.get(id) ?? {};
    const sales = salesByItem.get(id) ?? [];
    const suppliers = bySupplier(rows);
    const sum = (key: "quantity" | "weightKg" | "totalCost") => suppliers.reduce((acc, s) => acc + s[key], 0);
    const bought = toBought(sum("quantity"), sum("weightKg"), sum("totalCost"));
    const soldTotal = (key: "quantity" | "weightKg") => sales.reduce((acc, s) => acc + s[key], 0);

    stats.set(id, {
      stock: { quantity: round2(bought.quantity - soldTotal("quantity")), weightKg: round3(bought.weightKg - soldTotal("weightKg")) },
      bought,
      suppliers,
      lots: labelLots(name, buildLots(rows, sales)),
    });
  }
  return stats;
}
