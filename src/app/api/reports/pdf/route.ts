import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { corsHeaders, corsPreflight, errorResponse, getUserId, unauthorized } from "@/lib/api-auth";
import { TX_COPY } from "@/lib/domain";
import { formatDateRange } from "@/lib/format";
import { buildTransactionsPdf } from "@/lib/pdf";
import { summarize } from "@/lib/summary";
import { listTransactions, parseFilter } from "@/lib/transactions";
import { findPublicUser } from "@/lib/users";

export const runtime = "nodejs";

export async function OPTIONS() {
  return corsPreflight();
}

// GET /api/reports/pdf?type=PURCHASE|SALE&from=&to=&partyId=  -> application/pdf
// Same filters as GET /api/transactions, so "what you see is what you print".
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const filter = parseFilter(new URL(req.url).searchParams);
  if (!filter.type) return errorResponse("type must be PURCHASE or SALE", 400);

  const [transactions, user, party] = await Promise.all([
    listTransactions(userId, filter),
    findPublicUser(userId),
    filter.partyId
      ? prisma.party.findFirst({ where: { id: filter.partyId, userId }, select: { name: true } })
      : null,
  ]);

  const pdf = buildTransactionsPdf({
    type: filter.type,
    periodLabel: formatDateRange(filter.from, filter.to),
    partyName: party?.name,
    ownerName: user?.name || user?.email || "",
    transactions,
    summary: summarize(transactions),
  });

  const span = [filter.from, filter.to].filter(Boolean).join("_to_") || "all";
  return new NextResponse(pdf, {
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${TX_COPY[filter.type].slug}-${span}.pdf"`,
    },
  });
}
