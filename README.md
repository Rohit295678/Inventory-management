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
| GET/POST | `/api/item-types` | The user's own types of goods (A-Z) / create `{ name }` (409 if it exists, any case) |
| GET/POST | `/api/items` | List (with `stock`, `bought` totals, `suppliers`: per-supplier qty, kg, total, avg and min/max price/kg, and `lots`: in-stock price lots oldest first, each `{ ratePerKg, label, firstBoughtOn, stock, bought, suppliers }`; `label` is "miniket-40rs/kg" when 2+ lots are in stock, else the plain name) / create `{ name, typeId, unit, details? }` |
| PATCH/DELETE | `/api/items?id=` | Delete is refused while the item is on a bill |
| GET/POST | `/api/parties[?kind=SUPPLIER\|CUSTOMER]` | `{ name, kind, phone?, address? }` |
| PATCH/DELETE | `/api/parties?id=` | |
| GET | `/api/transactions?type=&from=&to=&partyId=&status=open` | → `{ transactions, summary }`; each bill has `paid`, `due`, `settledAt`, `payments[]` (date + amount); `status=open` = not settled |
| POST | `/api/transactions` | `{ type, partyId, date, note?, lines: [{ itemId, quantity, weightPerUnitKg?, ratePerKg, lotRatePerKg? }] }`. Sales: `lotRatePerKg` picks the price lot to sell from (needed when 2+ are in stock); can't sell more than the lot holds |
| PATCH | `/api/transactions?id=` | `{ settled: true\|false }`; settling needs the bill fully paid |
| DELETE | `/api/transactions?id=` | 409 while payments sit on the bill |
| GET | `/api/payments?type=SALE\|PURCHASE&from=&to=&partyId=` | → `{ payments, summary: { count, totalAmount } }`. SALE = received from customers, PURCHASE = paid to suppliers |
| POST | `/api/payments` | `{ type, partyId, date, amount, note?, allocations: [{ transactionId, amount }] }`; allocations must add up to `amount`, each ≤ what is due |
| DELETE | `/api/payments?id=` | The bills it paid become due (and unsettled) again |
| GET | `/api/reports/bill?id=` | `application/pdf`: one bill as a Sales/Purchase Invoice (shop letterhead, customer/supplier, items as "name (type)", payments by date, balance due) |
| GET | `/api/reports/pdf?type=&from=&to=&partyId=` | `application/pdf`: period report (API only; the web app uses per-bill invoices) |
| GET/PUT | `/api/shop` | `{ name, address, phone }` printed at the top of invoices; all optional (falls back to the user's name) |

**Pricing rule** (`src/lib/pricing.ts`, shared by server and form): items counted
in `kg` weigh their quantity; other units (packet, bag, ...) need `weightPerUnitKg`,
the weight of ONE unit, so total weight = `quantity × weightPerUnitKg`.
Price is always per kg: `totalCost = ratePerKg × weightPerUnitKg × quantity`.

## Database changes that `db:push` can't do safely

Schema changes that would lose data (e.g. turning a text column into a link
to another table) ship as idempotent SQL in `prisma/manual-migrations/`, the
same approach as MoneyMate. Run them in date order **before** `db:push`:

```bash
npm run db:sql -- prisma/manual-migrations/2026-10-25-item-types.sql
npm run db:push   # should now say "already in sync"
```

Each script is safe to run more than once.

## Theme

All colours live in **`src/app/globals.css`** as Tailwind v4 `@theme` tokens
(calm "petrol + butter" look): `brand-*` (petrol teal, anchored on `#1B455E`),
`accent-*` (butter yellow, `#F9D66B`), pastel `mint` / `lilac` / `aqua` badges,
warm neutrals `canvas` / `line`, and semantic `nav` / `nav-hover` / `nav-active` /
`on-nav*` for the dark surfaces. The font is the device's system font. Shapes (pill buttons, rounded
cards) live in `src/components/ui/styles.ts`. A full repaint means editing
those files (plus the two RGB constants at the top of `src/lib/pdf.ts`, since
jsPDF can't read CSS). Every text/background pair is measured AA (>= 6.8:1).

## Tests

```bash
npm test          # unit: pricing + summaries (node:test)
npm run test:api  # API e2e via the mobile Bearer-token flow (needs `npm run dev`)
npm run test:ui   # Playwright UI e2e on phone + desktop viewports, uses installed Chrome
```

UI test screenshots are saved to `test-results/screens/`.
