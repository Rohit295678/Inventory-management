"use client";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { api, errorMessage, useApi } from "@/lib/api-client";
import { filterQuery, groupByDate, todayRange } from "@/lib/date-filters";
import { PAYMENT_COPY, partyKindsFor, type TxType } from "@/lib/domain";
import { formatDate, formatDateRange, formatMoney } from "@/lib/format";
import type { PartyDTO, PaymentDTO, PaymentsResponse } from "@/lib/types";
import { PaymentCard } from "@/components/payments/PaymentCard";
import { PaymentForm } from "@/components/payments/PaymentForm";
import { FilterBar } from "@/components/ui/FilterBar";
import { Alert, EmptyState, PageHeader } from "@/components/ui/PageHeader";
import { Loading } from "@/components/ui/Spinner";
import { StatTiles } from "@/components/ui/StatTiles";
import { buttonClass } from "@/components/ui/styles";

// One screen, two tabs: SALE = payments received from customers,
// PURCHASE = payments made to suppliers (like TransactionsView).
export function PaymentsView({ type }: { type: TxType }) {
  const copy = PAYMENT_COPY[type];
  const [range, setRange] = useState(todayRange);
  const [partyId, setPartyId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [actionError, setActionError] = useState("");

  const payments = useApi<PaymentsResponse>(`/api/payments?${filterQuery(type, range, partyId)}`);
  const parties = useApi<PartyDTO[]>(`/api/parties?kind=${partyKindsFor(type)[0]}`);
  const groups = useMemo(() => groupByDate(payments.data?.payments ?? []), [payments.data]);

  async function remove(p: PaymentDTO) {
    if (!confirm(`Delete this payment of ${formatMoney(p.amount)} from ${p.party.name}? The bills it paid will show as due again.`)) return;
    try {
      await api(`/api/payments?id=${p.id}`, { method: "DELETE" });
      payments.reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  const partyName = parties.data?.find((p) => p.id === partyId)?.name;
  const summary = payments.data?.summary;

  return (
    <>
      <PageHeader
        title={copy.title}
        subtitle={`${formatDateRange(range.from || undefined, range.to || undefined)}${partyName ? ` · ${partyName}` : ""}`}
        actions={
          !showForm && (
            <button onClick={() => setShowForm(true)} className={buttonClass.primary}>
              <Plus className="w-4 h-4" aria-hidden="true" /> New payment
            </button>
          )
        }
      />
      <Alert message={payments.error || parties.error || actionError} />

      {showForm && (
        <PaymentForm
          type={type}
          parties={parties.data}
          onCancel={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            payments.reload();
          }}
        />
      )}

      <FilterBar range={range} onRange={setRange} partyLabel={copy.party} parties={parties.data} partyId={partyId} onParty={setPartyId} />

      {summary && (
        <section aria-label="Summary" className="mb-5">
          <StatTiles
            stats={[
              { label: `Total ${copy.verb.toLowerCase()}`, value: formatMoney(summary.totalAmount) },
              { label: "Payments", value: String(summary.count) },
            ]}
          />
        </section>
      )}

      {payments.loading && !payments.data ? (
        <Loading label="Loading payments…" />
      ) : groups.length === 0 ? (
        <EmptyState>No payments for this period.</EmptyState>
      ) : (
        <div className="space-y-5">
          {groups.map(([date, list]) => (
            <section key={date} aria-labelledby={`pay-${date}`}>
              <div className="flex justify-between items-baseline mb-2">
                <h2 id={`pay-${date}`} className="text-sm font-semibold text-slate-700">
                  {formatDate(date)}
                </h2>
                <p className="text-sm font-semibold text-slate-800">{formatMoney(list.reduce((sum, p) => sum + p.amount, 0))}</p>
              </div>
              <div className="space-y-2">
                {list.map((p) => (
                  <PaymentCard key={p.id} payment={p} onDelete={remove} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
