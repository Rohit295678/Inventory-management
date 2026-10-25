"use client";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { api, errorMessage, useApi } from "@/lib/api-client";
import { formatKg, formatQty } from "@/lib/format";
import type { ItemDTO } from "@/lib/types";
import { ItemForm } from "@/components/items/ItemForm";
import { Alert, EmptyState, PageHeader } from "@/components/ui/PageHeader";
import { buttonClass, cardClass } from "@/components/ui/styles";

type Editing = { mode: "closed" } | { mode: "new" } | { mode: "edit"; item: ItemDTO };

export default function ItemsPage() {
  const { data: items, error, loading, reload } = useApi<ItemDTO[]>("/api/items");
  const [editing, setEditing] = useState<Editing>({ mode: "closed" });
  const [actionError, setActionError] = useState("");

  const byCategory = useMemo(() => {
    const groups = new Map<string, ItemDTO[]>();
    for (const item of items ?? []) groups.set(item.category, [...(groups.get(item.category) ?? []), item]);
    return [...groups.entries()];
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
        subtitle="Everything you deal in, and how much you have right now"
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
          categories={byCategory.map(([c]) => c)}
          onSaved={closeAndReload}
          onCancel={() => setEditing({ mode: "closed" })}
        />
      )}

      {loading && !items ? (
        <EmptyState>Loading…</EmptyState>
      ) : byCategory.length === 0 ? (
        <EmptyState>No items yet. Add the goods you buy and sell to get started.</EmptyState>
      ) : (
        <div className="space-y-5">
          {byCategory.map(([category, list]) => (
            <section key={category} aria-labelledby={`cat-${category}`}>
              <h2 id={`cat-${category}`} className="text-sm font-semibold uppercase tracking-wide text-gray-600 mb-2">
                {category}
              </h2>
              <ul className={`${cardClass} divide-y divide-gray-100`}>
                {list.map((item) => {
                  const low = item.stock.weightKg <= 0;
                  return (
                    <li key={item.id} className="flex items-center gap-3 p-3 sm:p-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{item.name}</p>
                        {item.details && <p className="text-xs text-gray-600 truncate">{item.details}</p>}
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${low ? "text-red-700" : "text-emerald-800"}`}>
                          {formatKg(item.stock.weightKg)}
                        </p>
                        {item.unit !== "kg" && (
                          <p className="text-xs text-gray-600">{formatQty(item.stock.quantity, item.unit)}</p>
                        )}
                        <span className="sr-only">in stock{low ? " (out of stock)" : ""}</span>
                      </div>
                      <button
                        onClick={() => setEditing({ mode: "edit", item })}
                        className="p-2.5 rounded-xl text-gray-700 hover:bg-gray-100"
                        aria-label={`Edit ${item.name}`}
                      >
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => remove(item)}
                        className="p-2.5 rounded-xl text-red-700 hover:bg-red-50"
                        aria-label={`Delete ${item.name}`}
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
