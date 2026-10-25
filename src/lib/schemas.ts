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

export const itemSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  category: z.string().trim().min(1, "Type of goods is required").max(60),
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
  ratePerKg: optionalNumber,
  totalCost: optionalNumber,
});

export const transactionSchema = z.object({
  type: z.enum(TX_TYPES),
  partyId: z.string().min(1, "Pick a person"),
  date: isoDate,
  note: optionalText(300),
  lines: z.array(lineSchema).min(1, "Add at least one item").max(100),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
