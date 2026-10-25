"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { TX_COPY, todayISO, type TxType } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { sumTotals } from "@/lib/pricing";
import type { ItemDTO, PartyDTO } from "@/lib/types";
import { LineEditor, previewLine, toPayload, type LineDraft } from "@/components/transactions/LineEditor";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/PageHeader";
import { buttonClass, cardClass, inputClass } from "@/components/ui/styles";

type Props = {
  type: TxType;
  items: ItemDTO[];
  parties: PartyDTO[];
  onSaved: () => void;
  onCancel: () => void;
};

// Stable React keys for draft lines. A module counter (not crypto.randomUUID,
// which is unavailable on plain-http LAN addresses used for phone testing).
let lineKeySeq = 0;
const blankLine = (): LineDraft => ({
  key: ++lineKeySeq,
  itemId: "",
  quantity: "",
  weightPerUnitKg: "",
  priceMode: "rate",
  price: "",
});

export function TransactionForm({ type, items, parties, onSaved, onCancel }: Props) {
  const copy = TX_COPY[type];

  const [partyId, setPartyId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<LineDraft[]>(() => [blankLine()]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const itemById = new Map(items.map((i) => [i.id, i]));
  const grandTotal = sumTotals(lines.map((l) => previewLine(l, itemById.get(l.itemId)) ?? { totalCost: 0 }));

  const patchLine = (key: number, patch: Partial<LineDraft>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/transactions", {
        method: "POST",
        body: { type, partyId, date, note, lines: lines.map(toPayload) },
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  if (!items.length || !parties.length) {
    return (
      <div className={`${cardClass} p-4 mb-5 text-sm text-slate-800`}>
        Before adding a {copy.noun}, add at least one{" "}
        {!items.length && (
          <Link href="/items" className="text-brand-800 underline font-semibold">
            item
          </Link>
        )}
        {!items.length && !parties.length && " and one "}
        {!parties.length && (
          <Link href="/parties" className="text-brand-800 underline font-semibold">
            {copy.party.toLowerCase()}
          </Link>
        )}
        .
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} p-4 sm:p-5 mb-5 space-y-4`} aria-label={`New ${copy.noun}`}>
      <h2 className="font-semibold text-slate-900">New {copy.noun}</h2>
      <Alert message={error} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={copy.party} hint={`Not listed? Add them on the People page.`}>
          {(id) => (
            <select id={id} value={partyId} onChange={(e) => setPartyId(e.target.value)} className={inputClass} required>
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
      </div>

      <div className="space-y-3">
        {lines.map((line, index) => (
          <LineEditor
            key={line.key}
            index={index}
            line={line}
            items={items}
            canRemove={lines.length > 1}
            onChange={(patch) => patchLine(line.key, patch)}
            onRemove={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
          />
        ))}
        <button type="button" onClick={() => setLines((ls) => [...ls, blankLine()])} className={buttonClass.secondary}>
          <Plus className="w-4 h-4" aria-hidden="true" /> Add another item
        </button>
      </div>

      <Field label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bill no., vehicle…" />

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
        <p className="text-lg font-bold text-slate-900" aria-live="polite">
          Total: {formatMoney(grandTotal)}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className={buttonClass.secondary}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={buttonClass.primary}>
            {saving ? "Saving…" : `Save ${copy.noun}`}
          </button>
        </div>
      </div>
    </form>
  );
}
