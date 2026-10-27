import { formatKg, formatMoney, formatQty, plural } from "@/lib/format";
import { TX_COPY, type TxType } from "@/lib/domain";
import type { Summary } from "@/lib/types";
import { cardClass } from "@/components/ui/styles";
import { StatTiles } from "@/components/ui/StatTiles";

// Totals for the current filter: grand total, per item, per person.
export function SummaryPanel({ type, summary }: { type: TxType; summary: Summary }) {
  const copy = TX_COPY[type];
  const stats = [
    { label: "Total amount", value: formatMoney(summary.totalAmount) },
    { label: "Due", value: formatMoney(summary.totalDue) },
    { label: "Total weight", value: formatKg(summary.totalWeightKg) },
    { label: "Bills", value: String(summary.bills) },
  ];

  return (
    <section aria-label="Summary" className="space-y-3 mb-5">
      <StatTiles stats={stats} />

      {summary.byItem.length > 0 && (
        <div className={`${cardClass} overflow-x-auto`}>
          <table className="w-full text-sm">
            <caption className="text-left font-semibold text-slate-900 px-3 pt-3 pb-1">Item-wise</caption>
            <thead className="text-slate-600 text-xs">
              <tr>
                <th scope="col" className="text-left px-3 py-2">Item</th>
                <th scope="col" className="text-right px-3 py-2">Qty</th>
                <th scope="col" className="text-right px-3 py-2">Avg / kg</th>
                <th scope="col" className="text-right px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.byItem.map((i) => (
                <tr key={`${i.itemId}:${i.unit}`}>
                  <th scope="row" className="text-left font-medium px-3 py-2">{i.itemName}</th>
                  <td className="text-right px-3 py-2 whitespace-nowrap">
                    {formatQty(i.quantity, i.unit)}
                    {i.unit !== "kg" && <span className="block text-xs text-slate-600">{formatKg(i.weightKg)}</span>}
                  </td>
                  <td className="text-right px-3 py-2 whitespace-nowrap">{formatMoney(i.avgRatePerKg)}</td>
                  <td className="text-right px-3 py-2 font-semibold whitespace-nowrap">{formatMoney(i.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {summary.byParty.length > 1 && (
        <div className={`${cardClass} p-3`}>
          <h3 className="font-semibold text-slate-900 mb-2 text-sm">{copy.party}-wise</h3>
          <ul className="text-sm divide-y divide-slate-100">
            {summary.byParty.map((p) => (
              <li key={p.partyId} className="flex justify-between py-1.5">
                <span>
                  {p.partyName} <span className="text-slate-600">({plural(p.bills, "bill")})</span>
                </span>
                <span className="font-semibold">{formatMoney(p.totalAmount)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
