"use client";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { UNITS } from "@/lib/pricing";
import type { ItemDTO } from "@/lib/types";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/PageHeader";
import { buttonClass, cardClass, inputClass } from "@/components/ui/styles";
import { TypeSelect } from "@/components/items/TypeSelect";

type Props = {
  item?: ItemDTO; // present = edit mode
  onSaved: () => void;
  onCancel: () => void;
};

export function ItemForm({ item, onSaved, onCancel }: Props) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name"),
      typeId: form.get("typeId"),
      unit: form.get("unit"),
      details: form.get("details"),
    };
    setSaving(true);
    setError("");
    try {
      await api(item ? `/api/items?id=${item.id}` : "/api/items", { method: item ? "PATCH" : "POST", body });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} p-4 sm:p-5 mb-5`} aria-label={item ? "Edit item" : "New item"}>
      <h2 className="font-semibold text-slate-900 mb-3">{item ? `Edit ${item.name}` : "Add a new item"}</h2>
      <Alert message={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Item name" name="name" defaultValue={item?.name} placeholder="e.g. Basmati Rice" required />
        <TypeSelect defaultTypeId={item?.type.id} />
        <Field label="Counted in" hint="How you count it on a bill. Price is always per kg.">
          {(id) => (
            <select id={id} name="unit" defaultValue={item?.unit ?? "packet"} className={inputClass}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Details (optional)" name="details" defaultValue={item?.details ?? ""} placeholder="Brand, grade, notes…" />
      </div>
      <div className="flex gap-2 mt-4">
        <button type="submit" disabled={saving} className={buttonClass.primary}>
          {saving ? "Saving…" : item ? "Save changes" : "Add item"}
        </button>
        <button type="button" onClick={onCancel} className={buttonClass.secondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}
