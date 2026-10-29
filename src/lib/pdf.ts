import { jsPDF } from "jspdf";
import { autoTable, type RowInput, type Styles } from "jspdf-autotable";
import { BILL_STATUS_LABEL, billStatus, isClear } from "@/lib/bill-status";
import { PAYMENT_COPY, TX_COPY, todayISO, type TxType } from "@/lib/domain";
import { formatDate, formatKg, formatLineQty, formatMoney, formatQty } from "@/lib/format";
import type { Letterhead, Summary, TransactionDTO } from "@/lib/types";

// Server-side PDFs so web and mobile download the exact same documents:
// an invoice per bill, and a report over a period.

type RGB = [number, number, number];
const rs = (n: number) => formatMoney(n, "Rs. ");
// Mirrors the brand tokens in globals.css (jsPDF can't read CSS variables).
const BRAND: RGB = [27, 69, 94]; // brand-700 #1B455E
const BRAND_TINT: RGB = [238, 244, 246]; // brand-50 #EEF4F6
const ACCENT: RGB = [249, 214, 107]; // butter #F9D66B
const LINE: RGB = [230, 229, 221]; // line #E6E5DD
const STRIPE: RGB = [247, 247, 243];
const PAID_GREEN: RGB = [21, 128, 61]; // green-700
const DUE_RED: RGB = [185, 28, 28]; // red-700
const MARGIN = 40;

const PAYMENT_STYLE: Partial<Styles> = { textColor: PAID_GREEN, fontStyle: "italic" };
const STATUS_STYLE: Partial<Styles> = { fontStyle: "bold", fillColor: BRAND_TINT, textColor: 20 };
const HEAD_STYLES: Partial<Styles> = { fillColor: BRAND, textColor: 255, fontStyle: "bold" };

// Item names print plainly with their type: "miniket (Rice)", never the
// lot name ("miniket-40rs/kg") used to pick stock.
const itemLabel = (name: string, type: string) => `${name} (${type})`;

// Header cell lined up with its right-aligned numbers.
const rightHead = (content: string) => ({ content, styles: { halign: "right" as const } });

// jspdf-autotable stashes the last table's end Y on the doc.
const lastY = (doc: jsPDF) => (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
const pageWidth = (doc: jsPDF) => doc.internal.pageSize.getWidth();

// Brand strip, centred title, then the shop: name, address, phone.
// Returns the y below the divider.
function drawLetterhead(doc: jsPDF, title: string, shop: Letterhead): number {
  const width = pageWidth(doc);
  const centre = width / 2;
  doc.setFillColor(...BRAND).rect(0, 0, width, 10, "F");
  doc.setFillColor(...ACCENT).rect(0, 10, width, 3, "F");

  doc.setFont("helvetica", "bold").setFontSize(20).setTextColor(...BRAND);
  doc.text(title.toUpperCase(), centre, 52, { align: "center" });

  let y = 78;
  doc.setFontSize(15).setTextColor(20).text(shop.name, centre, y, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(90);
  const contact = [
    ...(shop.address ? (doc.splitTextToSize(shop.address, width - 4 * MARGIN) as string[]) : []),
    ...(shop.phone ? [`Phone: ${shop.phone}`] : []),
  ];
  for (const line of contact) {
    y += 13;
    doc.text(line, centre, y, { align: "center" });
  }

  y += 16;
  doc.setDrawColor(...LINE).setLineWidth(1).line(MARGIN, y, width - MARGIN, y);
  return y + 18;
}

function addPageNumbers(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p).setFont("helvetica", "normal").setFontSize(8).setTextColor(130);
    doc.text(`Page ${p} of ${pages}`, pageWidth(doc) - MARGIN, doc.internal.pageSize.getHeight() - 20, { align: "right" });
  }
}

// ---- Rows shared by the invoice and the report. `lead` adds the report's
// Date + Person columns in front; the invoice has none.
type Lead = (cells: [string, string]) => string[];
const WITH_DATE_AND_PARTY: Lead = (cells) => cells;
const NO_LEAD: Lead = () => [];

function lineRows(tx: TransactionDTO, lead: Lead): RowInput[] {
  return tx.lines.map((l, i) => [
    ...lead(i === 0 ? [formatDate(tx.date), tx.party.name] : ["", ""]),
    itemLabel(l.itemName, l.itemType),
    formatLineQty(l),
    formatKg(l.weightKg),
    rs(l.ratePerKg),
    rs(l.totalCost),
  ]);
}

