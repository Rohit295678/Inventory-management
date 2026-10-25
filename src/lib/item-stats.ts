import { prisma } from "@/lib/db";
import { avgRatePerKg, round2, round3 } from "@/lib/pricing";
import type { ItemStats } from "@/lib/types";

const ZERO = { quantity: 0, weightKg: 0 };

export const EMPTY_STATS: ItemStats = {
  stock: ZERO,
  bought: { ...ZERO, totalCost: 0, avgRatePerKg: 0 },
};

// Per item: stock on hand (bought - sold) and what was paid to suppliers.
// Two grouped queries instead of loading every line into memory.
export async function getItemStats(userId: string): Promise<Map<string, ItemStats>> {
  const totals = (type: "PURCHASE" | "SALE") =>
    prisma.transactionLine.groupBy({
      by: ["itemId"],
      where: { transaction: { userId, type } },
      _sum: { quantity: true, weightKg: true, totalCost: true },
    });

  const [bought, sold] = await Promise.all([totals("PURCHASE"), totals("SALE")]);
  const boughtById = new Map(bought.map((row) => [row.itemId, row._sum]));
  const soldById = new Map(sold.map((row) => [row.itemId, row._sum]));
  const stats = new Map<string, ItemStats>();

  for (const id of new Set([...boughtById.keys(), ...soldById.keys()])) {
    const b = boughtById.get(id);
    const s = soldById.get(id);
    const boughtQty = b?.quantity ?? 0;
    const boughtKg = b?.weightKg ?? 0;
    const boughtCost = b?.totalCost ?? 0;

    stats.set(id, {
      stock: {
        quantity: round2(boughtQty - (s?.quantity ?? 0)),
        weightKg: round3(boughtKg - (s?.weightKg ?? 0)),
      },
      bought: {
        quantity: round2(boughtQty),
        weightKg: round3(boughtKg),
        totalCost: round2(boughtCost),
        avgRatePerKg: avgRatePerKg(boughtCost, boughtKg),
      },
    });
  }
  return stats;
}
