import { z } from "zod";
import { ISO_DATE_RE, PARTY_KINDS, TX_TYPES } from "@/lib/domain";
import { UNITS } from "@/lib/pricing";

// Request-body schemas. Empty strings from HTML forms become undefined so
// optional fields behave the same for web and mobile clients.

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const optionalNumber = z.number().nonnegative().optional().nullable();

export const isoDate = z.string().regex(ISO_DATE_RE, "Use YYYY-MM-DD");

export const credentialsSchema = z.object({
  name: optionalText(80),
  email: z.email().max(200),
  password: z.string().min(6, "Password must be at least 6 characters").max(200),
});

export const itemTypeSchema = z.object({
  name: z.string().trim().min(1, "Type name is required").max(60),
});

export const itemSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  typeId: z.string().min(1, "Pick a type of goods"),
  unit: z.enum(UNITS),
  details: optionalText(500),
});

export const partySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  kind: z.enum(PARTY_KINDS),
  phone: optionalText(30),
  address: optionalText(300),
});

export const lineSchema = z.object({
  itemId: z.string().min(1, "Pick an item"),
  quantity: z.number().positive("Quantity must be greater than 0"),
  weightPerUnitKg: optionalNumber,
  ratePerKg: z.number().positive("Price per kg must be greater than 0"),
  // Sales only: which price lot ("miniket-40rs/kg") to sell from. Optional
  // when the item has just one lot in stock. Ignored on purchases.
  lotRatePerKg: z.number().positive().optional().nullable(),
});

export const transactionSchema = z.object({
  type: z.enum(TX_TYPES),
  partyId: z.string().min(1, "Pick a person"),
  date: isoDate,
  note: optionalText(300),
  lines: z.array(lineSchema).min(1, "Add at least one item").max(100),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

// A payment split across one or more bills of the same person.
export const allocationSchema = z.object({
  transactionId: z.string().min(1, "Pick a bill"),
  amount: z.number().positive("Amount on a bill must be greater than 0"),
});

export const paymentSchema = z.object({
  type: z.enum(TX_TYPES), // SALE = received from a customer, PURCHASE = paid to a supplier
  partyId: z.string().min(1, "Pick a person"),
  date: isoDate,
  amount: z.number().positive("Enter an amount greater than 0"),
  note: optionalText(300),
  allocations: z.array(allocationSchema).min(1, "Put the amount on at least one bill").max(200),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

export const settleSchema = z.object({ settled: z.boolean() });

// Shop details for invoices; all optional.
export const shopSchema = z.object({
  name: optionalText(100),
  address: optionalText(300),
  phone: optionalText(30),
});
