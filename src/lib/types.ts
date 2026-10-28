// JSON shapes returned by the API. Shared by the web UI today and the
// mobile app tomorrow — change with care.

import type { PartyKind, TxType } from "@/lib/domain";

export type Stock = { quantity: number; weightKg: number };

// What was paid to suppliers for an item, across all purchases.
export type Bought = Stock & { totalCost: number; avgRatePerKg: number };

// The same, from one supplier. min/max show if their price changed per bill.
export type SupplierBought = Bought & {
  partyId: string;
  partyName: string;
  minRatePerKg: number;
  maxRatePerKg: number;
};

export type ItemStats = {
  stock: Stock;
  bought: Bought; // = sum of `suppliers`
  suppliers: SupplierBought[]; // biggest spend first
  lots: LotDTO[]; // in-stock price lots, oldest first
};

// The item bought at one price per kg, and how much of that is still in stock.
export type LotDTO = {
  ratePerKg: number; // purchase price per kg: identifies the lot
  label: string; // "miniket-40rs/kg" when several lots are in stock, else "miniket"
  firstBoughtOn: string; // YYYY-MM-DD
  stock: Stock;
  bought: Bought;
  suppliers: SupplierBought[];
};

// The user's own "type of goods" (Rice, Pulse, ...). Per user, not global.
export type ItemTypeDTO = { id: string; name: string };

export type ItemDTO = {
  id: string;
  name: string;
  type: ItemTypeDTO;
  unit: string;
  details: string | null;
} & ItemStats;

export type PartyDTO = {
  id: string;
  name: string;
  kind: PartyKind;
  phone: string | null;
  address: string | null;
};

export type TxLineDTO = {
  id: string;
  itemId: string;
  itemName: string;
  itemType: string; // "Rice": printed as "miniket (Rice)"
  quantity: number;
  unit: string;
  weightPerUnitKg: number | null; // null for kg items and older bills
  weightKg: number;
  ratePerKg: number;
  totalCost: number;
  lotRatePerKg: number | null; // sale lines: the purchase-price lot it came from
};

export type TransactionDTO = {
  id: string;
  type: TxType;
  date: string; // YYYY-MM-DD
  note: string | null;
  totalAmount: number;
  paid: number; // sum of payments put on this bill
  due: number; // totalAmount - paid
  settledAt: string | null; // ISO timestamp; null = still open
  payments: BillPaymentDTO[]; // oldest first: "on which date, how much"
  party: { id: string; name: string };
  lines: TxLineDTO[];
};

// One payment's share of a bill, as seen from the bill.
export type BillPaymentDTO = { paymentId: string; date: string; amount: number };

export type ItemSummary = {
  itemId: string;
  itemName: string;
  itemType: string;
  unit: string;
  quantity: number;
  weightKg: number;
  totalCost: number;
  avgRatePerKg: number;
};

export type PartySummary = { partyId: string; partyName: string; bills: number; totalAmount: number };

export type Summary = {
  bills: number;
  totalAmount: number;
  totalPaid: number;
  totalDue: number;
  totalWeightKg: number;
  byItem: ItemSummary[];
  byParty: PartySummary[];
};

export type TransactionsResponse = { transactions: TransactionDTO[]; summary: Summary };

// One payment, split across bills. type follows the bills: SALE = received
// from a customer, PURCHASE = paid to a supplier.
export type PaymentAllocationDTO = {
  transactionId: string;
  billDate: string; // YYYY-MM-DD
  billTotal: number;
  amount: number;
};

export type PaymentDTO = {
  id: string;
  type: TxType;
  date: string; // YYYY-MM-DD
  amount: number;
  note: string | null;
  party: { id: string; name: string };
  allocations: PaymentAllocationDTO[]; // oldest bill first
};

export type PaymentsResponse = { payments: PaymentDTO[]; summary: { count: number; totalAmount: number } };

// The user's shop, printed at the top of invoices.
export type ShopDTO = { name: string | null; address: string | null; phone: string | null };

// What a PDF prints at the top: the shop, or the user's name until it's set.
export type Letterhead = { name: string; address: string | null; phone: string | null };
