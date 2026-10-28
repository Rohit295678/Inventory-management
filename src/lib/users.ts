import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { Letterhead, ShopDTO } from "@/lib/types";

// Single home for credential logic, shared by NextAuth (web), /api/register
// and the /api/mobile/* routes. MoneyMate copy-pasted this; we don't.

export type PublicUser = { id: string; name: string | null; email: string };

const PUBLIC_FIELDS = { id: true, name: true, email: true } as const;

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class EmailTakenError extends Error {
  constructor() {
    super("Email already in use");
  }
}

export async function createUser(input: {
  name?: string | null;
  email: string;
  password: string;
}): Promise<PublicUser> {
  const email = normaliseEmail(input.email);
  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) throw new EmailTakenError();

  return prisma.user.create({
    data: {
      name: input.name?.trim() || null,
      email,
      password: await bcrypt.hash(input.password, 12),
    },
    select: PUBLIC_FIELDS,
  });
}

export async function verifyCredentials(email: string, password: string): Promise<PublicUser | null> {
  const user = await prisma.user.findUnique({ where: { email: normaliseEmail(email) } });
  if (!user || !(await bcrypt.compare(password, user.password))) return null;
  return { id: user.id, name: user.name, email: user.email };
}

export function findPublicUser(id: string): Promise<PublicUser | null> {
  return prisma.user.findUnique({ where: { id }, select: PUBLIC_FIELDS });
}

// ---- Shop details (invoice letterhead)
const SHOP_FIELDS = { shopName: true, shopAddress: true, shopPhone: true } as const;
type ShopRow = { shopName: string | null; shopAddress: string | null; shopPhone: string | null };
const toShop = (u: ShopRow): ShopDTO => ({ name: u.shopName, address: u.shopAddress, phone: u.shopPhone });

export async function getShop(userId: string): Promise<ShopDTO | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: SHOP_FIELDS });
  return user && toShop(user);
}

export async function updateShop(userId: string, shop: ShopDTO): Promise<ShopDTO> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { shopName: shop.name, shopAddress: shop.address, shopPhone: shop.phone },
    select: SHOP_FIELDS,
  });
  return toShop(user);
}

// PDF header: the shop's name, or the user's own name/email until it's set.
export async function getLetterhead(userId: string): Promise<Letterhead> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { ...SHOP_FIELDS, name: true, email: true } });
  return {
    name: user?.shopName || user?.name || user?.email || "",
    address: user?.shopAddress ?? null,
    phone: user?.shopPhone ?? null,
  };
}
