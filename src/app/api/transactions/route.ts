import { corsPreflight, errorResponse, getUserId, jsonResponse, parseBody, requireId, unauthorized } from "@/lib/api-auth";
import { notFound } from "@/lib/api-errors";
import { transactionSchema } from "@/lib/schemas";
import { summarize } from "@/lib/summary";
import { createTransaction, deleteTransaction, DomainError, listTransactions, parseFilter } from "@/lib/transactions";
import type { TransactionsResponse } from "@/lib/types";

export async function OPTIONS() {
  return corsPreflight();
}

// GET /api/transactions?type=PURCHASE|SALE&from=YYYY-MM-DD&to=YYYY-MM-DD&partyId=...
// -> { transactions, summary }  (summary = totals + per-item + per-person)
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const transactions = await listTransactions(userId, parseFilter(new URL(req.url).searchParams));
  const body: TransactionsResponse = { transactions, summary: summarize(transactions) };
  return jsonResponse(body);
}

// POST /api/transactions
// { type, partyId, date, note?, lines: [{ itemId, quantity, weightPerUnitKg?, ratePerKg }] }
// Each line needs ratePerKg OR totalCost; the server fills in the other.
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const body = await parseBody(req, transactionSchema);
  if (body.error) return body.error;

  try {
    return jsonResponse(await createTransaction(userId, body.data), { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) return errorResponse(err.message, err.status);
    throw err;
  }
}

// DELETE /api/transactions?id=...
export async function DELETE(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const deleted = await deleteTransaction(userId, requireId(req) ?? "");
  return deleted ? jsonResponse({ success: true }) : notFound();
}
