import { prisma } from "@/lib/db";
import { corsPreflight, errorResponse, getUserId, jsonResponse, parseBody, unauthorized } from "@/lib/api-auth";
import { conflictOr } from "@/lib/api-errors";
import { itemTypeSchema } from "@/lib/schemas";
import type { ItemTypeDTO } from "@/lib/types";

// The user's own list of "types of goods". Per user, never shared.
const SELECT = { id: true, name: true } as const;
const DUPLICATE = "You already have this type";

export async function OPTIONS() {
  return corsPreflight();
}

// GET /api/item-types -> ItemTypeDTO[] (A-Z)
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const types: ItemTypeDTO[] = await prisma.itemType.findMany({ where: { userId }, select: SELECT, orderBy: { name: "asc" } });
  return jsonResponse(types);
}

// POST /api/item-types { name } -> 201 ItemTypeDTO
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const body = await parseBody(req, itemTypeSchema);
  if (body.error) return body.error;

  // "Rice" and "rice" are the same type; the DB index alone is case-sensitive.
  const clash = await prisma.itemType.findFirst({
    where: { userId, name: { equals: body.data.name, mode: "insensitive" } },
    select: { id: true },
  });
  if (clash) return errorResponse(DUPLICATE, 409);

  try {
    const type = await prisma.itemType.create({ data: { ...body.data, userId }, select: SELECT });
    return jsonResponse(type, { status: 201 });
  } catch (err) {
    return conflictOr(err, DUPLICATE); // two requests racing past the check above
  }
}
