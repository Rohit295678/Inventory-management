import { toPaise } from "./pricing.ts";
import type { TransactionDTO } from "./types.ts";

// Where a bill stands, in one place for the bill page, cards and PDFs.
export type BillStatus = "settled" | "paid" | "partly" | "unpaid";

export const BILL_STATUS_LABEL: Record<BillStatus, string> = {
  settled: "Settled",
  paid: "Paid in full",
  partly: "Partly paid",
  unpaid: "Unpaid",
};

type Money = Pick<TransactionDTO, "paid" | "due" | "settledAt">;

export const isFullyPaid = (bill: Pick<TransactionDTO, "due">) => toPaise(bill.due) <= 0;

export function billStatus(bill: Money): BillStatus {
  if (bill.settledAt) return "settled";
  if (isFullyPaid(bill)) return "paid";
  return toPaise(bill.paid) > 0 ? "partly" : "unpaid";
}

// Settled or fully paid: nothing more to collect.
export const isClear = (bill: Money) => billStatus(bill) === "settled" || billStatus(bill) === "paid";

// 0-100, for the progress bar. Never above 100 even with rounding dust.
export const paidPercent = (bill: Pick<TransactionDTO, "paid" | "totalAmount">) =>
  bill.totalAmount > 0 ? Math.min(100, Math.round((bill.paid / bill.totalAmount) * 100)) : 0;
