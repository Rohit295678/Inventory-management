import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

declare global {
  var __prisma: PrismaClient | undefined;
  var __pgPool: Pool | undefined;
}

// Same pooled-adapter setup as MoneyMate. TLS is on by default (hosted DBs
// like Neon need it); set DATABASE_SSL="false" for the local dev Postgres.
function buildPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 30_000,
    keepAlive: true,
    ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
  });
}

function buildClient(): PrismaClient {
  const pool = global.__pgPool ?? buildPool();
  if (process.env.NODE_ENV !== "production") global.__pgPool = pool;

  const adapter = new PrismaPg(pool, {
    onPoolError: (err) => console.error("[pg.Pool] error:", err.message),
    onConnectionError: (err) => console.error("[pg.Connection] error:", err.message),
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma: PrismaClient = global.__prisma ?? buildClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = prisma;
}
