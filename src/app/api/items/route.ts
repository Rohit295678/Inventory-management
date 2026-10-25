import { prisma } from "@/lib/db";
import { corsPreflight, errorResponse, getUserId, jsonResponse, parseBody, requireId, unauthorized } from "@/lib/api-auth";
import { conflictOr, inUse, notFound } from "@/lib/api-errors";
import { itemSchema } from "@/lib/schemas";
import { EMPTY_STATS, getItemStats } from "@/lib/item-stats";
import type { ItemDTO } from "@/lib/types";

const SELECT = { id: true, name: true, unit: true, details: true, type: { select: { id: true, name: true } } } as const;
const DUPLICATE = "You already have an item with this name";

// The type must be one of THIS user's types (types are per user).
async function ownsType(userId: string, typeId: string) {
  return (await prisma.itemType.count({ where: { id: typeId, userId } })) > 0;
}
const unknownType = () => errorResponse("Pick one of your types of goods", 400);

export async function OPTIONS() {
  return corsPreflight();
}

// GET /api/items -> ItemDTO[] (with stock on hand and purchase totals)
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const [items, stats] = await Promise.all([
    prisma.item.findMany({ where: { userId }, select: SELECT, orderBy: [{ type: { name: "asc" } }, { name: "asc" }] }),
    getItemStats(userId),
  ]);
  const body: ItemDTO[] = items.map((i) => ({ ...i, ...(stats.get(i.id) ?? EMPTY_STATS) }));
  return jsonResponse(body);
}

// POST /api/items { name, typeId, unit, details? }
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const body = await parseBody(req, itemSchema);
  if (body.error) return body.error;
  if (!(await ownsType(userId, body.data.typeId))) return unknownType();

  try {
    const item = await prisma.item.create({ data: { ...body.data, userId }, select: SELECT });
    return jsonResponse(item, { status: 201 });
  } catch (err) {
    return conflictOr(err, DUPLICATE);
  }
}

// PATCH /api/items?id=... { name, typeId, unit, details? }
export async function PATCH(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const id = requireId(req);
  const body = await parseBody(req, itemSchema);
  if (body.error) return body.error;
  if (!(await ownsType(userId, body.data.typeId))) return unknownType();

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
