import { jsPDF } from "jspdf";
import { autoTable, type RowInput, type Styles } from "jspdf-autotable";
import { PAYMENT_COPY, TX_COPY, type TxType } from "@/lib/domain";
import { formatDate, formatKg, formatLineQty, formatMoney, formatQty } from "@/lib/format";
import type { Summary, TransactionDTO } from "@/lib/types";

// Server-side PDF so web and mobile download the exact same document.

const rs = (n: number) => formatMoney(n, "Rs. ");
// Mirrors the brand tokens in globals.css (jsPDF can't read CSS variables).
const BRAND: [number, number, number] = [27, 69, 94]; // brand-700 #1B455E
const BRAND_TINT: [number, number, number] = [238, 244, 246]; // brand-50 #EEF4F6
const PAID_GREEN: [number, number, number] = [21, 128, 61]; // green-700, 5.0:1 on white

const PAYMENT_STYLE: Partial<Styles> = { textColor: PAID_GREEN, fontStyle: "italic" };
const STATUS_STYLE: Partial<Styles> = { fontStyle: "bold", fillColor: BRAND_TINT, textColor: 20 };

// One bill = its item lines, then each payment ("on which date, how much"),
// then where it stands: paid / due / settled. `verb` = Received | Paid.
function billRows(tx: TransactionDTO, verb: string): RowInput[] {
  const lines: RowInput[] = tx.lines.map((l, i) => [
    i === 0 ? formatDate(tx.date) : "",
    i === 0 ? tx.party.name : "",
    l.itemName,
    formatLineQty(l),
    formatKg(l.weightKg),
    rs(l.ratePerKg),
    rs(l.totalCost),
  ]);
  const payments: RowInput[] = tx.payments.map((p) => [
    "",
    "",
    { content: `${verb} on ${formatDate(p.date)}`, colSpan: 4, styles: PAYMENT_STYLE },
    { content: rs(p.amount), styles: PAYMENT_STYLE },
  ]);
  const status = tx.settledAt
    ? `Settled: ${verb.toLowerCase()} ${rs(tx.paid)} in full`
    : tx.paid
      ? `${verb} ${rs(tx.paid)} · Due ${rs(tx.due)}`
      : `Nothing ${verb.toLowerCase()} yet · Due ${rs(tx.due)}`;
  return [...lines, ...payments, ["", "", { content: status, colSpan: 5, styles: STATUS_STYLE }]];
}

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
  const verb = PAYMENT_COPY[r.type].verb;
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
    head: [["Bills", "Total weight", "Total amount", verb, "Due"]],
    body: [
      [
        String(r.summary.bills),
        formatKg(r.summary.totalWeightKg),
        rs(r.summary.totalAmount),
        rs(r.summary.totalPaid),
        rs(r.summary.totalDue),
      ],
    ],
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
    body: r.transactions.flatMap((tx) => billRows(tx, verb)),
    foot: [
      ["", "", "", "", "", "Grand total", rs(r.summary.totalAmount)],
      ["", "", "", "", "", verb, rs(r.summary.totalPaid)],
      ["", "", "", "", "", "Due", rs(r.summary.totalDue)],
    ],
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
