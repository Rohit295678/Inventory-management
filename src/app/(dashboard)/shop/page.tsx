"use client";
import { useState } from "react";
import { api, errorMessage, useApi } from "@/lib/api-client";
import type { ShopDTO } from "@/lib/types";
import { Field } from "@/components/ui/Field";
import { Alert, PageHeader } from "@/components/ui/PageHeader";
import { Loading } from "@/components/ui/Spinner";
import { buttonClass, cardClass, inputClass } from "@/components/ui/styles";

// Shop name, address and phone: printed at the top of every invoice PDF.
export default function ShopPage() {
  const shop = useApi<ShopDTO>("/api/shop");
  return (
    <>
      <PageHeader title="Shop details" subtitle="Printed at the top of every invoice PDF" />
      <Alert message={shop.error} />
      {shop.data ? <ShopForm initial={shop.data} /> : !shop.error && <Loading label="Loading shop details…" />}
    </>
  );
}

// Mounted once the saved details are loaded, so it starts filled in.
function ShopForm({ initial }: { initial: ShopDTO }) {
  const [form, setForm] = useState({ name: initial.name ?? "", address: initial.address ?? "", phone: initial.phone ?? "" });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const edit = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setSaved(false);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/api/shop", { method: "PUT", body: form });
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} p-4 sm:p-5 space-y-4 max-w-xl`} aria-label="Shop details">
      <Alert message={error} />
      <Field label="Shop / company name" value={form.name} onChange={edit("name")} placeholder="e.g. Rohit Kirana Store" maxLength={100} />
      <Field label="Address">
        {(id) => (
          <textarea
            id={id}
            value={form.address}
            onChange={edit("address")}
            rows={3}
            maxLength={300}
            placeholder="Shop no., street, city, PIN"
            className={`${inputClass} rounded-2xl`}
          />
        )}
      </Field>
      <Field label="Phone" type="tel" inputMode="tel" value={form.phone} onChange={edit("phone")} maxLength={30} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className={buttonClass.primary}>
          {saving ? "Saving…" : "Save"}
        </button>
        <p className="text-sm font-medium text-green-700" aria-live="polite">
          {saved && "Saved. New invoices will show these details."}
        </p>
      </div>
    </form>
  );
}
