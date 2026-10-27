import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toISODate, type TxType } from "@/lib/domain";
import { formatDate, formatMoney } from "@/lib/format";
import { round2, toPaise } from "@/lib/pricing";
import type { PaymentInput } from "@/lib/schemas";
import { assertPartyFits, dateAndPartyWhere, DomainError, paidAndDue, type TxFilter } from "@/lib/transactions";
import type { PaymentDTO, PaymentsResponse } from "@/lib/types";

// Payments: money handed over in parts, each split across that person's open
// bills. SALE payments = received from customers, PURCHASE = paid to suppliers.

const PAYMENT_INCLUDE = {
  party: { select: { id: true, name: true } },
  allocations: {
    include: { transaction: { select: { date: true, totalAmount: true } } },
    orderBy: [{ transaction: { date: "desc" } }, { transaction: { createdAt: "desc" } }],
  },
} satisfies Prisma.PaymentInclude;

type PaymentRow = Prisma.PaymentGetPayload<{ include: typeof PAYMENT_INCLUDE }>;

function toDTO(p: PaymentRow): PaymentDTO {
  return {
    id: p.id,
    type: p.type as TxType,
    date: toISODate(p.date),
    amount: p.amount,
    note: p.note,
    party: p.party,
    allocations: p.allocations.map((a) => ({
      transactionId: a.transactionId,
      billDate: toISODate(a.transaction.date),
      billTotal: a.transaction.totalAmount,
      amount: a.amount,
    })),
  };
}

export async function listPayments(userId: string, f: TxFilter): Promise<PaymentsResponse> {
  const rows = await prisma.payment.findMany({
    where: dateAndPartyWhere(userId, f),
    include: PAYMENT_INCLUDE,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  const payments = rows.map(toDTO);
  return {
    payments,
    summary: { count: payments.length, totalAmount: round2(payments.reduce((sum, p) => sum + p.amount, 0)) },
  };
}

export async function createPayment(userId: string, input: PaymentInput): Promise<PaymentDTO> {
  await assertPartyFits(userId, input.partyId, input.type);

  const ids = input.allocations.map((a) => a.transactionId);
  if (new Set(ids).size !== ids.length) throw new DomainError("Each bill can appear only once in a payment");

  const allocated = input.allocations.reduce((sum, a) => sum + a.amount, 0);
  if (toPaise(allocated) !== toPaise(input.amount)) {
    throw new DomainError(
      `The bills add up to ${formatMoney(round2(allocated))} but the payment is ${formatMoney(input.amount)}. They must match.`
    );
  }

  // Serializable: two payments saved at the same moment can't both use up
  // the same "due" and overpay a bill.
  const created = await prisma.$transaction(
    async (db) => {
      const bills = await db.transaction.findMany({
        where: { id: { in: ids }, userId },
        select: { id: true, type: true, partyId: true, date: true, totalAmount: true, settledAt: true, allocations: { select: { amount: true } } },
      });
      if (bills.length !== ids.length) throw new DomainError("One or more bills were not found", 404);

      const billById = new Map(bills.map((b) => [b.id, b]));
      for (const a of input.allocations) {
        const bill = billById.get(a.transactionId)!;
        const label = `Bill of ${formatDate(toISODate(bill.date))}`;
        if (bill.type !== input.type || bill.partyId !== input.partyId) throw new DomainError(`${label} belongs to someone else`);
        if (bill.settledAt) throw new DomainError(`${label} is already settled`);
        const { due } = paidAndDue(bill.totalAmount, bill.allocations);
        if (toPaise(a.amount) > toPaise(due)) throw new DomainError(`${label}: only ${formatMoney(due)} is due`);
      }

      return db.payment.create({
        data: {
          userId,
          type: input.type,
          partyId: input.partyId,
          date: new Date(input.date),
          amount: round2(input.amount),
          note: input.note,
          allocations: { create: input.allocations.map((a) => ({ transactionId: a.transactionId, amount: round2(a.amount) })) },
        },
        include: PAYMENT_INCLUDE,
      });
    },
    { isolationLevel: "Serializable" }
  );
  return toDTO(created);
}

// Deleting a payment puts its money back as "due", so any bill it touched
// can't stay settled.
export async function deletePayment(userId: string, id: string): Promise<boolean> {
  return prisma.$transaction(async (db) => {
    const payment = await db.payment.findFirst({ where: { id, userId }, select: { allocations: { select: { transactionId: true } } } });
    if (!payment) return false;

    await db.payment.delete({ where: { id } }); // allocations cascade
    await db.transaction.updateMany({
      where: { id: { in: payment.allocations.map((a) => a.transactionId) }, userId },
      data: { settledAt: null },
    });
    return true;
  });
}
