"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { api, errorMessage, useApi } from "@/lib/api-client";
import type { ItemTypeDTO } from "@/lib/types";
import { Field } from "@/components/ui/Field";
import { InlineLoading } from "@/components/ui/Spinner";
import { buttonClass, inputClass } from "@/components/ui/styles";

const ADD_NEW = "__add__";
const byName = (a: ItemTypeDTO, b: ItemTypeDTO) => a.name.localeCompare(b.name);

// "Type of goods" dropdown fed by the user's own list (/api/item-types), with
// an inline "+ Add new type" so nobody has to leave the item form.
// Submits as `typeId` with the surrounding <form>.
export function TypeSelect({ defaultTypeId = "" }: { defaultTypeId?: string }) {
  const { data, error: loadError, loading } = useApi<ItemTypeDTO[]>("/api/item-types");
  const [added, setAdded] = useState<ItemTypeDTO[]>([]); // created here, before any reload
  const [typeId, setTypeId] = useState(defaultTypeId);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const types = [...(data ?? []), ...added.filter((a) => !data?.some((t) => t.id === a.id))].sort(byName);
  // A brand-new user has no types yet: go straight to "add".
  const showAdd = adding || (!loading && data !== null && types.length === 0);

  async function addType() {
    const name = newName.trim();
    if (!name) return setError("Type a name first");
    setError("");

    // Already have it (any capitalisation)? Just pick it.
    const existing = types.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) return finish(existing);

    setSaving(true);
    try {
      const created = await api<ItemTypeDTO>("/api/item-types", { method: "POST", body: { name } });
      setAdded((list) => [...list, created]);
      finish(created);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function finish(type: ItemTypeDTO) {
    setTypeId(type.id);
    setNewName("");
    setAdding(false);
  }

  if (loading && !data) {
    return (
      <div>
        <p className="block text-sm font-medium text-slate-700 mb-1">Type of goods</p>
        <InlineLoading label="Loading your types…" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Field label="Type of goods" hint={loadError || undefined}>
        {(id) => (
          <select
            id={id}
            name="typeId"
            value={typeId}
            onChange={(e) => (e.target.value === ADD_NEW ? setAdding(true) : setTypeId(e.target.value))}
            className={inputClass}
            required
          >
            <option value="">{types.length ? "Choose…" : "No types yet, add one below"}</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            <option value={ADD_NEW}>+ Add new type…</option>
          </select>
        )}
      </Field>

      {showAdd && (
        <div className="rounded-2xl border border-line bg-canvas/60 p-3 space-y-2">
          <Field
            label="New type name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            // Enter adds the type instead of submitting the whole item form.
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addType();
              }
            }}
            placeholder="e.g. Rice, Pulse, Oil"
            maxLength={60}
            autoFocus={adding}
          />
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={addType} disabled={saving} className={buttonClass.primary}>
              <Plus className="w-4 h-4" aria-hidden="true" /> {saving ? "Adding…" : "Add type"}
            </button>
            {types.length > 0 && (
              <button type="button" onClick={() => setAdding(false)} className={buttonClass.secondary}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
