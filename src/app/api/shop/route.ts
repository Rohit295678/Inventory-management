import { corsPreflight, getUserId, jsonResponse, parseBody, unauthorized } from "@/lib/api-auth";
import { shopSchema } from "@/lib/schemas";
import { getShop, updateShop } from "@/lib/users";

export async function OPTIONS() {
  return corsPreflight();
}

// GET /api/shop -> { name, address, phone }  (printed on invoices)
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const shop = await getShop(userId);
  return shop ? jsonResponse(shop) : unauthorized();
}

// PUT /api/shop { name?, address?, phone? }  (empty = clear)
export async function PUT(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const body = await parseBody(req, shopSchema);
  if (body.error) return body.error;
  return jsonResponse(await updateShop(userId, body.data));
}
