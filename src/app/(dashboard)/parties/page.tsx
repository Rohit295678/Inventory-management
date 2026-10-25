"use client";
import { useState } from "react";
import Link from "next/link";
import { Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { api, errorMessage, useApi } from "@/lib/api-client";
import { PARTY_KIND_LABELS, TX_COPY, type PartyKind } from "@/lib/domain";
import type { PartyDTO } from "@/lib/types";
import { PartyForm } from "@/components/parties/PartyForm";
import { Alert, EmptyState, PageHeader } from "@/components/ui/PageHeader";
import { buttonClass, cardClass } from "@/components/ui/styles";

const TABS: { kind: PartyKind | "ALL"; label: string }[] = [
  { kind: "ALL", label: "Everyone" },
  { kind: "SUPPLIER", label: "I buy from" },
  { kind: "CUSTOMER", label: "I sell to" },
];

type Editing = { mode: "closed" } | { mode: "new" } | { mode: "edit"; party: PartyDTO };

export default function PartiesPage() {
  const [tab, setTab] = useState<PartyKind | "ALL">("ALL");
  const { data: parties, error, loading, reload } = useApi<PartyDTO[]>(
    tab === "ALL" ? "/api/parties" : `/api/parties?kind=${tab}`
  );
  const [editing, setEditing] = useState<Editing>({ mode: "closed" });
  const [actionError, setActionError] = useState("");

  async function remove(party: PartyDTO) {
    if (!confirm(`Delete "${party.name}"?`)) return;
    try {
      await api(`/api/parties?id=${party.id}`, { method: "DELETE" });
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
        title="People"
        subtitle="Suppliers you buy from and customers you sell to"
        actions={
          editing.mode === "closed" && (
            <button onClick={() => setEditing({ mode: "new" })} className={buttonClass.primary}>
              <Plus className="w-4 h-4" aria-hidden="true" /> New person
            </button>
          )
        }
      />
      <Alert message={error || actionError} />

      {editing.mode !== "closed" && (
        <PartyForm
          key={editing.mode === "edit" ? editing.party.id : "new"}
          party={editing.mode === "edit" ? editing.party : undefined}
          defaultKind={tab === "ALL" ? undefined : tab}
          onSaved={closeAndReload}
          onCancel={() => setEditing({ mode: "closed" })}
        />
      )}

      <div role="tablist" aria-label="Filter people" className="flex gap-2 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.kind}
            role="tab"
            aria-selected={tab === t.kind}
            onClick={() => setTab(t.kind)}
            className={`min-h-11 px-4 rounded-full text-sm font-medium whitespace-nowrap border ${
              tab === t.kind ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-gray-800 border-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && !parties ? (
        <EmptyState>Loading…</EmptyState>
      ) : !parties?.length ? (
        <EmptyState>No one here yet. Add the people you trade with.</EmptyState>
      ) : (
        <ul className={`${cardClass} divide-y divide-gray-100`}>
          {parties.map((p) => (
            <li key={p.id} className="p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-600">{PARTY_KIND_LABELS[p.kind]}</p>
                  {p.phone && (
                    <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1 text-sm text-emerald-800 underline mt-1">
                      <Phone className="w-3.5 h-3.5" aria-hidden="true" /> {p.phone}
                    </a>
                  )}
                  {p.address && <p className="text-xs text-gray-600 mt-1">{p.address}</p>}
                </div>
                <button
                  onClick={() => setEditing({ mode: "edit", party: p })}
                  className="p-2.5 rounded-xl text-gray-700 hover:bg-gray-100"
                  aria-label={`Edit ${p.name}`}
                >
                  <Pencil className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  onClick={() => remove(p)}
                  className="p-2.5 rounded-xl text-red-700 hover:bg-red-50"
                  aria-label={`Delete ${p.name}`}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {p.kind !== "CUSTOMER" && (
                  <Link href={`${TX_COPY.PURCHASE.href}?partyId=${p.id}`} className={buttonClass.secondary}>
                    Bought from {p.name.split(" ")[0]}
                  </Link>
                )}
                {p.kind !== "SUPPLIER" && (
                  <Link href={`${TX_COPY.SALE.href}?partyId=${p.id}`} className={buttonClass.secondary}>
                    Sold to {p.name.split(" ")[0]}
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
