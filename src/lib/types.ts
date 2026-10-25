// JSON shapes returned by the API. Shared by the web UI today and the
// mobile app tomorrow — change with care.

import type { PartyKind, TxType } from "@/lib/domain";

export type Stock = { quantity: number; weightKg: number };

// What was paid to suppliers for an item, across all purchases.
export type Bought = Stock & { totalCost: number; avgRatePerKg: number };

export type ItemStats = { stock: Stock; bought: Bought };

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
  quantity: number;
  unit: string;
  weightPerUnitKg: number | null; // null for kg items and older bills
  weightKg: number;
  ratePerKg: number;
  totalCost: number;
};

export type TransactionDTO = {
  id: string;
  type: TxType;
  date: string; // YYYY-MM-DD
  note: string | null;
  totalAmount: number;
  party: { id: string; name: string };
  lines: TxLineDTO[];
};

export type ItemSummary = {
  itemId: string;
  itemName: string;
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
  totalWeightKg: number;
  byItem: ItemSummary[];
  byParty: PartySummary[];
};

export type TransactionsResponse = { transactions: TransactionDTO[]; summary: Summary };
