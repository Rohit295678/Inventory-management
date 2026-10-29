"use client";
import { useState } from "react";
import { ExternalLink, FileDown, Printer, Trash2 } from "lucide-react";
import { errorMessage, useApi } from "@/lib/api-client";
import { BILL_STATUS_LABEL, billStatus, isFullyPaid, paidPercent, type BillStatus } from "@/lib/bill-status";
import { PAYMENT_COPY } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import type { BillDetailDTO, TransactionDTO } from "@/lib/types";
import { deleteBill } from "@/components/bills/delete-bill";
import { BillItems, BillParties, BillPaymentsTimeline } from "@/components/bills/BillSections";
import { SettleButton } from "@/components/payments/BillPaymentStatus";
import { Alert } from "@/components/ui/PageHeader";
import { Loading } from "@/components/ui/Spinner";
import { buttonClass } from "@/components/ui/styles";

const STATUS_PILL: Record<BillStatus, string> = {
  settled: "bg-mint-100 text-brand-900",
  paid: "bg-green-100 text-green-900",
  partly: "bg-accent-400 text-brand-900",
  unpaid: "bg-red-100 text-red-900",
};

type Props = {
  id: string;
  mode: "page" | "modal"; // the page can print; the pop-up can open the page
  onChanged?: () => void; // settled/deleted: let the list behind refresh
  onDeleted: (bill: TransactionDTO) => void;
};

// One bill in full: header with status and balance, actions, who, items,
// payments. Used by the bill page (new tab) and the payment form's pop-up.
export function BillDetail({ id, mode, onChanged, onDeleted }: Props) {
  const detail = useApi<BillDetailDTO>(`/api/transactions/detail?id=${id}`);
  const [error, setError] = useState("");

  if (!detail.data) {
    return detail.error ? <Alert message={detail.error} /> : <Loading label="Loading bill…" />;
  }
  const { bill } = detail.data;
  const verb = PAYMENT_COPY[bill.type].verb;
  const status = billStatus(bill);
  const percent = paidPercent(bill);

  async function remove() {
    setError("");
    try {
      if (await deleteBill(bill)) {
        onChanged?.();
        onDeleted(bill);
      }
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <article className="space-y-3" aria-label={`Bill: ${bill.party.name}, ${formatDate(bill.date)}`}>
      <header className="rounded-3xl bg-nav text-on-nav p-5 sm:p-6 print:bg-white print:text-slate-900 print:border print:border-line">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-on-nav-muted print:text-slate-600">
              {bill.type === "SALE" ? "Sales invoice" : "Purchase invoice"}
            </p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-semibold">{bill.party.name}</h2>
            <p className="mt-1 text-sm text-on-nav-muted print:text-slate-600">
              {formatDate(bill.date)}
              {bill.note && ` \u00b7 ${bill.note}`}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_PILL[status]}`}>{BILL_STATUS_LABEL[status]}</span>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-on-nav-muted print:text-slate-600">Bill total</dt>
            <dd className="text-xl sm:text-2xl font-semibold">{formatMoney(bill.totalAmount)}</dd>
          </div>
          <div className="text-right">
            <dt className="text-xs text-on-nav-muted print:text-slate-600">{status === "settled" ? "Settled" : "Balance due"}</dt>
            <dd className={`text-xl sm:text-2xl font-bold ${isFullyPaid(bill) ? "" : "text-accent-400 print:text-red-700"}`}>
              {formatMoney(status === "settled" ? 0 : bill.due)}
            </dd>
          </div>
        </dl>

        <div className="mt-4">
          <div
            role="progressbar"
            aria-label={`${verb} so far`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="h-2.5 rounded-full bg-white/20 overflow-hidden print:bg-slate-200"
          >
            <div className="h-full rounded-full bg-accent-400 print:bg-green-700" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-on-nav-muted print:text-slate-600">
            {verb} {formatMoney(bill.paid)} of {formatMoney(bill.totalAmount)} ({percent}%)
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 print:hidden">
        <a href={`/api/reports/bill?id=${bill.id}`} download className={buttonClass.secondary}>
          <FileDown className="w-4 h-4" aria-hidden="true" /> Download PDF
        </a>
        {mode === "page" ? (
          <button type="button" onClick={() => window.print()} className={buttonClass.secondary}>
            <Printer className="w-4 h-4" aria-hidden="true" /> Print
          </button>
        ) : (
          <a href={`/bills/${bill.id}`} target="_blank" rel="noopener" className={buttonClass.secondary}>
            <ExternalLink className="w-4 h-4" aria-hidden="true" /> Open in new tab
          </a>
        )}
        {status === "paid" && (
          <SettleButton
            bill={bill}
            onSettled={() => {
              detail.reload();
              onChanged?.();
            }}
          />
        )}
        <button type="button" onClick={remove} className={`${buttonClass.danger} ml-auto`}>
          <Trash2 className="w-4 h-4" aria-hidden="true" /> Delete bill
        </button>
      </div>
      <Alert message={error} />

      <BillParties detail={detail.data} />
      <BillItems detail={detail.data} />
      <BillPaymentsTimeline detail={detail.data} />
    </article>
  );
}
