"use client";
import { formatDate, formatMoney } from "@/lib/format";
import type { TransactionDTO } from "@/lib/types";
import { isFullyPaid, SettleButton } from "@/components/payments/BillPaymentStatus";
import { buttonClass, inputClass } from "@/components/ui/styles";

type Props = {
  bills: TransactionDTO[]; // open bills of one person, newest first (API order)
  verb: string; // Received | Paid
  allocations: Record<string, string>; // billId -> typed amount
  onAllocate: (billId: string, value: string) => void;
  onPayFull: (bill: TransactionDTO) => void;
  canPayFull: boolean; // false until an amount is entered
  onSettled: () => void;
};

const itemNames = (bill: TransactionDTO) => [...new Set(bill.lines.map((l) => l.itemName))].join(", ");

// A person's unpaid bills; type how much of this payment goes on each.
export function OpenBills({ bills, verb, allocations, onAllocate, onPayFull, canPayFull, onSettled }: Props) {
  return (
    <div className="space-y-2">
      {bills.map((bill) => {
        const legend = `Bill of ${formatDate(bill.date)} · ${formatMoney(bill.totalAmount)}`;
        return (
          <fieldset key={bill.id} className="rounded-2xl border border-line bg-canvas/60 p-3 sm:p-4">
            <legend className="px-1 text-sm font-semibold text-brand-800">{legend}</legend>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="text-slate-700 min-w-0 truncate">{itemNames(bill)}</span>
              {isFullyPaid(bill) ? (
                <span className="font-medium text-green-700">Fully paid</span>
              ) : (
                <span className="font-semibold text-red-700 whitespace-nowrap">Due {formatMoney(bill.due)}</span>
              )}
            </div>
            {bill.paid > 0 && (
              <p className="text-xs text-slate-600 mt-0.5">
                Already {verb.toLowerCase()} {formatMoney(bill.paid)}
              </p>
            )}

            {isFullyPaid(bill) ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <SettleButton bill={bill} onSettled={onSettled} />
              </div>
            ) : (
              <div className="mt-2 flex gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max={bill.due}
                  step="any"
                  aria-label="Amount for this bill"
                  placeholder="Amount for this bill"
                  value={allocations[bill.id] ?? ""}
                  onChange={(e) => onAllocate(bill.id, e.target.value)}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => onPayFull(bill)}
                  disabled={!canPayFull}
                  className={`${buttonClass.secondary} whitespace-nowrap`}
                >
                  Pay full
                </button>
              </div>
            )}
          </fieldset>
        );
      })}
    </div>
  );
}
