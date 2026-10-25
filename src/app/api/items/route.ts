import { prisma } from "@/lib/db";
import { corsPreflight, getUserId, jsonResponse, parseBody, requireId, unauthorized } from "@/lib/api-auth";
import { conflictOr, inUse, notFound } from "@/lib/api-errors";
import { itemSchema } from "@/lib/schemas";
import { getStock } from "@/lib/stock";
import type { ItemDTO } from "@/lib/types";

const SELECT = { id: true, name: true, category: true, unit: true, details: true } as const;
const DUPLICATE = "You already have an item with this name";

export async function OPTIONS() {
  return corsPreflight();
}

// GET /api/items -> ItemDTO[] (with current stock on hand)
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const [items, stock] = await Promise.all([
    prisma.item.findMany({ where: { userId }, select: SELECT, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    getStock(userId),
  ]);
  const body: ItemDTO[] = items.map((i) => ({ ...i, stock: stock.get(i.id) ?? { quantity: 0, weightKg: 0 } }));
  return jsonResponse(body);
}

// POST /api/items { name, category, unit, details? }
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const body = await parseBody(req, itemSchema);
  if (body.error) return body.error;

  try {
    const item = await prisma.item.create({ data: { ...body.data, userId }, select: SELECT });
    return jsonResponse(item, { status: 201 });
  } catch (err) {
    return conflictOr(err, DUPLICATE);
  }
}

// PATCH /api/items?id=... { name, category, unit, details? }
export async function PATCH(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const id = requireId(req);
  const body = await parseBody(req, itemSchema);
  if (body.error) return body.error;

  try {
    const { count } = await prisma.item.updateMany({ where: { id: id ?? "", userId }, data: body.data });
    if (!count) return notFound();
    return jsonResponse(await prisma.item.findUnique({ where: { id: id! }, select: SELECT }));
  } catch (err) {
    return conflictOr(err, DUPLICATE);
  }
}

// DELETE /api/items?id=...  (refused while the item appears on any bill)
export async function DELETE(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const id = requireId(req) ?? "";
  if (await prisma.transactionLine.count({ where: { itemId: id, item: { userId } } })) return inUse("item");

  const { count } = await prisma.item.deleteMany({ where: { id, userId } });
  return count ? jsonResponse({ success: true }) : notFound();
}
