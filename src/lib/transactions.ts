import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ISO_DATE_RE, TX_TYPES, partyKindsFor, toISODate, type TxType } from "@/lib/domain";
import { priceLine, sumTotals, PricingError } from "@/lib/pricing";
import type { TransactionInput } from "@/lib/schemas";
import type { TransactionDTO } from "@/lib/types";

// Thrown for "your request makes no sense" cases; routes map it to a 4xx.
export class DomainError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export type TxFilter = { type?: TxType; from?: string; to?: string; partyId?: string };

// Lenient query-string parsing: unknown/garbage values are simply ignored.
export function parseFilter(params: URLSearchParams): TxFilter {
  const type = params.get("type");
  const from = params.get("from");
  const to = params.get("to");
  return {
    type: TX_TYPES.find((t) => t === type),
    from: from && ISO_DATE_RE.test(from) ? from : undefined,
    to: to && ISO_DATE_RE.test(to) ? to : undefined,
    partyId: params.get("partyId") || undefined,
  };
}

const TX_INCLUDE = {
  party: { select: { id: true, name: true } },
  lines: { include: { item: { select: { name: true } } }, orderBy: { id: "asc" } },
} satisfies Prisma.TransactionInclude;

type TxRow = Prisma.TransactionGetPayload<{ include: typeof TX_INCLUDE }>;

function toDTO(tx: TxRow): TransactionDTO {
  return {
    id: tx.id,
    type: tx.type as TxType,
    date: toISODate(tx.date),
    note: tx.note,
    totalAmount: tx.totalAmount,
    party: tx.party,
    lines: tx.lines.map((l) => ({
      id: l.id,
      itemId: l.itemId,
      itemName: l.item.name,
      quantity: l.quantity,
      unit: l.unit,
      weightKg: l.weightKg,
      ratePerKg: l.ratePerKg,
      totalCost: l.totalCost,
    })),
  };
}

export async function listTransactions(userId: string, f: TxFilter): Promise<TransactionDTO[]> {
  const rows = await prisma.transaction.findMany({
    where: {
      userId,
      type: f.type,
      partyId: f.partyId,
      date: { gte: f.from ? new Date(f.from) : undefined, lte: f.to ? new Date(f.to) : undefined },
    },
    include: TX_INCLUDE,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toDTO);
}

export async function createTransaction(userId: string, input: TransactionInput): Promise<TransactionDTO> {
  const party = await prisma.party.findFirst({
    where: { id: input.partyId, userId },
    select: { kind: true },
  });
  if (!party) throw new DomainError("Person not found", 404);
  if (!partyKindsFor(input.type).includes(party.kind as never)) {
    throw new DomainError(
      input.type === "PURCHASE" ? "This person is not marked as a supplier" : "This person is not marked as a customer"
    );
  }

  const itemIds = [...new Set(input.lines.map((l) => l.itemId))];
  const items = await prisma.item.findMany({
    where: { id: { in: itemIds }, userId },
    select: { id: true, unit: true },
  });
  const unitById = new Map(items.map((i) => [i.id, i.unit]));
  if (unitById.size !== itemIds.length) throw new DomainError("One or more items were not found", 404);

  const lines = input.lines.map((line, index) => {
    try {
      return { itemId: line.itemId, ...priceLine({ ...line, unit: unitById.get(line.itemId)! }) };
    } catch (err) {
      if (err instanceof PricingError) throw new DomainError(`Line ${index + 1}: ${err.message}`);
      throw err;
    }
  });

  const created = await prisma.transaction.create({
    data: {
      userId,
      type: input.type,
      partyId: input.partyId,
      date: new Date(input.date),
      note: input.note,
      totalAmount: sumTotals(lines),
      lines: { create: lines },
    },
    include: TX_INCLUDE,
  });
  return toDTO(created);
}

export async function deleteTransaction(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.transaction.deleteMany({ where: { id, userId } });
  return count > 0;
}
