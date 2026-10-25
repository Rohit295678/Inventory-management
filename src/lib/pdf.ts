import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { TX_COPY, type TxType } from "@/lib/domain";
import { formatDate, formatKg, formatMoney, formatQty } from "@/lib/format";
import type { Summary, TransactionDTO } from "@/lib/types";

// Server-side PDF so web and mobile download the exact same document.

const rs = (n: number) => formatMoney(n, "Rs. ");
// Mirrors the brand tokens in globals.css (jsPDF can't read CSS variables).
const BRAND: [number, number, number] = [26, 93, 209]; // brand-700 #1A5DD1
const BRAND_TINT: [number, number, number] = [238, 244, 255]; // brand-50 #EEF4FF

type ReportInput = {
  type: TxType;
  periodLabel: string;
  partyName?: string;
  ownerName: string;
  transactions: TransactionDTO[];
  summary: Summary;
};

// jspdf-autotable stashes the last table's end Y on the doc.
const lastY = (doc: jsPDF) => (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

export function buildTransactionsPdf(r: ReportInput): ArrayBuffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const copy = TX_COPY[r.type];
  const margin = 40;

  doc.setFontSize(18).setTextColor(...BRAND).text(`${copy.title} report`, margin, 50);
  doc.setFontSize(10).setTextColor(60);
  const meta = [`Period: ${r.periodLabel}`, `Prepared for: ${r.ownerName}`];
  if (r.partyName) meta.splice(1, 0, `${copy.party}: ${r.partyName}`);
  doc.text(meta, margin, 70);

  const headStyles = { fillColor: BRAND, textColor: 255 } as const;
  const startAfterMeta = 70 + meta.length * 14;

  autoTable(doc, {
    startY: startAfterMeta,
    head: [["Bills", "Total weight", "Total amount"]],
    body: [[String(r.summary.bills), formatKg(r.summary.totalWeightKg), rs(r.summary.totalAmount)]],
    headStyles,
    margin: { left: margin, right: margin },
  });

  autoTable(doc, {
    startY: lastY(doc) + 16,
    head: [["Item", "Quantity", "Weight", "Avg rate / kg", "Total"]],
    body: r.summary.byItem.map((i) => [
      i.itemName,
      formatQty(i.quantity, i.unit),
      formatKg(i.weightKg),
      rs(i.avgRatePerKg),
      rs(i.totalCost),
    ]),
    headStyles,
    margin: { left: margin, right: margin },
  });

  autoTable(doc, {
    startY: lastY(doc) + 16,
    head: [["Date", copy.party, "Item", "Qty", "Weight", "Rate / kg", "Total"]],
    body: r.transactions.flatMap((tx) =>
      tx.lines.map((l, i) => [
        i === 0 ? formatDate(tx.date) : "",
        i === 0 ? tx.party.name : "",
        l.itemName,
        formatQty(l.quantity, l.unit),
        formatKg(l.weightKg),
        rs(l.ratePerKg),
        rs(l.totalCost),
      ])
    ),
    foot: [["", "", "", "", "", "Grand total", rs(r.summary.totalAmount)]],
    headStyles,
    footStyles: { fillColor: BRAND_TINT, textColor: 20, fontStyle: "bold" },
    styles: { fontSize: 9 },
    margin: { left: margin, right: margin },
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p).setFontSize(8).setTextColor(130);
    doc.text(`Page ${p} of ${pages}`, doc.internal.pageSize.getWidth() - margin, doc.internal.pageSize.getHeight() - 20, {
      align: "right",
    });
  }

  return doc.output("arraybuffer");
}
