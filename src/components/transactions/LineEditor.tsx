"use client";
import { Trash2 } from "lucide-react";
import { formatKg, formatMoney } from "@/lib/format";
import { priceLine, PricingError, type PricedLine } from "@/lib/pricing";
import type { ItemDTO } from "@/lib/types";
import { Field } from "@/components/ui/Field";
import { chipClass, inputClass } from "@/components/ui/styles";

export type PriceMode = "rate" | "total";

export type LineDraft = {
  key: number;
  itemId: string;
  quantity: string;
  weightKg: string;
  priceMode: PriceMode;
  price: string;
};

const num = (s: string) => (s.trim() === "" ? null : Number(s));

// Turn a draft into the API payload line.
export function toPayload(line: LineDraft) {
  return {
    itemId: line.itemId,
    quantity: num(line.quantity) ?? 0,
    weightKg: num(line.weightKg),
    ratePerKg: line.priceMode === "rate" ? num(line.price) : null,
    totalCost: line.priceMode === "total" ? num(line.price) : null,
  };
}

// Same maths as the server, for a live preview. null = not priceable yet.
export function previewLine(line: LineDraft, item: ItemDTO | undefined): PricedLine | null {
  if (!item) return null;
  try {
    return priceLine({ ...toPayload(line), unit: item.unit });
  } catch (err) {
    if (err instanceof PricingError) return null;
    throw err;
  }
}

type Props = {
  index: number;
  line: LineDraft;
  items: ItemDTO[];
  canRemove: boolean;
  onChange: (patch: Partial<LineDraft>) => void;
  onRemove: () => void;
};

export function LineEditor({ index, line, items, canRemove, onChange, onRemove }: Props) {
  const item = items.find((i) => i.id === line.itemId);
  const priced = previewLine(line, item);
  const byWeight = !item || item.unit === "kg";

  return (
    <fieldset className="relative rounded-xl border border-brand-100 p-3 sm:p-4 pt-1 bg-brand-50/50">
      <legend className="px-1 text-sm font-semibold text-brand-900">Item {index + 1}</legend>
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 right-1 p-2.5 rounded-xl text-red-700 hover:bg-red-50"
          aria-label={`Remove item ${index + 1}`}
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      )}

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 mt-2">
        <Field label="Item" className="col-span-2">
          {(id) => (
            <select
              id={id}
              value={line.itemId}
              onChange={(e) => onChange({ itemId: e.target.value })}
              className={inputClass}
              required
            >
              <option value="">Choose…</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.category})
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field
          label={`Quantity${item ? ` (${item.unit})` : ""}`}
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={line.quantity}
          onChange={(e) => onChange({ quantity: e.target.value })}
          required
        />
        {!byWeight && (
          <Field
            label="Total weight (kg)"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={line.weightKg}
            onChange={(e) => onChange({ weightKg: e.target.value })}
            required
          />
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 mt-3 items-end">
        <div role="radiogroup" aria-label={`Price type for item ${index + 1}`} className="col-span-2 flex gap-2">
          {(["rate", "total"] as const).map((mode) => (
            <label
              key={mode}
              className={`${chipClass(line.priceMode === mode)} flex-1 flex items-center justify-center cursor-pointer has-focus-visible:outline-3 has-focus-visible:outline-brand-600 has-focus-visible:outline-offset-2`}
            >
              <input
                type="radio"
                className="sr-only"
                name={`price-mode-${line.key}`}
                checked={line.priceMode === mode}
                onChange={() => onChange({ priceMode: mode })}
              />
              {mode === "rate" ? "Price per kg" : "Total cost"}
            </label>
          ))}
        </div>
        <Field
          label={line.priceMode === "rate" ? "Price per kg (₹)" : "Total cost (₹)"}
          className="col-span-2 sm:col-span-1"
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={line.price}
          onChange={(e) => onChange({ price: e.target.value })}
          required
        />
        <p className="col-span-2 sm:col-span-1 text-sm text-slate-700 sm:min-h-11 flex items-center" aria-live="polite">
          {priced
            ? `${formatKg(priced.weightKg)} × ${formatMoney(priced.ratePerKg)}/kg = ${formatMoney(priced.totalCost)}`
            : "Fill quantity and price to see the total"}
        </p>
      </div>
    </fieldset>
  );
}
