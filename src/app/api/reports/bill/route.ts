import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { corsHeaders, corsPreflight, getUserId, requireId, unauthorized } from "@/lib/api-auth";
import { notFound } from "@/lib/api-errors";
import { TX_COPY } from "@/lib/domain";
import { buildInvoicePdf } from "@/lib/pdf";
import { getTransaction } from "@/lib/transactions";
import { getLetterhead } from "@/lib/users";

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

  const tx = await getTransaction(userId, requireId(req) ?? "");
  if (!tx) return notFound();

  const [shop, party] = await Promise.all([
    getLetterhead(userId),
    prisma.party.findFirst({ where: { id: tx.party.id, userId }, select: { name: true, phone: true, address: true } }),
  ]);
  const pdf = buildInvoicePdf({ tx, shop, party: party ?? { name: tx.party.name, phone: null, address: null } });

  return new NextResponse(pdf, {
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${TX_COPY[tx.type].noun}-invoice-${fileSafe(tx.party.name)}-${tx.date}.pdf"`,
    },
  });
}
