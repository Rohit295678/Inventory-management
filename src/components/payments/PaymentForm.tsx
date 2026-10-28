"use client";
import { useState } from "react";
import Link from "next/link";
import { api, errorMessage, useApi } from "@/lib/api-client";
import { PAYMENT_COPY, todayISO, type TxType } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { toPaise } from "@/lib/pricing";
import type { PartyDTO, TransactionDTO, TransactionsResponse } from "@/lib/types";
import { OpenBills } from "@/components/payments/OpenBills";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/PageHeader";
import { InlineLoading, Loading } from "@/components/ui/Spinner";
import { buttonClass, cardClass, inputClass } from "@/components/ui/styles";

type Props = {
  type: TxType;
  parties: PartyDTO[] | null; // null = still loading
  onSaved: () => void;
  onCancel: () => void;
};

const paise = (typed: string | undefined) => toPaise(Number(typed) || 0);
const rupees = (p: number) => String(p / 100);

export function PaymentForm({ parties, ...rest }: Props) {
  if (!parties) {
    return (
      <div className={`${cardClass} mb-5`}>
        <Loading label="Loading people…" />
      </div>
    );
  }
  if (!parties.length) {
    return (
      <div className={`${cardClass} p-4 mb-5 text-sm text-slate-800`}>
        Add a {PAYMENT_COPY[rest.type].party.toLowerCase()} on the{" "}
        <Link href="/parties" className="text-brand-800 underline font-semibold">
          People page
        </Link>{" "}
        first.
      </div>
    );
  }
  return <LoadedForm parties={parties} {...rest} />;
}

function LoadedForm({ type, parties, onSaved, onCancel }: Omit<Props, "parties"> & { parties: PartyDTO[] }) {
  const copy = PAYMENT_COPY[type];
  const [partyId, setPartyId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const bills = useApi<TransactionsResponse>(partyId ? `/api/transactions?type=${type}&partyId=${partyId}&status=open` : null);
  const openBills = bills.data?.transactions ?? [];

  const amountPaise = paise(amount);
  // Only bills still on screen count (one may have just been settled).
  const allocatedPaise = openBills.reduce((sum, b) => sum + paise(allocations[b.id]), 0);
  const leftPaise = amountPaise - allocatedPaise;
  const ready = amountPaise > 0 && leftPaise === 0;

  const allocate = (billId: string, value: string) => setAllocations((a) => ({ ...a, [billId]: value }));

  // As much as this bill can take from what's left of the amount.
  function payFull(bill: TransactionDTO) {
    const room = leftPaise + paise(allocations[bill.id]);
    allocate(bill.id, rupees(Math.max(0, Math.min(toPaise(bill.due), room))));
  }

  // Spread the whole amount over the oldest bills first.
  function fillOldestFirst() {
    let left = amountPaise;
    const next: Record<string, string> = {};
    for (const bill of openBills) {
      const take = Math.min(toPaise(bill.due), left);
      if (take > 0) next[bill.id] = rupees(take);
      left -= take;
    }
    setAllocations(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/payments", {
        method: "POST",
        body: {
          type,
          partyId,
          date,
          note,
          amount: Number(amount),
          allocations: openBills
            .filter((b) => paise(allocations[b.id]) > 0)
            .map((b) => ({ transactionId: b.id, amount: Number(allocations[b.id]) })),
        },
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  const balance =
    leftPaise > 0
      ? { text: `${formatMoney(leftPaise / 100)} still to put on bills`, tone: "text-slate-700" }
      : leftPaise < 0
        ? { text: `${formatMoney(-leftPaise / 100)} more than the amount`, tone: "text-red-700" }
        : amountPaise > 0
          ? { text: "Matches the amount", tone: "text-green-700" }
          : null;

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} p-4 sm:p-5 mb-5 space-y-4`} aria-label={`New payment ${copy.verb.toLowerCase()}`}>
      <h2 className="font-semibold text-brand-800">New payment ({copy.verb.toLowerCase()})</h2>
      <Alert message={error} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={copy.party}>
          {(id) => (
            <select
              id={id}
              value={partyId}
              onChange={(e) => {
                setPartyId(e.target.value);
                setAllocations({}); // bills belong to the previous person
              }}
              className={inputClass}
              required
            >
              <option value="">Choose…</option>
              {parties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <Field
          label={`Amount ${copy.verb.toLowerCase()} (₹)`}
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
        <Field label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cash, UPI, cheque no.…" />
      </div>

      {partyId && (
        <section aria-label="Unpaid bills" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">Unpaid bills (oldest first)</h3>
            {openBills.length > 1 && (
              <button type="button" onClick={fillOldestFirst} disabled={amountPaise <= 0} className={buttonClass.secondary}>
                Fill oldest bills first
              </button>
            )}
          </div>
          {bills.loading && !bills.data ? (
            <InlineLoading label="Loading bills…" />
          ) : openBills.length === 0 ? (
            <p className="text-sm text-slate-600">No unpaid bills for this person.</p>
          ) : (
            <OpenBills
              bills={openBills}
              verb={copy.verb}
              allocations={allocations}
              onAllocate={allocate}
              onPayFull={payFull}
              canPayFull={amountPaise > 0}
              onSettled={bills.reload}
            />
          )}
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line">
        <p className={`text-sm font-medium ${balance?.tone ?? ""}`} aria-live="polite">
          {balance?.text}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className={buttonClass.secondary}>
            Cancel
          </button>
          <button type="submit" disabled={saving || !ready} className={buttonClass.primary}>
            {saving ? "Saving…" : "Save payment"}
          </button>
        </div>
      </div>
    </form>
  );
}
