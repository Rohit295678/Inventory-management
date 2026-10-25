"use client";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, Plus } from "lucide-react";
import { api, errorMessage, useApi } from "@/lib/api-client";
import { TX_COPY, partyKindsFor, todayISO, type TxType } from "@/lib/domain";
import { formatDate, formatDateRange, formatMoney } from "@/lib/format";
import type { ItemDTO, PartyDTO, TransactionDTO, TransactionsResponse } from "@/lib/types";
import { SummaryPanel } from "@/components/transactions/SummaryPanel";
import { TransactionCard } from "@/components/transactions/TransactionCard";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { Field } from "@/components/ui/Field";
import { Alert, EmptyState, PageHeader } from "@/components/ui/PageHeader";
import { buttonClass, chipClass, inputClass } from "@/components/ui/styles";

type Range = { from: string; to: string };

function quickRanges(): { label: string; range: Range }[] {
  const now = new Date();
  const today = todayISO(now);
  const daysAgo = (n: number) => todayISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
  return [
    { label: "Today", range: { from: today, to: today } },
    { label: "Last 7 days", range: { from: daysAgo(6), to: today } },
    { label: "This month", range: { from: todayISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: today } },
    { label: "All", range: { from: "", to: "" } },
  ];
}

const groupByDate = (txs: TransactionDTO[]) => {
  const groups = new Map<string, TransactionDTO[]>();
  for (const tx of txs) groups.set(tx.date, [...(groups.get(tx.date) ?? []), tx]);
  return [...groups.entries()];
};

export function TransactionsView({ type }: { type: TxType }) {
  const copy = TX_COPY[type];
  const params = useSearchParams();
  const initialParty = params.get("partyId") ?? "";
  const today = todayISO();

  // Coming from a person's page → show their whole history, else just today.
  const [range, setRange] = useState<Range>(initialParty ? { from: "", to: "" } : { from: today, to: today });
  const [partyId, setPartyId] = useState(initialParty);
  const [showForm, setShowForm] = useState(false);
  const [actionError, setActionError] = useState("");

  const query = new URLSearchParams({ type, ...range, ...(partyId && { partyId }) });
  for (const [k, v] of [...query]) if (!v) query.delete(k);

  const txs = useApi<TransactionsResponse>(`/api/transactions?${query}`);
  const items = useApi<ItemDTO[]>("/api/items");
  const parties = useApi<PartyDTO[]>(`/api/parties?kind=${partyKindsFor(type)[0]}`);
  const groups = useMemo(() => groupByDate(txs.data?.transactions ?? []), [txs.data]);

  async function remove(tx: TransactionDTO) {
    if (!confirm(`Delete this ${copy.noun} from ${tx.party.name} (${formatMoney(tx.totalAmount)})?`)) return;
    try {
      await api(`/api/transactions?id=${tx.id}`, { method: "DELETE" });
      txs.reload();
      items.reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  const partyName = parties.data?.find((p) => p.id === partyId)?.name;

  return (
    <>
      <PageHeader
        title={copy.title}
        subtitle={`${formatDateRange(range.from || undefined, range.to || undefined)}${partyName ? ` · ${partyName}` : ""}`}
        actions={
          <>
            <a href={`/api/reports/pdf?${query}`} className={buttonClass.secondary} download>
              <Download className="w-4 h-4" aria-hidden="true" /> PDF
            </a>
            {!showForm && (
              <button onClick={() => setShowForm(true)} className={buttonClass.primary}>
                <Plus className="w-4 h-4" aria-hidden="true" /> New {copy.noun}
              </button>
            )}
          </>
        }
      />
      <Alert message={txs.error || items.error || parties.error || actionError} />

      {showForm && (
        <TransactionForm
          type={type}
          items={items.data ?? []}
          parties={parties.data ?? []}
          onCancel={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            txs.reload();
            items.reload();
          }}
        />
      )}

      <section aria-label="Filters" className="mb-4 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {quickRanges().map(({ label, range: r }) => {
            const active = r.from === range.from && r.to === range.to;
            return (
              <button
                key={label}
                onClick={() => setRange(r)}
                aria-pressed={active}
                className={chipClass(active)}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
          <Field label="From" type="date" value={range.from} max={range.to || undefined} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          <Field label="To" type="date" value={range.to} min={range.from || undefined} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          <Field label={copy.party} className="col-span-2 sm:col-span-1">
            {(id) => (
              <select id={id} value={partyId} onChange={(e) => setPartyId(e.target.value)} className={inputClass}>
                <option value="">Everyone</option>
                {parties.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
      </section>

      {txs.data && <SummaryPanel type={type} summary={txs.data.summary} />}

      {txs.loading && !txs.data ? (
        <EmptyState>Loading…</EmptyState>
      ) : groups.length === 0 ? (
        <EmptyState>No {copy.title.toLowerCase()} for this period.</EmptyState>
      ) : (
        <div className="space-y-5">
          {groups.map(([date, list]) => (
            <section key={date} aria-labelledby={`day-${date}`}>
              <div className="flex justify-between items-baseline mb-2">
                <h2 id={`day-${date}`} className="text-sm font-semibold text-slate-700">
                  {formatDate(date)}
                </h2>
                <p className="text-sm font-semibold text-slate-800">
                  {formatMoney(list.reduce((sum, tx) => sum + tx.totalAmount, 0))}
                </p>
              </div>
              <div className="space-y-2">
                {list.map((tx) => (
                  <TransactionCard key={tx.id} tx={tx} onDelete={remove} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
