import { corsPreflight, getUserId, jsonResponse, requireId, unauthorized } from "@/lib/api-auth";
import { notFound } from "@/lib/api-errors";
import { getBillDetail } from "@/lib/transactions";

export async function OPTIONS() {
  return corsPreflight();
}

// GET /api/transactions/detail?id=...
// -> { bill, party: { id, name, phone, address }, shop: { name, address, phone } }
// Everything the bill page shows (same data as the invoice PDF).
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const detail = await getBillDetail(userId, requireId(req) ?? "");
  return detail ? jsonResponse(detail) : notFound();
}
