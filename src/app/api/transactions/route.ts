import { corsPreflight, errorResponse, getUserId, jsonResponse, parseBody, requireId, unauthorized } from "@/lib/api-auth";
import { notFound } from "@/lib/api-errors";
import { settleSchema, transactionSchema } from "@/lib/schemas";
import { summarize } from "@/lib/summary";
import { createTransaction, deleteTransaction, DomainError, listTransactions, parseFilter, setSettled } from "@/lib/transactions";
import type { TransactionsResponse } from "@/lib/types";

export async function OPTIONS() {
  return corsPreflight();
}

// Map business-rule errors to 4xx; anything else is a real bug -> 500.
async function domainSafe(run: () => Promise<Response>) {
  try {
    return await run();
  } catch (err) {
    if (err instanceof DomainError) return errorResponse(err.message, err.status);
    throw err;
  }
}

// GET /api/transactions?type=PURCHASE|SALE&from=YYYY-MM-DD&to=YYYY-MM-DD&partyId=...&status=open
// -> { transactions, summary }  (summary = totals incl. paid/due + per-item + per-person)
// status=open -> only bills not yet settled (for the payments screen)
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const transactions = await listTransactions(userId, parseFilter(new URL(req.url).searchParams));
  const body: TransactionsResponse = { transactions, summary: summarize(transactions) };
  return jsonResponse(body);
}

// POST /api/transactions
// { type, partyId, date, note?, lines: [{ itemId, quantity, weightPerUnitKg?, ratePerKg }] }
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const body = await parseBody(req, transactionSchema);
  if (body.error) return body.error;

  return domainSafe(async () => jsonResponse(await createTransaction(userId, body.data), { status: 201 }));
}

// PATCH /api/transactions?id=... { settled: true|false }
// Settling needs the bill fully paid; settled bills leave the payments screen.
export async function PATCH(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const body = await parseBody(req, settleSchema);
  if (body.error) return body.error;

  return domainSafe(async () => {
    const tx = await setSettled(userId, requireId(req) ?? "", body.data.settled);
    return tx ? jsonResponse(tx) : notFound();
  });
}

// DELETE /api/transactions?id=...  (409 while payments sit on the bill)
export async function DELETE(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  return domainSafe(async () => ((await deleteTransaction(userId, requireId(req) ?? "")) ? jsonResponse({ success: true }) : notFound()));
}
