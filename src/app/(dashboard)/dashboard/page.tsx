"use client";
import Link from "next/link";
import { ShoppingCart, Truck } from "lucide-react";
import { useApi } from "@/lib/api-client";
import { TX_COPY, todayISO, type TxType } from "@/lib/domain";
import { formatDate, formatKg, formatMoney, formatQty, plural } from "@/lib/format";
import type { ItemDTO, TransactionsResponse } from "@/lib/types";
import { Alert, PageHeader } from "@/components/ui/PageHeader";
import { buttonClass, cardClass } from "@/components/ui/styles";

// Buy and sell get distinct badge colours so they're told apart at a glance.
const CARD_STYLE: Record<TxType, { icon: typeof Truck; heading: string; badge: string }> = {
  PURCHASE: { icon: Truck, heading: "Bought today", badge: "bg-brand-100 text-brand-800" },
  SALE: { icon: ShoppingCart, heading: "Sold today", badge: "bg-accent-100 text-brand-950" },
};

function TodayCard({ type, today }: { type: TxType; today: string }) {
  const copy = TX_COPY[type];
  const { data, error } = useApi<TransactionsResponse>(`/api/transactions?type=${type}&from=${today}&to=${today}`);
  const { icon: Icon, heading, badge } = CARD_STYLE[type];

  return (
    <section className={`${cardClass} p-4`} aria-labelledby={`today-${type}`}>
      <div className="flex items-center gap-3">
        <span className={`inline-flex w-10 h-10 items-center justify-center rounded-xl ${badge}`} aria-hidden="true">
          <Icon className="w-5 h-5" />
        </span>
        <h2 id={`today-${type}`} className="font-semibold text-slate-800">
          {heading}
        </h2>
      </div>
      <Alert message={error} />
      <p className="text-3xl font-bold text-slate-900 mt-3">{data ? formatMoney(data.summary.totalAmount) : "…"}</p>
      <p className="text-sm text-slate-600">
        {data ? `${plural(data.summary.bills, "bill")} · ${formatKg(data.summary.totalWeightKg)}` : " "}
      </p>
      {data && data.summary.byItem.length > 0 && (
        <ul className="mt-3 text-sm divide-y divide-slate-100">
          {data.summary.byItem.map((i) => (
            <li key={`${i.itemId}:${i.unit}`} className="flex justify-between py-1.5">
              <span>
                {i.itemName} <span className="text-slate-600">· {formatQty(i.quantity, i.unit)}</span>
              </span>
              <span className="font-medium">{formatMoney(i.totalCost)}</span>
            </li>
          ))}
        </ul>
      )}
      <Link href={copy.href} className={`${buttonClass.secondary} w-full mt-4`}>
        Open {copy.title.toLowerCase()}
      </Link>
    </section>
  );
}

export default function DashboardPage() {
  const today = todayISO();
  const { data: items } = useApi<ItemDTO[]>("/api/items");
  const outOfStock = items?.filter((i) => i.stock.weightKg <= 0) ?? [];

  return (
    <>
      <PageHeader title="Today" subtitle={formatDate(today)} />

      <div className="grid gap-4 sm:grid-cols-2 mb-5">
        <TodayCard type="PURCHASE" today={today} />
        <TodayCard type="SALE" today={today} />
      </div>

      {outOfStock.length > 0 && (
        <section className={`${cardClass} p-4 border-red-200`} aria-labelledby="out-of-stock">
          <h2 id="out-of-stock" className="font-semibold text-red-800 mb-2">
            Out of stock ({outOfStock.length})
          </h2>
          <ul className="flex flex-wrap gap-2">
            {outOfStock.map((i) => (
              <li key={i.id} className="px-3 py-1 rounded-full bg-red-50 text-red-800 text-sm">
                {i.name}
              </li>
            ))}
          </ul>
          <Link href="/items" className="inline-block mt-3 text-sm text-brand-800 underline font-semibold">
            View all stock
          </Link>
        </section>
      )}
    </>
  );
}
