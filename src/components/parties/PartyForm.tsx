"use client";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { PARTY_KINDS, PARTY_KIND_LABELS, type PartyKind } from "@/lib/domain";
import type { PartyDTO } from "@/lib/types";
import { Field } from "@/components/ui/Field";
import { Alert } from "@/components/ui/PageHeader";
import { buttonClass, cardClass, inputClass } from "@/components/ui/styles";

type Props = {
  party?: PartyDTO; // present = edit mode
  defaultKind?: PartyKind;
  onSaved: (party: PartyDTO) => void;
  onCancel: () => void;
};

export function PartyForm({ party, defaultKind = "SUPPLIER", onSaved, onCancel }: Props) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = { name: form.get("name"), kind: form.get("kind"), phone: form.get("phone"), address: form.get("address") };
    setSaving(true);
    setError("");
    try {
      const saved = await api<PartyDTO>(party ? `/api/parties?id=${party.id}` : "/api/parties", {
        method: party ? "PATCH" : "POST",
        body,
      });
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} p-4 sm:p-5 mb-5`} aria-label={party ? "Edit person" : "New person"}>
      <h2 className="font-semibold text-slate-900 mb-3">{party ? `Edit ${party.name}` : "Add a person"}</h2>
      <Alert message={error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" name="name" defaultValue={party?.name} placeholder="e.g. Ramesh Traders" required />
        <Field label="Role">
          {(id) => (
            <select id={id} name="kind" defaultValue={party?.kind ?? defaultKind} className={inputClass}>
              {PARTY_KINDS.map((k) => (
                <option key={k} value={k}>
                  {PARTY_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Phone (optional)" name="phone" type="tel" inputMode="tel" defaultValue={party?.phone ?? ""} />
        <Field label="Address (optional)" name="address" defaultValue={party?.address ?? ""} />
      </div>
      <div className="flex gap-2 mt-4">
        <button type="submit" disabled={saving} className={buttonClass.primary}>
          {saving ? "Saving…" : party ? "Save changes" : "Add person"}
        </button>
        <button type="button" onClick={onCancel} className={buttonClass.secondary}>
          Cancel
        </button>
      </div>
    </form>
  );
}
