import { prisma } from "@/lib/db";
import { corsPreflight, getUserId, jsonResponse, parseBody, requireId, unauthorized } from "@/lib/api-auth";
import { inUse, notFound } from "@/lib/api-errors";
import { PARTY_KINDS, type PartyKind } from "@/lib/domain";
import { partySchema } from "@/lib/schemas";

const SELECT = { id: true, name: true, kind: true, phone: true, address: true } as const;

export async function OPTIONS() {
  return corsPreflight();
}

// GET /api/parties[?kind=SUPPLIER|CUSTOMER]
// Filtering by SUPPLIER/CUSTOMER also includes people marked BOTH.
export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const kindParam = new URL(req.url).searchParams.get("kind");
  const kind = PARTY_KINDS.find((k) => k === kindParam);
  const kinds: PartyKind[] | undefined = kind && kind !== "BOTH" ? [kind, "BOTH"] : undefined;

  const parties = await prisma.party.findMany({
    where: { userId, kind: kinds ? { in: kinds } : undefined },
    select: SELECT,
    orderBy: { name: "asc" },
  });
  return jsonResponse(parties);
}

// POST /api/parties { name, kind, phone?, address? }
export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const body = await parseBody(req, partySchema);
  if (body.error) return body.error;

  const party = await prisma.party.create({ data: { ...body.data, userId }, select: SELECT });
  return jsonResponse(party, { status: 201 });
}

// PATCH /api/parties?id=... { name, kind, phone?, address? }
export async function PATCH(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const id = requireId(req) ?? "";
  const body = await parseBody(req, partySchema);
  if (body.error) return body.error;

  const { count } = await prisma.party.updateMany({ where: { id, userId }, data: body.data });
  if (!count) return notFound();
  return jsonResponse(await prisma.party.findUnique({ where: { id }, select: SELECT }));
}

// DELETE /api/parties?id=...  (refused while the person has bills)
export async function DELETE(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return unauthorized();

  const id = requireId(req) ?? "";
  if (await prisma.transaction.count({ where: { partyId: id, userId } })) return inUse("person");

  const { count } = await prisma.party.deleteMany({ where: { id, userId } });
  return count ? jsonResponse({ success: true }) : notFound();
}
