import { Trash2 } from "lucide-react";
import { PAYMENT_COPY } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import type { PaymentDTO } from "@/lib/types";
import { cardClass, iconButtonClass } from "@/components/ui/styles";

// One payment: who, how much, and which bills it went to.
export function PaymentCard({ payment, onDelete }: { payment: PaymentDTO; onDelete: (p: PaymentDTO) => void }) {
  const verb = PAYMENT_COPY[payment.type].verb;
  return (
    <article className={`${cardClass} p-3 sm:p-4`} aria-label={`${payment.party.name}, ${formatMoney(payment.amount)}`}>
      <header className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-900">{payment.party.name}</h3>
          <p className="text-xs text-slate-600">
            {verb} {formatDate(payment.date)}
            {payment.note && ` · ${payment.note}`}
          </p>
        </div>
        <p className="font-bold text-green-700 whitespace-nowrap">{formatMoney(payment.amount)}</p>
        <button
          onClick={() => onDelete(payment)}
          className={`${iconButtonClass.danger} -mt-1.5`}
          aria-label={`Delete payment of ${formatMoney(payment.amount)} from ${payment.party.name}`}
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </header>
      <ul aria-label="Bills paid" className="mt-2 pt-2 border-t border-line text-sm space-y-0.5">
        {payment.allocations.map((a) => (
          <li key={a.transactionId} className="flex flex-wrap justify-between gap-x-3">
            <span className="text-slate-700">
              Bill of {formatDate(a.billDate)} <span className="text-slate-500">({formatMoney(a.billTotal)})</span>
            </span>
            <span className="font-medium text-slate-900">{formatMoney(a.amount)}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
