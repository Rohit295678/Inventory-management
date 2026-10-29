import { NextResponse } from "next/server";
import { corsHeaders, corsPreflight, getUserId, requireId, unauthorized } from "@/lib/api-auth";
import { notFound } from "@/lib/api-errors";
import { TX_COPY } from "@/lib/domain";
import { buildInvoicePdf } from "@/lib/pdf";
import { getBillDetail } from "@/lib/transactions";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflight();
}

// Header-safe file name part: "Sita Stores" -> "Sita-Stores".
const fileSafe = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "bill";

// GET /api/reports/bill?id=...  -> application/pdf
// One bill as an invoice: shop letterhead, customer/supplier, items,
// payments by date, balance due.
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const detail = await getBillDetail(userId, requireId(req) ?? "");
  if (!detail) return notFound();
  const { bill } = detail;

  return new NextResponse(buildInvoicePdf({ tx: bill, shop: detail.shop, party: detail.party }), {
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${TX_COPY[bill.type].noun}-invoice-${fileSafe(bill.party.name)}-${bill.date}.pdf"`,
    },
  });
}
