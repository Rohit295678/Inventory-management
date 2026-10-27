"use client";
import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { PAYMENT_COPY } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { toPaise } from "@/lib/pricing";
import type { TransactionDTO } from "@/lib/types";
import { buttonClass } from "@/components/ui/styles";

export const isFullyPaid = (bill: Pick<TransactionDTO, "due">) => toPaise(bill.due) <= 0;

// "Mark settled" for a fully paid bill: it then leaves the payments screen.
// Used on bill cards and in the payment form's bill list.
export function SettleButton({ bill, onSettled }: { bill: TransactionDTO; onSettled: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function settle() {
    if (!confirm(`Mark the ${formatDate(bill.date)} bill of ${bill.party.name} as settled?`)) return;
    setBusy(true);
    setError("");
    try {
      await api(`/api/transactions?id=${bill.id}`, { method: "PATCH", body: { settled: true } });
      onSettled();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={settle} disabled={busy} className={buttonClass.secondary}>
        <BadgeCheck className="w-4 h-4" aria-hidden="true" /> {busy ? "Settling…" : "Mark settled"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </>
  );
}

// Under a bill: each payment (date + amount), then where the bill stands.
export function BillPaymentStatus({ bill, onSettled }: { bill: TransactionDTO; onSettled: () => void }) {
  const verb = PAYMENT_COPY[bill.type].verb;

  return (
    <div className="mt-2 pt-2 border-t border-line text-sm space-y-1.5">
      {bill.payments.length > 0 && (
        <ul aria-label="Payments" className="space-y-0.5">
          {bill.payments.map((p) => (
            <li key={p.paymentId} className="flex justify-between gap-3 text-green-700">
              <span>
                {verb} {formatDate(p.date)}
              </span>
              <span className="font-medium">{formatMoney(p.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      {bill.settledAt ? (
        <p className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-mint-100 text-brand-900 font-medium">
          <BadgeCheck className="w-4 h-4" aria-hidden="true" /> Settled
        </p>
      ) : isFullyPaid(bill) ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-green-700">Fully paid</p>
          <SettleButton bill={bill} onSettled={onSettled} />
        </div>
      ) : (
        <p className="flex flex-wrap justify-between gap-x-3">
          <span className="text-slate-700">
            {verb} <span className="font-medium text-slate-900">{formatMoney(bill.paid)}</span>
          </span>
          <span className="font-semibold text-red-700">Due {formatMoney(bill.due)}</span>
        </p>
      )}
    </div>
  );
}
