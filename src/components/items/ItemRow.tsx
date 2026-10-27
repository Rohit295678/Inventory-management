import { Pencil, Trash2 } from "lucide-react";
import { formatKg, formatMoney, formatQty, formatQtyAndKg } from "@/lib/format";
import type { ItemDTO, SupplierBought } from "@/lib/types";
import { iconButtonClass } from "@/components/ui/styles";

// "Rs 40.00/kg", or "Rs 38.00-42.00/kg" when a supplier's price changed between bills.
function supplierRate(s: SupplierBought): string {
  return s.minRatePerKg === s.maxRatePerKg
    ? `${formatMoney(s.avgRatePerKg)}/kg`
    : `${formatMoney(s.minRatePerKg)}\u2013${formatMoney(s.maxRatePerKg)}/kg, avg ${formatMoney(s.avgRatePerKg)}`;
}

function SupplierList({ item }: { item: ItemDTO }) {
  const { suppliers } = item;
  if (suppliers.length === 1) {
    const [only] = suppliers;
    return (
      <p className="mt-1 text-xs text-slate-700">
        From <span className="font-medium text-slate-900">{only.partyName}</span>
        {only.minRatePerKg !== only.maxRatePerKg && ` \u00b7 ${supplierRate(only)}`}
      </p>
    );
  }
  return (
    <div className="mt-2 pt-2 border-t border-brand-100">
      <p className="text-xs font-semibold text-slate-700 mb-1">By supplier</p>
      <ul className="space-y-1 text-xs text-slate-700">
        {suppliers.map((s) => (
          <li key={s.partyId} className="flex flex-wrap justify-between gap-x-3">
            <span>
              <span className="font-medium text-slate-900">{s.partyName}</span> · {formatQtyAndKg(s, item.unit)}
            </span>
            <span className="whitespace-nowrap">
              {supplierRate(s)} · <span className="font-semibold text-slate-900">{formatMoney(s.totalCost)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// One item: stock on the right (count first, kg second), and a highlighted
// box with what was paid to suppliers, broken down per supplier.
export function ItemRow({ item, onEdit, onDelete }: { item: ItemDTO; onEdit: () => void; onDelete: () => void }) {
  const out = item.stock.weightKg <= 0;
  const byKg = item.unit === "kg";
  const { bought } = item;

  return (
    <li className="p-3 sm:p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900">{item.name}</p>
          {item.details && <p className="text-xs text-slate-600 truncate">{item.details}</p>}
        </div>
        <div className="text-right">
          <p className={`font-semibold ${out ? "text-red-700" : "text-brand-800"}`}>
            {formatQty(byKg ? item.stock.weightKg : item.stock.quantity, item.unit)}
          </p>
          {!byKg && <p className="text-xs text-slate-600">{formatKg(item.stock.weightKg)}</p>}
          <span className="sr-only">in stock{out ? " (out of stock)" : ""}</span>
        </div>
        <button onClick={onEdit} className={iconButtonClass.edit} aria-label={`Edit ${item.name}`}>
          <Pencil className="w-4 h-4" aria-hidden="true" />
        </button>
        <button onClick={onDelete} className={iconButtonClass.danger} aria-label={`Delete ${item.name}`}>
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {bought.weightKg > 0 ? (
        <div className="mt-2 rounded-2xl bg-brand-50 border border-brand-100 px-4 py-2.5">
          {/* Each label stays glued to its number when the line wraps on phones. */}
          <p className="text-sm text-slate-800">
            <span className="whitespace-nowrap">
              Bought <span className="font-bold text-slate-900">{formatQtyAndKg(bought, item.unit)}</span>
            </span>{" "}
            ·{" "}
            <span className="whitespace-nowrap">
              avg <span className="font-bold text-slate-900">{formatMoney(bought.avgRatePerKg)}/kg</span>
            </span>{" "}
            ·{" "}
            <span className="whitespace-nowrap">
              total <span className="font-bold text-brand-800">{formatMoney(bought.totalCost)}</span>
            </span>
          </p>
          <SupplierList item={item} />
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-slate-600">Not bought yet</p>
      )}
    </li>
  );
}
