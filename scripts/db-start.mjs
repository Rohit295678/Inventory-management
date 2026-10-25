// Start the project-local Postgres, but ONLY when .env points at it.
// With a hosted database (e.g. Neon) this is a no-op, so `npm run dev`
// stays a single command in both setups.
import "dotenv/config";
import { execSync } from "node:child_process";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

let url;
try {
  url = new URL(process.env.DATABASE_URL ?? "");
} catch {
  console.error("DATABASE_URL is missing or invalid in .env (see .env.example).");
  process.exit(1);
}

if (!LOCAL_HOSTS.has(url.hostname)) {
  console.log(`Using hosted database at ${url.hostname}; not starting local Postgres.`);
  process.exit(0);
}

try {
  execSync("pg_ctl -D .pgdata status", { stdio: "ignore" }); // exit 0 = already running
} catch {
  const port = url.port || "5432";
  execSync(`pg_ctl -D .pgdata -o "-p ${port} -k /tmp" -l .pgdata/server.log -w start`, { stdio: "inherit" });
}