function paymentRows(tx: TransactionDTO, verb: string, lead: Lead): RowInput[] {
  return tx.payments.map((p) => [
    ...lead(["", ""]),
    { content: `${verb} on ${formatDate(p.date)}`, colSpan: 4, styles: PAYMENT_STYLE },
    { content: rs(p.amount), styles: PAYMENT_STYLE },
  ]);
}

function statusText(tx: TransactionDTO, verb: string): string {
  if (tx.settledAt) return `Settled: ${verb.toLowerCase()} ${rs(tx.paid)} in full`;
  if (tx.paid) return `${verb} ${rs(tx.paid)} \u00b7 Due ${rs(tx.due)}`;
  return `Nothing ${verb.toLowerCase()} yet \u00b7 Due ${rs(tx.due)}`;
}

// ---- Invoice: one bill, ready to hand over or share.
export type InvoiceInput = {
  tx: TransactionDTO;
  shop: Letterhead;
  party: { name: string; phone: string | null; address: string | null };
};

const INVOICE_TITLE: Record<TxType, { title: string; partyLabel: string }> = {
  SALE: { title: "Sales Invoice", partyLabel: "BILL TO" },
  PURCHASE: { title: "Purchase Invoice", partyLabel: "BILL FROM" },
};

export function buildInvoicePdf({ tx, shop, party }: InvoiceInput): ArrayBuffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const { title, partyLabel } = INVOICE_TITLE[tx.type];
  const verb = PAYMENT_COPY[tx.type].verb;
  const width = pageWidth(doc);
  const inner = width - 2 * MARGIN;
  const half = inner / 2;

  let y = drawLetterhead(doc, title, shop);

  // Party (left) and bill details (right) in one tinted box.
  doc.setFont("helvetica", "normal").setFontSize(9.5);
  const partyLines = [
    ...(party.phone ? [`Phone: ${party.phone}`] : []),
    ...(party.address ? (doc.splitTextToSize(party.address, half - 30) as string[]) : []),
  ];
  const status = BILL_STATUS_LABEL[billStatus(tx)];
  const details: [string, string][] = [
    ["Date", formatDate(tx.date)],
    ["Status", status],
    ...(tx.note ? ([["Note", tx.note]] as [string, string][]) : []),
  ];
  const boxHeight = 30 + Math.max(18 + partyLines.length * 13, details.length * 16) + 12;
  doc.setFillColor(...BRAND_TINT).roundedRect(MARGIN, y, inner, boxHeight, 8, 8, "F");

  doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...BRAND).text(partyLabel, MARGIN + 16, y + 22);
  doc.setFontSize(13).setTextColor(20).text(party.name, MARGIN + 16, y + 40);
  doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(70);
  partyLines.forEach((line, i) => doc.text(line, MARGIN + 16, y + 56 + i * 13));

  const labelX = MARGIN + half + 30;
  const valueX = width - MARGIN - 16;
  details.forEach(([label, value], i) => {
    const rowY = y + 24 + i * 16;
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(100).text(label, labelX, rowY);
    const tone: RGB = label === "Status" ? (isClear(tx) ? PAID_GREEN : DUE_RED) : [20, 20, 20];
    doc.setFont("helvetica", "bold").setTextColor(...tone).text(value, valueX, rowY, { align: "right", maxWidth: half - 90 });
  });
  y += boxHeight + 20;

  // Items
  autoTable(doc, {
    startY: y,
    head: [["#", "Item", rightHead("Qty"), rightHead("Weight"), rightHead("Rate / kg"), rightHead("Amount")]],
    body: lineRows(tx, NO_LEAD).map((row, i) => [String(i + 1), ...(row as string[])]),
    theme: "striped",
    headStyles: HEAD_STYLES,
    alternateRowStyles: { fillColor: STRIPE },
    styles: { fontSize: 9.5, cellPadding: 6, textColor: 30 },
    columnStyles: {
      0: { cellWidth: 26, halign: "center" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right", fontStyle: "bold" },
    },
    margin: { left: MARGIN, right: MARGIN },
  });
  y = lastY(doc) + 18;

  // Payments by date (left) beside the totals (right).
  autoTable(doc, {
    startY: y,
    head: [["Payments", rightHead(verb)]],
    body: tx.payments.length
      ? tx.payments.map((p) => [formatDate(p.date), { content: rs(p.amount), styles: { textColor: PAID_GREEN } }])
      : [[{ content: `Nothing ${verb.toLowerCase()} yet`, colSpan: 2, styles: { textColor: 110, fontStyle: "italic" } }]],
    theme: "plain",
    headStyles: { fontStyle: "bold", textColor: BRAND, fillColor: BRAND_TINT },
    styles: { fontSize: 9.5, cellPadding: 5 },
    columnStyles: { 1: { halign: "right" } },
    tableWidth: half - 12,
    margin: { left: MARGIN },
  });
  const paymentsEnd = lastY(doc);

  const balanceTone = isClear(tx) ? PAID_GREEN : DUE_RED;
  autoTable(doc, {
    startY: y,
    body: [
      ["Bill total", rs(tx.totalAmount)],
      [verb, rs(tx.paid)],
      [
        { content: tx.settledAt ? "Settled" : "Balance due", styles: { fontStyle: "bold", textColor: balanceTone, fillColor: BRAND_TINT } },
        { content: rs(tx.settledAt ? 0 : tx.due), styles: { fontStyle: "bold", textColor: balanceTone, fillColor: BRAND_TINT, fontSize: 12 } },
      ],
    ],
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 6, textColor: 30 },
    columnStyles: { 1: { halign: "right" } },
    tableWidth: half - 12,
    margin: { left: MARGIN + half + 12 },
  });
  y = Math.max(paymentsEnd, lastY(doc)) + 36;

  doc.setFont("helvetica", "italic").setFontSize(11).setTextColor(...BRAND).text("Thank you for your business!", width / 2, y, { align: "center" });
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(140);
  doc.text(`Generated with StockBook on ${formatDate(todayISO())}`, width / 2, y + 14, { align: "center" });

  addPageNumbers(doc);
  return doc.output("arraybuffer");
}

