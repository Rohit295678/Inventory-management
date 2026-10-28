"use client";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { api, errorMessage, useApi } from "@/lib/api-client";
import { formatKg, formatMoney, formatQty } from "@/lib/format";
import { round2, round3 } from "@/lib/pricing";
import type { ItemDTO } from "@/lib/types";
import { ItemForm } from "@/components/items/ItemForm";
import { ItemRow } from "@/components/items/ItemRow";
import { stockRows } from "@/lib/lots";
import { Alert, EmptyState, PageHeader } from "@/components/ui/PageHeader";
import { Loading } from "@/components/ui/Spinner";
import { StatTiles, type Stat } from "@/components/ui/StatTiles";
import { buttonClass, cardClass } from "@/components/ui/styles";

type Editing = { mode: "closed" } | { mode: "new" } | { mode: "edit"; item: ItemDTO };

// Counted goods bought, per unit: packets aren't added to bags. kg items are
// left out here; they're in "Weight bought". -> "Packets bought: 30 packets"
function countedTile(items: ItemDTO[]): Stat {
  const byUnit = new Map<string, number>();
  for (const i of items) if (i.unit !== "kg") byUnit.set(i.unit, (byUnit.get(i.unit) ?? 0) + i.bought.quantity);

  const units = [...byUnit.keys()];
  const label = units.length > 1 ? "Quantity bought" : `${units[0] ?? "packet"}s bought`;
  const value = units.length ? units.map((u) => formatQty(round2(byUnit.get(u)!), u)).join(" · ") : formatQty(0, "packet");
  return { label: label[0].toUpperCase() + label.slice(1), value };
}

function totalTiles(items: ItemDTO[]): Stat[] {
  const sum = (pick: (i: ItemDTO) => number) => items.reduce((acc, i) => acc + pick(i), 0);
  return [
    { label: "Total bought", value: formatMoney(round2(sum((i) => i.bought.totalCost))) },
    countedTile(items),
    { label: "Weight bought", value: formatKg(round3(sum((i) => i.bought.weightKg))) },
    { label: "Items", value: String(items.length) },
  ];
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

  const totals = useMemo(() => totalTiles(items ?? []), [items]);

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
                {list.flatMap((item) =>
                  stockRows(item).map((row) => (
                    <ItemRow
                      key={row.key}
                      item={item}
                      row={row}
                      onEdit={() => setEditing({ mode: "edit", item })}
                      onDelete={() => remove(item)}
                    />
                  ))
                )}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
