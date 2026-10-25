import { cardClass } from "@/components/ui/styles";

export type Stat = { label: string; value: string };

// Row of headline numbers ("Total amount", "Bills", ...), used on the
// purchases/sales summary and on Items & stock.
export function StatTiles({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-3 gap-2">
      {stats.map((s) => (
        <div key={s.label} className={`${cardClass} p-3`}>
          <dt className="text-xs text-slate-600">{s.label}</dt>
          <dd className="text-base sm:text-xl font-bold text-slate-900 break-words">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}
