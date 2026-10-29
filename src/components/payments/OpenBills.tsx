"use client";
import { Eye } from "lucide-react";
import { isFullyPaid } from "@/lib/bill-status";
import { formatDate, formatMoney } from "@/lib/format";
import type { TransactionDTO } from "@/lib/types";
import { SettleButton } from "@/components/payments/BillPaymentStatus";
import { buttonClass, inputClass } from "@/components/ui/styles";

type Props = {
  bills: TransactionDTO[]; // open bills of one person, oldest first (API order)
  verb: string; // Received | Paid
  allocations: Record<string, string>; // billId -> typed amount
  onAllocate: (billId: string, value: string) => void;
  onPayFull: (bill: TransactionDTO) => void;
  canPayFull: boolean; // false until an amount is entered
  onSettled: () => void;
  onView: (bill: TransactionDTO) => void; // open the bill in a pop-up
};

const itemNames = (bill: TransactionDTO) => [...new Set(bill.lines.map((l) => l.itemName))].join(", ");

// A person's unpaid bills; type how much of this payment goes on each.
export function OpenBills({ bills, verb, allocations, onAllocate, onPayFull, canPayFull, onSettled, onView }: Props) {
  return (
    <div className="space-y-2">
      {bills.map((bill) => (
        <fieldset key={bill.id} className="rounded-2xl border border-line bg-canvas/60 p-3 sm:p-4">
          <legend className="px-1 text-sm font-semibold text-brand-800">{formatDate(bill.date)}</legend>
          <div className="flex items-start justify-between gap-3 text-sm">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => onView(bill)}
                className="max-w-full inline-flex items-center gap-1.5 text-left font-medium text-brand-800 underline-offset-2 hover:underline"
                aria-label={`View bill of ${formatDate(bill.date)}: ${itemNames(bill)}`}
              >
                <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{itemNames(bill)}</span>
                <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs">View bill</span>
              </button>
              {bill.paid > 0 && (
                <p className="text-xs text-slate-600 mt-0.5">
                  Already {verb.toLowerCase()} {formatMoney(bill.paid)}
                </p>
              )}
            </div>
            <dl className="text-right whitespace-nowrap">
              <div>
                <dt className="sr-only">Total</dt>
                <dd className="text-slate-800">
                  Total <span className="font-semibold">{formatMoney(bill.totalAmount)}</span>
                </dd>
              </div>
              <div>
                <dt className="sr-only">Due</dt>
                {isFullyPaid(bill) ? (
                  <dd className="font-medium text-green-700">Fully paid</dd>
                ) : (
                  <dd className="font-semibold text-red-700">Due {formatMoney(bill.due)}</dd>
                )}
              </div>
            </dl>
          </div>

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
      ))}
    </div>
  );
}
