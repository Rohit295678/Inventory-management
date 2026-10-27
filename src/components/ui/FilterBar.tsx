"use client";
import type { PartyDTO } from "@/lib/types";
import { quickRanges, type Range } from "@/lib/date-filters";
import { Field } from "@/components/ui/Field";
import { chipClass, inputClass } from "@/components/ui/styles";

type Props = {
  range: Range;
  onRange: (range: Range) => void;
  partyLabel: string; // "Customer" | "Supplier"
  parties: PartyDTO[] | null;
  partyId: string;
  onParty: (partyId: string) => void;
};

// Quick date chips + from/to + person. Used by Sales, Purchases and both
// payment tabs so they filter the same way.
export function FilterBar({ range, onRange, partyLabel, parties, partyId, onParty }: Props) {
  return (
    <section aria-label="Filters" className="mb-4 space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {quickRanges().map(({ label, range: r }) => {
          const active = r.from === range.from && r.to === range.to;
          return (
            <button key={label} onClick={() => onRange(r)} aria-pressed={active} className={chipClass(active)}>
              {label}
            </button>
          );
        })}
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <Field label="From" type="date" value={range.from} max={range.to || undefined} onChange={(e) => onRange({ ...range, from: e.target.value })} />
        <Field label="To" type="date" value={range.to} min={range.from || undefined} onChange={(e) => onRange({ ...range, to: e.target.value })} />
        <Field label={partyLabel} className="col-span-2 sm:col-span-1">
          {(id) => (
            <select id={id} value={partyId} onChange={(e) => onParty(e.target.value)} className={inputClass}>
              <option value="">Everyone</option>
              {parties?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
    </section>
  );
}
