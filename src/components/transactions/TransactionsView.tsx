"use client";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { api, errorMessage, useApi } from "@/lib/api-client";
import { ALL_TIME, filterQuery, groupByDate, todayRange } from "@/lib/date-filters";
import { TX_COPY, partyKindsFor, type TxType } from "@/lib/domain";
import { formatDate, formatDateRange, formatMoney } from "@/lib/format";
import type { ItemDTO, PartyDTO, TransactionDTO, TransactionsResponse } from "@/lib/types";
import { SummaryPanel } from "@/components/transactions/SummaryPanel";
import { TransactionCard } from "@/components/transactions/TransactionCard";
import { TransactionForm } from "@/components/transactions/TransactionForm";
import { FilterBar } from "@/components/ui/FilterBar";
import { Alert, EmptyState, PageHeader } from "@/components/ui/PageHeader";
import { Loading } from "@/components/ui/Spinner";
import { buttonClass } from "@/components/ui/styles";

export function TransactionsView({ type }: { type: TxType }) {
  const copy = TX_COPY[type];
  const params = useSearchParams();
  const initialParty = params.get("partyId") ?? "";

  // Coming from a person's page -> show their whole history, else just today.
  const [range, setRange] = useState(initialParty ? ALL_TIME : todayRange);
  const [partyId, setPartyId] = useState(initialParty);
  const [showForm, setShowForm] = useState(false);
  const [actionError, setActionError] = useState("");

  const txs = useApi<TransactionsResponse>(`/api/transactions?${filterQuery(type, range, partyId)}`);
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
          !showForm && (
            <button onClick={() => setShowForm(true)} className={buttonClass.primary}>
              <Plus className="w-4 h-4" aria-hidden="true" /> New {copy.noun}
            </button>
          )
        }
      />
      <Alert message={txs.error || items.error || parties.error || actionError} />

      {showForm && (
        <TransactionForm
          type={type}
          items={items.data}
          parties={parties.data}
          onCancel={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            txs.reload();
            items.reload();
          }}
        />
      )}

      <FilterBar
        range={range}
        onRange={setRange}
        partyLabel={copy.party}
        parties={parties.data}
        partyId={partyId}
        onParty={setPartyId}
      />

      {txs.data && <SummaryPanel type={type} summary={txs.data.summary} />}

      {txs.loading && !txs.data ? (
        <Loading label={`Loading ${copy.title.toLowerCase()}…`} />
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
                  <TransactionCard key={tx.id} tx={tx} onDelete={remove} onSettled={txs.reload} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
