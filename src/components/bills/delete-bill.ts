"use client";
import { api } from "@/lib/api-client";
import { TX_COPY } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import type { TransactionDTO } from "@/lib/types";

// Confirm, then delete. Shared by the bill list, the bill page and the bill
// pop-up. Resolves false if the user said no; throws the server's message
// (e.g. "This bill has payments...") so callers can show it.
export async function deleteBill(bill: TransactionDTO): Promise<boolean> {
  const what = `${TX_COPY[bill.type].noun} from ${bill.party.name} on ${formatDate(bill.date)} (${formatMoney(bill.totalAmount)})`;
  if (!confirm(`Delete this ${what}?`)) return false;
  await api(`/api/transactions?id=${bill.id}`, { method: "DELETE" });
  return true;
}