// ---- Report: all bills over a period (API: /api/reports/pdf).
type ReportInput = {
  type: TxType;
  periodLabel: string;
  partyName?: string;
  shop: Letterhead;
  transactions: TransactionDTO[];
  summary: Summary;
};

export function buildTransactionsPdf(r: ReportInput): ArrayBuffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const copy = TX_COPY[r.type];
  const verb = PAYMENT_COPY[r.type].verb;

  let y = drawLetterhead(doc, `${copy.title} report`, r.shop);
  const meta = [`Period: ${r.periodLabel}`, ...(r.partyName ? [`${copy.party}: ${r.partyName}`] : [])];
  doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(60).text(meta, MARGIN, y);
  y += meta.length * 14;

  autoTable(doc, {
    startY: y,
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
    headStyles: HEAD_STYLES,
    margin: { left: MARGIN, right: MARGIN },
  });

  autoTable(doc, {
    startY: lastY(doc) + 16,
    head: [["Item", "Quantity", "Weight", "Avg rate / kg", "Total"]],
    body: r.summary.byItem.map((i) => [
      itemLabel(i.itemName, i.itemType),
      formatQty(i.quantity, i.unit),
      formatKg(i.weightKg),
      rs(i.avgRatePerKg),
      rs(i.totalCost),
    ]),
    headStyles: HEAD_STYLES,
    margin: { left: MARGIN, right: MARGIN },
  });

  autoTable(doc, {
    startY: lastY(doc) + 16,
    head: [["Date", copy.party, "Item", "Qty", "Weight", "Rate / kg", "Total"]],
    body: r.transactions.flatMap((tx) => [
      ...lineRows(tx, WITH_DATE_AND_PARTY),
      ...paymentRows(tx, verb, WITH_DATE_AND_PARTY),
      ["", "", { content: statusText(tx, verb), colSpan: 5, styles: STATUS_STYLE }],
    ]),
    foot: [
      ["", "", "", "", "", "Grand total", rs(r.summary.totalAmount)],
      ["", "", "", "", "", verb, rs(r.summary.totalPaid)],
      ["", "", "", "", "", "Due", rs(r.summary.totalDue)],
    ],
    headStyles: HEAD_STYLES,
    footStyles: { fillColor: BRAND_TINT, textColor: 20, fontStyle: "bold" },
    styles: { fontSize: 9 },
    margin: { left: MARGIN, right: MARGIN },
  });

  addPageNumbers(doc);
  return doc.output("arraybuffer");
}
