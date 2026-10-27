import { avgRatePerKg, round2, round3 } from "./pricing.ts";
import type { ItemSummary, PartySummary, Summary, TransactionDTO } from "./types.ts";

// Pure roll-up of a list of bills: grand totals + per-item + per-person.
// Used by the list endpoint and the PDF so both always agree.
export function summarize(transactions: ReadonlyArray<TransactionDTO>): Summary {
  const byItem = new Map<string, ItemSummary>();
  const byParty = new Map<string, PartySummary>();
  let totalAmount = 0;
  let totalPaid = 0;
  let totalDue = 0;
  let totalWeightKg = 0;

  for (const tx of transactions) {
    totalAmount += tx.totalAmount;
    totalPaid += tx.paid;
    totalDue += tx.due;

    const party = byParty.get(tx.party.id) ?? {
      partyId: tx.party.id,
      partyName: tx.party.name,
      bills: 0,
      totalAmount: 0,
    };
    party.bills += 1;
    party.totalAmount += tx.totalAmount;
    byParty.set(tx.party.id, party);

    for (const line of tx.lines) {
      totalWeightKg += line.weightKg;
      // Key on unit too: 10 "bags" + 5 "kg" of rice shouldn't be summed as 15.
      const key = `${line.itemId}:${line.unit}`;
      const item = byItem.get(key) ?? {
        itemId: line.itemId,
        itemName: line.itemName,
        unit: line.unit,
        quantity: 0,
        weightKg: 0,
        totalCost: 0,
        avgRatePerKg: 0,
      };
      item.quantity += line.quantity;
      item.weightKg += line.weightKg;
      item.totalCost += line.totalCost;
      byItem.set(key, item);
    }
  }

  const items = [...byItem.values()].map((i) => ({
    ...i,
    quantity: round2(i.quantity),
    weightKg: round3(i.weightKg),
    totalCost: round2(i.totalCost),
    avgRatePerKg: avgRatePerKg(i.totalCost, i.weightKg),
  }));
  const parties = [...byParty.values()].map((p) => ({ ...p, totalAmount: round2(p.totalAmount) }));

  return {
    bills: transactions.length,
    totalAmount: round2(totalAmount),
    totalPaid: round2(totalPaid),
    totalDue: round2(totalDue),
    totalWeightKg: round3(totalWeightKg),
    byItem: items.sort((a, b) => b.totalCost - a.totalCost),
    byParty: parties.sort((a, b) => b.totalAmount - a.totalAmount),
  };
}
