import { corsPreflight, errorResponse, getUserId, jsonResponse, parseBody, requireId, unauthorized } from "@/lib/api-auth";
import { notFound } from "@/lib/api-errors";
import { createPayment, deletePayment, listPayments } from "@/lib/payments";
import { paymentSchema } from "@/lib/schemas";
import { DomainError, parseFilter } from "@/lib/transactions";

export async function OPTIONS() {
  return corsPreflight();
}

// GET /api/payments?type=SALE|PURCHASE&from=&to=&partyId=
// -> { payments, summary: { count, totalAmount } }   (oldest first)
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  return jsonResponse(await listPayments(userId, parseFilter(new URL(req.url).searchParams)));
}

// POST /api/payments
// { type, partyId, date, amount, note?, allocations: [{ transactionId, amount }] }
// allocations must add up to amount; each <= what is still due on that bill.
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const body = await parseBody(req, paymentSchema);
  if (body.error) return body.error;

  try {
    return jsonResponse(await createPayment(userId, body.data), { status: 201 });
  } catch (err) {
    if (err instanceof DomainError) return errorResponse(err.message, err.status);
    throw err;
  }
}

// DELETE /api/payments?id=...  (bills it paid become open/due again)
export async function DELETE(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  return (await deletePayment(userId, requireId(req) ?? "")) ? jsonResponse({ success: true }) : notFound();
}
