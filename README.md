# StockBook: Inventory Manager

Mobile-first web app to record goods you **buy** and **sell**, see **daily totals**,
track **stock on hand**, and download **PDF reports**. The backend is a plain
JSON API built so a React Native / Expo app can use it as-is (same pattern as MoneyMate).

## Features

- **Login / register** (email + password)
- **Items & stock**: add goods (name, type of goods, counted in kg/packet/bag/box/piece, details); stock = bought − sold
- **People**: suppliers (I buy from), customers (I sell to), or both
- **Purchases & Sales**: one bill per person per visit, with many items per bill
  - Each line: quantity, total kg (for packets/bags), and **either** price per kg **or** total cost; the other is calculated
  - Prices are stored per bill, so they can change every day
- **Date-wise view**: Today / Last 7 days / This month / custom range / per person, with item-wise and person-wise totals
- **PDF download** for exactly what's on screen

## Tech stack (mirrors `money/moneymate`)

| Layer     | Choice                                              |
| --------- | --------------------------------------------------- |
| Framework | Next.js 16 (App Router) + TypeScript                |
| Styling   | Tailwind CSS v4                                     |
| Database  | PostgreSQL via Prisma 7 + `@prisma/adapter-pg`       |
| Auth      | NextAuth v4 (web cookie) + Bearer JWT (`/api/mobile/*`) |
| PDF       | jsPDF + jspdf-autotable (server-side)               |
| Validation| zod                                                 |

## Getting started

```bash
npm install
cp .env.example .env              # then set NEXTAUTH_SECRET (openssl rand -base64 32)
```

Then pick a database (set it in `.env`, see `.env.example`):

**Neon (hosted, like MoneyMate, but its own database).** In the Neon console,
create a database named `inv_mgmt` (Databases > New database). Copy the pooled
connection string into `DATABASE_URL`, the direct (non-pooled) one into
`DIRECT_URL`, and delete the `DATABASE_SSL` line. Then:

```bash
npm run db:push   # create the tables in Neon
npm run dev
```

**Local Postgres (offline dev)** on port 5433, data in `.pgdata/` (gitignored):

```bash
initdb -D .pgdata -U postgres --auth=trust -E UTF8   # first time only
npm run db:start
createdb -h localhost -p 5433 -U postgres inv_mgmt  # first time only
npm run db:push
npm run dev
```

`npm run dev` starts the local Postgres automatically when `.env` points at
localhost, and skips it for Neon.

Open http://localhost:3000 and register.

## API (shared by web and mobile)

Every `/api/*` route accepts **either** the NextAuth cookie (web) **or**
`Authorization: Bearer <token>` (mobile) and sends CORS headers.

| Method | Path | Notes |
| ------ | ---- | ----- |
| POST | `/api/mobile/register` | `{ name?, email, password }` → `{ token, user }` |
| POST | `/api/mobile/login` | `{ email, password }` → `{ token, user }` |
| GET | `/api/mobile/me` | Validate a stored token |
| GET/POST | `/api/items` | List (with `stock`) / create `{ name, category, unit, details? }` |
| PATCH/DELETE | `/api/items?id=` | Delete is refused while the item is on a bill |
| GET/POST | `/api/parties[?kind=SUPPLIER\|CUSTOMER]` | `{ name, kind, phone?, address? }` |
| PATCH/DELETE | `/api/parties?id=` | |
| GET | `/api/transactions?type=&from=&to=&partyId=` | → `{ transactions, summary }` |
| POST | `/api/transactions` | `{ type, partyId, date, note?, lines: [{ itemId, quantity, weightKg?, ratePerKg?, totalCost? }] }` |
| DELETE | `/api/transactions?id=` | |
| GET | `/api/reports/pdf?type=&from=&to=&partyId=` | `application/pdf` |

**Pricing rule** (`src/lib/pricing.ts`, shared by server and form): items counted
in `kg` weigh their quantity; other units need `weightKg`. If `totalCost` is sent it
wins and `ratePerKg` is derived, otherwise `totalCost = ratePerKg × weightKg`.

## Theme

All colours live in **`src/app/globals.css`** as Tailwind v4 `@theme` tokens
(Flipkart-inspired): `brand-*` (blue, anchored on `#2874F0`), `accent-*` (yellow,
`#FFE11B`) and semantic `nav` / `nav-active` / `on-nav` / `on-nav-muted` for the
blue bars. Components only use those tokens plus neutral `slate`, so a full
repaint means editing that one file (plus the two RGB constants at the top of
`src/lib/pdf.ts`, since jsPDF can't read CSS).

## Tests

```bash
npm test          # unit: pricing + summaries (node:test)
npm run test:api  # API e2e via the mobile Bearer-token flow (needs `npm run dev`)
npm run test:ui   # Playwright UI e2e on phone + desktop viewports, uses installed Chrome
```

UI test screenshots are saved to `test-results/screens/`.
