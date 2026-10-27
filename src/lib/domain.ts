// Domain vocabulary shared by API routes and UI. Strings (not Prisma enums)
// to match MoneyMate's schema style; these constants are the single source.

export const TX_TYPES = ["PURCHASE", "SALE"] as const;
export type TxType = (typeof TX_TYPES)[number];

export const PARTY_KINDS = ["SUPPLIER", "CUSTOMER", "BOTH"] as const;
export type PartyKind = (typeof PARTY_KINDS)[number];

export const PARTY_KIND_LABELS: Record<PartyKind, string> = {
  SUPPLIER: "Supplier (I buy from)",
  CUSTOMER: "Customer (I sell to)",
  BOTH: "Both",
};

// Which parties may appear on a bill of the given type.
export function partyKindsFor(type: TxType): PartyKind[] {
  return [type === "PURCHASE" ? "SUPPLIER" : "CUSTOMER", "BOTH"];
}

export const TX_COPY: Record<
  TxType,
  { title: string; noun: string; party: string; href: string; slug: string }
> = {
  PURCHASE: { title: "Purchases", noun: "purchase", party: "Supplier", href: "/purchases", slug: "purchases" },
  SALE: { title: "Sales", noun: "sale", party: "Customer", href: "/sales", slug: "sales" },
};

// Payments follow the bills they pay: SALE bills -> money received from
// customers, PURCHASE bills -> money paid to suppliers. One tab each.
export const PAYMENT_COPY: Record<TxType, { title: string; nav: string; verb: string; party: string; href: string }> = {
  SALE: { title: "Payments received", nav: "Received (Customers)", verb: "Received", party: "Customer", href: "/payments/received" },
  PURCHASE: { title: "Payments made", nav: "Paid (Suppliers)", verb: "Paid", party: "Supplier", href: "/payments/made" },
};

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Local-calendar "today" as YYYY-MM-DD (toISOString would use UTC and flip
// the date for anyone east of Greenwich after midnight… hi, India).
export function todayISO(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Postgres DATE columns come back as UTC-midnight Date objects.
export function toISODate(d: Date | string): string {
  return (typeof d === "string" ? d : d.toISOString()).slice(0, 10);
}
