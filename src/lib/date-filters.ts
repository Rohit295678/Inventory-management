import { todayISO, type TxType } from "@/lib/domain";

// Date-range filtering shared by the bills and payments screens.
// Empty from/to = no limit on that side.
export type Range = { from: string; to: string };

export const ALL_TIME: Range = { from: "", to: "" };
export const todayRange = (): Range => ({ from: todayISO(), to: todayISO() });

export function quickRanges(now = new Date()): { label: string; range: Range }[] {
  const today = todayISO(now);
  const daysAgo = (n: number) => todayISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
  return [
    { label: "Today", range: { from: today, to: today } },
    { label: "Last 7 days", range: { from: daysAgo(6), to: today } },
    { label: "This month", range: { from: todayISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: today } },
    { label: "All", range: ALL_TIME },
  ];
}

// ?type=SALE&from=...&to=...&partyId=... with the empty ones left out.
export function filterQuery(type: TxType, range: Range, partyId: string): URLSearchParams {
  const query = new URLSearchParams({ type, ...range, partyId });
  for (const [key, value] of [...query]) if (!value) query.delete(key);
  return query;
}

// Keeps the API's order (newest first) within and across days.
export function groupByDate<T extends { date: string }>(list: ReadonlyArray<T>): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const entry of list) groups.set(entry.date, [...(groups.get(entry.date) ?? []), entry]);
  return [...groups.entries()];
}
