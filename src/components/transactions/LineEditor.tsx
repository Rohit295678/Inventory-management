"use client";
import { Trash2 } from "lucide-react";
import { formatKg, formatLineQty, formatMoney, formatQty } from "@/lib/format";
import { priceLine, PricingError, round3, type PricedLine } from "@/lib/pricing";
import type { ItemDTO } from "@/lib/types";
import { Field } from "@/components/ui/Field";
import { iconButtonClass, inputClass } from "@/components/ui/styles";

export type LineDraft = {
  key: number;
  itemId: string;
  lotRatePerKg: string; // sales: purchase price of the lot sold from
  quantity: string;
  weightPerUnitKg: string;
  ratePerKg: string;
};

const num = (s: string) => (s.trim() === "" ? null : Number(s));

// Turn a draft into the API payload line.
export function toPayload(line: LineDraft) {
  return {
    itemId: line.itemId,
    lotRatePerKg: num(line.lotRatePerKg),
    quantity: num(line.quantity) ?? 0,
    weightPerUnitKg: num(line.weightPerUnitKg),
    ratePerKg: num(line.ratePerKg),
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

// Sale dropdown values are "itemId@lotRate".
const lotValue = (line: LineDraft) => (line.itemId ? `${line.itemId}@${line.lotRatePerKg}` : "");

// Picking a lot also fills in its kg per packet (still editable).
function pickSaleLot(items: ItemDTO[], value: string): Partial<LineDraft> {
  const [itemId = "", rate = ""] = value.split("@");
  const item = items.find((i) => i.id === itemId);
  const lot = item?.lots.find((l) => String(l.ratePerKg) === rate);
  const perUnit = lot && item!.unit !== "kg" && lot.bought.quantity > 0 ? round3(lot.bought.weightKg / lot.bought.quantity) : null;
  return { itemId, lotRatePerKg: rate, ...(perUnit && { weightPerUnitKg: String(perUnit) }) };
}

// Sales choose a price lot ("miniket-40rs/kg · 20 packets left"); items with
// nothing in stock are listed but can't be picked.
function SaleOptions({ items }: { items: ItemDTO[] }) {
  return items.map((item) =>
    item.lots.length ? (
      item.lots.map((lot) => (
        <option key={`${item.id}@${lot.ratePerKg}`} value={`${item.id}@${lot.ratePerKg}`}>
          {lot.label} ({item.type.name}) · {formatQty(lot.stock.quantity, item.unit)} left
        </option>
      ))
    ) : (
      <option key={item.id} value={`${item.id}@`} disabled>
        {item.name} ({item.type.name}) · out of stock
      </option>
    )
  );
}

type Props = {
  index: number;
  line: LineDraft;
  items: ItemDTO[];
  sale: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<LineDraft>) => void;
  onRemove: () => void;
};

export function LineEditor({ index, line, items, sale, canRemove, onChange, onRemove }: Props) {
  const item = items.find((i) => i.id === line.itemId);
  const priced = previewLine(line, item);
  const byWeight = !item || item.unit === "kg";

  return (
    <fieldset className="relative rounded-2xl border border-line p-3 sm:p-4 pt-1 bg-canvas/60">
      <legend className="px-1 text-sm font-semibold text-brand-900">Item {index + 1}</legend>
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          className={`${iconButtonClass.danger} absolute top-1 right-1`}
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
              value={sale ? lotValue(line) : line.itemId}
              onChange={(e) => onChange(sale ? pickSaleLot(items, e.target.value) : { itemId: e.target.value })}
              className={inputClass}
              required
            >
              <option value="">Choose…</option>
              {sale ? (
                <SaleOptions items={items} />
              ) : (
                items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.type.name})
                  </option>
                ))
              )}
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
            label={`Weight per ${item.unit} (kg)`}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            placeholder="e.g. 25"
            value={line.weightPerUnitKg}
            onChange={(e) => onChange({ weightPerUnitKg: e.target.value })}
            required
          />
        )}
      </div>

      <div className="grid gap-3 grid-cols-2 mt-3 items-end">
        <Field
          label="Price per kg (₹)"
          className="col-span-2 sm:col-span-1"
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={line.ratePerKg}
          onChange={(e) => onChange({ ratePerKg: e.target.value })}
          required
        />
        <div className="col-span-2 sm:col-span-1 text-sm text-slate-700 sm:min-h-11 flex flex-col justify-center" aria-live="polite">
          {priced ? (
            <>
              <p>
                {formatLineQty(priced)} × {formatMoney(priced.ratePerKg)}/kg ={" "}
                <span className="font-semibold text-slate-900">{formatMoney(priced.totalCost)}</span>
              </p>
              {!byWeight && <p className="text-xs text-slate-600">Total weight: {formatKg(priced.weightKg)}</p>}
            </>
          ) : (
            <p>Fill quantity, weight and price to see the total</p>
          )}
        </div>
      </div>
    </fieldset>
  );
}
