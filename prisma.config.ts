import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 config (same layout as MoneyMate). `url` is what `prisma db push`
// / `prisma migrate` use, so it points at DIRECT_URL (unpooled in prod).
// The runtime connection (DATABASE_URL) is wired up in src/lib/db.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
