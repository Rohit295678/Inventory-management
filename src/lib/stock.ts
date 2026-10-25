import { prisma } from "@/lib/db";
import { round2 } from "@/lib/pricing";
import type { Stock } from "@/lib/types";

// Stock on hand = everything bought − everything sold, per item.
// Two grouped queries instead of loading every line into memory.
export async function getStock(userId: string): Promise<Map<string, Stock>> {
  const totals = (type: "PURCHASE" | "SALE") =>
    prisma.transactionLine.groupBy({
      by: ["itemId"],
      where: { transaction: { userId, type } },
      _sum: { quantity: true, weightKg: true },
    });

  const [bought, sold] = await Promise.all([totals("PURCHASE"), totals("SALE")]);
  const stock = new Map<string, Stock>();

  const apply = (rows: Awaited<ReturnType<typeof totals>>, sign: 1 | -1) => {
    for (const row of rows) {
      const current = stock.get(row.itemId) ?? { quantity: 0, weightKg: 0 };
      stock.set(row.itemId, {
        quantity: round2(current.quantity + sign * (row._sum.quantity ?? 0)),
        weightKg: round2(current.weightKg + sign * (row._sum.weightKg ?? 0)),
      });
    }
  };
  apply(bought, 1);
  apply(sold, -1);
  return stock;
}
