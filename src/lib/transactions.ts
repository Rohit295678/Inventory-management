import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ISO_DATE_RE, TX_TYPES, partyKindsFor, toISODate, type TxType } from "@/lib/domain";
import { formatMoney } from "@/lib/format";
import { priceLine, round2, sumTotals, toPaise, PricingError } from "@/lib/pricing";
import type { TransactionInput } from "@/lib/schemas";
import type { TransactionDTO } from "@/lib/types";

// Thrown for "your request makes no sense" cases; routes map it to a 4xx.
export class DomainError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

// open = only bills not yet settled (what the payments screen offers).
export type TxFilter = { type?: TxType; from?: string; to?: string; partyId?: string; open?: boolean };

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
    open: params.get("status") === "open" || undefined,
  };
}

// Shared by bills and payments: date-range + person filter as a Prisma where.
export function dateAndPartyWhere(userId: string, f: TxFilter) {
  return {
    userId,
    type: f.type,
    partyId: f.partyId,
    date: { gte: f.from ? new Date(f.from) : undefined, lte: f.to ? new Date(f.to) : undefined },
  };
}

// The person must exist, be this user's, and fit the bill type
// (suppliers on purchases, customers on sales).
export async function assertPartyFits(userId: string, partyId: string, type: TxType) {
  const party = await prisma.party.findFirst({ where: { id: partyId, userId }, select: { kind: true } });
  if (!party) throw new DomainError("Person not found", 404);
  if (!partyKindsFor(type).includes(party.kind as never)) {
    throw new DomainError(type === "PURCHASE" ? "This person is not marked as a supplier" : "This person is not marked as a customer");
  }
}

const TX_INCLUDE = {
  party: { select: { id: true, name: true } },
  lines: { include: { item: { select: { name: true } } }, orderBy: { id: "asc" } },
  allocations: { select: { amount: true } },
} satisfies Prisma.TransactionInclude;

type TxRow = Prisma.TransactionGetPayload<{ include: typeof TX_INCLUDE }>;

// Paid/due from a bill's payment allocations. Used here and by payments.
export function paidAndDue(totalAmount: number, allocations: ReadonlyArray<{ amount: number }>) {
  const paid = round2(allocations.reduce((sum, a) => sum + a.amount, 0));
  return { paid, due: round2(totalAmount - paid) };
}

function toDTO(tx: TxRow): TransactionDTO {
  return {
    id: tx.id,
    type: tx.type as TxType,
    date: toISODate(tx.date),
    note: tx.note,
    totalAmount: tx.totalAmount,
    ...paidAndDue(tx.totalAmount, tx.allocations),
    settledAt: tx.settledAt?.toISOString() ?? null,
    party: tx.party,
    lines: tx.lines.map((l) => ({
      id: l.id,
      itemId: l.itemId,
      itemName: l.item.name,
      quantity: l.quantity,
      unit: l.unit,
      weightPerUnitKg: l.weightPerUnitKg,
      weightKg: l.weightKg,
      ratePerKg: l.ratePerKg,
      totalCost: l.totalCost,
    })),
  };
}

export async function listTransactions(userId: string, f: TxFilter): Promise<TransactionDTO[]> {
  const rows = await prisma.transaction.findMany({
    where: { ...dateAndPartyWhere(userId, f), settledAt: f.open ? null : undefined },
    include: TX_INCLUDE,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toDTO);
}

export async function createTransaction(userId: string, input: TransactionInput): Promise<TransactionDTO> {
  await assertPartyFits(userId, input.partyId, input.type);

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

// Refused while payments sit on the bill: deleting it would make that money vanish.
export async function deleteTransaction(userId: string, id: string): Promise<boolean> {
  if (await prisma.paymentAllocation.count({ where: { transactionId: id, transaction: { userId } } })) {
    throw new DomainError("This bill has payments. Delete those payments first.", 409);
  }
  const { count } = await prisma.transaction.deleteMany({ where: { id, userId } });
  return count > 0;
}

// Mark a fully paid bill as settled (it leaves the payments screen), or undo.
export async function setSettled(userId: string, id: string, settled: boolean): Promise<TransactionDTO | null> {
  const tx = await prisma.transaction.findFirst({ where: { id, userId }, include: TX_INCLUDE });
  if (!tx) return null;

  const { due } = paidAndDue(tx.totalAmount, tx.allocations);
  if (settled && toPaise(due) > 0) {
    throw new DomainError(`${formatMoney(due)} is still due on this bill. Settle it once it is fully paid.`);
  }
  const updated = await prisma.transaction.update({
    where: { id },
    data: { settledAt: settled ? (tx.settledAt ?? new Date()) : null },
    include: TX_INCLUDE,
  });
  return toDTO(updated);
}
