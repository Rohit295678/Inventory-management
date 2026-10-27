import { Trash2 } from "lucide-react";
import { formatDate, formatKg, formatLineQty, formatMoney } from "@/lib/format";
import type { TransactionDTO } from "@/lib/types";
import { BillPaymentStatus } from "@/components/payments/BillPaymentStatus";
import { cardClass, iconButtonClass } from "@/components/ui/styles";

type Props = { tx: TransactionDTO; onDelete: (tx: TransactionDTO) => void; onSettled: () => void };

export function TransactionCard({ tx, onDelete, onSettled }: Props) {
  return (
    <article className={`${cardClass} p-3 sm:p-4`} aria-label={`${tx.party.name}, ${formatDate(tx.date)}`}>
      <header className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900">{tx.party.name}</h3>
          <p className="text-xs text-slate-600">
            {formatDate(tx.date)}
            {tx.note && ` · ${tx.note}`}
          </p>
        </div>
        <p className="font-bold text-slate-900 whitespace-nowrap">{formatMoney(tx.totalAmount)}</p>
        <button
          onClick={() => onDelete(tx)}
          className={`${iconButtonClass.danger} -mt-1.5`}
          aria-label={`Delete bill from ${tx.party.name} on ${formatDate(tx.date)}`}
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </header>
      <ul className="mt-2 text-sm divide-y divide-slate-100">
        {tx.lines.map((l) => (
          <li key={l.id} className="flex flex-wrap justify-between gap-x-3 py-1.5">
            <span className="font-medium text-slate-800">{l.itemName}</span>
            <span className="text-slate-700">
              {formatLineQty(l)}
              {l.unit !== "kg" && ` (${formatKg(l.weightKg)})`} @ {formatMoney(l.ratePerKg)}/kg ={" "}
              <span className="font-semibold text-slate-900">{formatMoney(l.totalCost)}</span>
            </span>
          </li>
        ))}
      </ul>
      <BillPaymentStatus bill={tx} onSettled={onSettled} />
    </article>
  );
}
