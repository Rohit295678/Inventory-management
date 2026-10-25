"use client";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, errorMessage, useApi } from "@/lib/api-client";
import { formatKg, formatMoney, formatQty } from "@/lib/format";
import { round2, round3 } from "@/lib/pricing";
import type { ItemDTO } from "@/lib/types";
import { ItemForm } from "@/components/items/ItemForm";
import { Alert, EmptyState, PageHeader } from "@/components/ui/PageHeader";
import { Loading } from "@/components/ui/Spinner";
import { StatTiles } from "@/components/ui/StatTiles";
import { buttonClass, cardClass } from "@/components/ui/styles";

type Editing = { mode: "closed" } | { mode: "new" } | { mode: "edit"; item: ItemDTO };

// Stock on the right, what was paid to suppliers underneath.
function ItemRow({ item, onEdit, onDelete }: { item: ItemDTO; onEdit: () => void; onDelete: () => void }) {
  const out = item.stock.weightKg <= 0;
  const { bought } = item;

  return (
    <li className="p-3 sm:p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900">{item.name}</p>
          {item.details && <p className="text-xs text-slate-600 truncate">{item.details}</p>}
        </div>
        <div className="text-right">
          <p className={`font-semibold ${out ? "text-red-700" : "text-brand-800"}`}>{formatKg(item.stock.weightKg)}</p>
          {item.unit !== "kg" && <p className="text-xs text-slate-600">{formatQty(item.stock.quantity, item.unit)}</p>}
          <span className="sr-only">in stock{out ? " (out of stock)" : ""}</span>
        </div>
        <button onClick={onEdit} className="p-2.5 rounded-xl text-slate-700 hover:bg-slate-100" aria-label={`Edit ${item.name}`}>
          <Pencil className="w-4 h-4" aria-hidden="true" />
        </button>
        <button onClick={onDelete} className="p-2.5 rounded-xl text-red-700 hover:bg-red-50" aria-label={`Delete ${item.name}`}>
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      <p className="mt-1.5 text-xs text-slate-700">
        {bought.weightKg > 0 ? (
          // Each label stays glued to its number when the line wraps on phones.
          <>
            <span className="whitespace-nowrap">
              Bought {formatKg(bought.weightKg)}
              {item.unit !== "kg" && ` (${formatQty(bought.quantity, item.unit)})`}
            </span>{" "}
            ·{" "}
            <span className="whitespace-nowrap">
              avg <span className="font-semibold text-slate-900">{formatMoney(bought.avgRatePerKg)}/kg</span>
            </span>{" "}
            ·{" "}
            <span className="whitespace-nowrap">
              total <span className="font-semibold text-slate-900">{formatMoney(bought.totalCost)}</span>
            </span>
          </>
        ) : (
          "Not bought yet"
        )}
      </p>
    </li>
  );
}

export default function ItemsPage() {
  const { data: items, error, loading, reload } = useApi<ItemDTO[]>("/api/items");
  const [editing, setEditing] = useState<Editing>({ mode: "closed" });
  const [actionError, setActionError] = useState("");

  const byType = useMemo(() => {
    const groups = new Map<string, ItemDTO[]>();
    for (const item of items ?? []) groups.set(item.type.name, [...(groups.get(item.type.name) ?? []), item]);
    return [...groups.entries()];
  }, [items]);

  const totals = useMemo(() => {
    const list = items ?? [];
    return [
      { label: "Total bought", value: formatMoney(round2(list.reduce((sum, i) => sum + i.bought.totalCost, 0))) },
      { label: "Weight bought", value: formatKg(round3(list.reduce((sum, i) => sum + i.bought.weightKg, 0))) },
      { label: "Items", value: String(list.length) },
    ];
  }, [items]);

  async function remove(item: ItemDTO) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await api(`/api/items?id=${item.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  }

  const closeAndReload = () => {
    setEditing({ mode: "closed" });
    reload();
  };

  return (
    <>
      <PageHeader
        title="Items & stock"
        subtitle="What you have now, and what you paid suppliers for it"
        actions={
          editing.mode === "closed" && (
            <button onClick={() => setEditing({ mode: "new" })} className={buttonClass.primary}>
              <Plus className="w-4 h-4" aria-hidden="true" /> New item
            </button>
          )
        }
      />
      <Alert message={error || actionError} />

      {editing.mode !== "closed" && (
        <ItemForm
          key={editing.mode === "edit" ? editing.item.id : "new"}
          item={editing.mode === "edit" ? editing.item : undefined}
          onSaved={closeAndReload}
          onCancel={() => setEditing({ mode: "closed" })}
        />
      )}

      {loading && !items ? (
        <Loading label="Loading items…" />
      ) : byType.length === 0 ? (
        <EmptyState>No items yet. Add the goods you buy and sell to get started.</EmptyState>
      ) : (
        <div className="space-y-5">
          <section aria-label="Purchase totals">
            <StatTiles stats={totals} />
          </section>
          {byType.map(([typeName, list]) => (
            <section key={typeName} aria-label={typeName}>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 mb-2">{typeName}</h2>
              <ul className={`${cardClass} divide-y divide-slate-100`}>
                {list.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onEdit={() => setEditing({ mode: "edit", item })}
                    onDelete={() => remove(item)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
