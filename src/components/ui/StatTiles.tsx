import { cardClass } from "@/components/ui/styles";

export type Stat = { label: string; value: string };

// Row of headline numbers ("Total amount", "Bills", ...), used on the
// purchases/sales summary and on Items & stock. 4 tiles = 2x2 on phones.
const COLUMNS: Record<number, string> = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" };

export function StatTiles({ stats }: { stats: Stat[] }) {
  const columns = COLUMNS[stats.length] ?? "grid-cols-2 sm:grid-cols-3";
  return (
    <dl className={`grid ${columns} gap-2`}>
      {stats.map((s) => (
        <div key={s.label} className={`${cardClass} px-4 py-3`}>
          <dt className="text-xs text-slate-600">{s.label}</dt>
          <dd className="mt-0.5 text-lg sm:text-2xl font-medium text-brand-800 break-words">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}
