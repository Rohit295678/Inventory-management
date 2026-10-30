import { Phone, MapPin } from "lucide-react";
import { PAYMENT_COPY } from "@/lib/domain";
import { formatDate, formatKg, formatLineQty, formatMoney } from "@/lib/format";
import { round3 } from "@/lib/pricing";
import type { BillDetailDTO, Letterhead } from "@/lib/types";
import { cardClass } from "@/components/ui/styles";

// The body of the bill page / pop-up: who, what, and the money trail.

const sectionTitle = "text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2";

function Contact({ label, name, phone, address }: { label: string } & Letterhead) {
  return (
    <section className={`${cardClass} p-4`} aria-label={label}>
      <h3 className={sectionTitle}>{label}</h3>
      <p className="text-lg font-semibold text-slate-900">{name}</p>
      {phone && (
        <p className="mt-1 flex items-center gap-2 text-sm text-slate-700">
          <Phone className="w-4 h-4 text-brand-700 shrink-0" aria-hidden="true" />
          <a href={`tel:${phone.replace(/\s+/g, "")}`} className="underline-offset-2 hover:underline">
            {phone}
          </a>
        </p>
      )}
      {address && (
        <p className="mt-1 flex items-start gap-2 text-sm text-slate-700">
          <MapPin className="w-4 h-4 mt-0.5 text-brand-700 shrink-0" aria-hidden="true" />
          {address}
        </p>
      )}
      {!phone && !address && <p className="mt-1 text-sm text-slate-500">No phone or address saved</p>}
    </section>
  );
}

export function BillParties({ detail }: { detail: BillDetailDTO }) {
  const sale = detail.bill.type === "SALE";
  const { name, phone, address } = detail.party;
  const shop = <Contact key="shop" label="From (your shop)" {...detail.shop} />;
  const party = <Contact key="party" label={sale ? "Bill to" : "Bill from"} name={name} phone={phone} address={address} />;
  // Invoices read seller -> buyer: on a purchase the supplier is the seller.
  return <div className="grid gap-3 sm:grid-cols-2">{sale ? [shop, party] : [party, shop]}</div>;
}

export function BillItems({ detail }: { detail: BillDetailDTO }) {
  const { bill } = detail;
  const weight = round3(bill.lines.reduce((sum, l) => sum + l.weightKg, 0));
  return (
    <section className={`${cardClass} p-4`} aria-label="Items">
      <h3 className={sectionTitle}>Items ({bill.lines.length})</h3>
      <ul className="divide-y divide-line">
        {bill.lines.map((l, i) => (
          <li key={l.id} className="flex items-start gap-3 py-3">
            <span className="mt-0.5 grid place-items-center w-7 h-7 shrink-0 rounded-full bg-brand-50 text-xs font-semibold text-brand-800">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900">
                {l.itemName} <span className="ml-1 rounded-full bg-lilac-100 px-2 py-0.5 text-xs font-medium text-brand-900">{l.itemType}</span>
              </p>
              <p className="text-sm text-slate-700 mt-0.5">
                {formatLineQty(l)}
                {l.unit !== "kg" && ` (${formatKg(l.weightKg)})`} @ {formatMoney(l.ratePerKg)}/kg
              </p>
              {l.lotRatePerKg !== null && (
                <p className="text-xs text-slate-600 mt-0.5">From stock bought @ {formatMoney(l.lotRatePerKg)}/kg</p>
              )}
            </div>
            <p className="font-semibold text-slate-900 whitespace-nowrap">{formatMoney(l.totalCost)}</p>
          </li>
        ))}
      </ul>
      <dl className="mt-1 pt-3 border-t border-line flex flex-wrap justify-between gap-2 text-sm">
        <div className="flex gap-2">
          <dt className="text-slate-600">Total weight</dt>
          <dd className="font-semibold text-slate-900">{formatKg(weight)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-600">Bill total</dt>
          <dd className="font-bold text-slate-900">{formatMoney(bill.totalAmount)}</dd>
        </div>
      </dl>
    </section>
  );
}

export function BillPaymentsTimeline({ detail }: { detail: BillDetailDTO }) {
  const { bill } = detail;
  const verb = PAYMENT_COPY[bill.type].verb;
  return (
    <section className={`${cardClass} p-4`} aria-label="Payments">
      <h3 className={sectionTitle}>Payments ({bill.payments.length})</h3>
      {bill.payments.length === 0 ? (
        <p className="text-sm text-slate-600">Nothing {verb.toLowerCase()} yet.</p>
      ) : (
        <ol className="relative ml-2 border-l-2 border-mint-100">
          {bill.payments.map((p) => (
            <li key={p.paymentId} className="relative pl-5 pb-4 last:pb-0">
              <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-green-700 ring-4 ring-white" aria-hidden="true" />
              <div className="flex flex-wrap justify-between gap-x-3">
                <p className="text-sm text-slate-800">
                  <span className="font-medium">{verb}</span> on {formatDate(p.date)}
                </p>
                <p className="font-semibold text-green-700">{formatMoney(p.amount)}</p>
              </div>
              {p.note && <p className="text-xs text-slate-600 mt-0.5">{p.note}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
