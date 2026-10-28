// End-to-end API test against a running server, using the MOBILE auth flow
// (Bearer token) to prove the backend is ready for the mobile app.
//   BASE_URL=http://localhost:3000 npm run test:api
import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local
let token = "";

async function call(method: string, path: string, body?: unknown, auth = true) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const isJson = res.headers.get("content-type")?.includes("json");
  return { status: res.status, headers: res.headers, data: isJson ? await res.json() : await res.arrayBuffer() };
}

const ids: Record<string, string> = {};

test("auth: register, login, me, reject bad token", async () => {
  const email = `e2e-${Date.now()}@example.com`;
  const reg = await call("POST", "/api/mobile/register", { name: "E2E Shop", email, password: "secret123" }, false);
  assert.equal(reg.status, 201);
  assert.ok(reg.data.token);

  assert.equal((await call("POST", "/api/mobile/register", { email, password: "secret123" }, false)).status, 409);
  assert.equal((await call("POST", "/api/mobile/login", { email, password: "wrong!!" }, false)).status, 401);

  const login = await call("POST", "/api/mobile/login", { email, password: "secret123" }, false);
  assert.equal(login.status, 200);
  token = login.data.token;

  const me = await call("GET", "/api/mobile/me");
  assert.equal(me.data.user.email, email);

  const bad = await fetch(`${BASE}/api/items`, { headers: { Authorization: "Bearer nope" } });
  assert.equal(bad.status, 401);
  assert.equal(bad.headers.get("access-control-allow-origin"), "*");
});

test("item types: per-user list, case-insensitive duplicates, sorted", async () => {
  const rice = await call("POST", "/api/item-types", { name: "Rice" });
  assert.equal(rice.status, 201);
  ids.typeRice = rice.data.id;
  ids.typePulse = (await call("POST", "/api/item-types", { name: "Pulse" })).data.id;

  assert.equal((await call("POST", "/api/item-types", { name: "rice" })).status, 409);
  assert.equal((await call("POST", "/api/item-types", { name: "  " })).status, 400);

  const list = await call("GET", "/api/item-types");
  assert.deepEqual(list.data.map((t: { name: string }) => t.name), ["Pulse", "Rice"]);
});

test("item types: another user can't see or use mine", async () => {
  const mine = token;
  token = (await call("POST", "/api/mobile/register", { email: `e2e-other-${Date.now()}@example.com`, password: "secret123" }, false)).data.token;
  try {
    assert.deepEqual((await call("GET", "/api/item-types")).data, []);
    const steal = await call("POST", "/api/items", { name: "Sneaky", typeId: ids.typeRice, unit: "kg" });
    assert.equal(steal.status, 400);
    // ...and the same name is fine for them: lists are per user, not global.
    assert.equal((await call("POST", "/api/item-types", { name: "Rice" })).status, 201);
  } finally {
    token = mine;
  }
});

test("items: create, reject duplicate & invalid, update", async () => {
  const rice = await call("POST", "/api/items", { name: "Basmati Rice", typeId: ids.typeRice, unit: "packet", details: "25kg bag" });
  assert.equal(rice.status, 201);
  assert.deepEqual(rice.data.type, { id: ids.typeRice, name: "Rice" });
  ids.rice = rice.data.id;

  const dal = await call("POST", "/api/items", { name: "Toor Dal", typeId: ids.typePulse, unit: "kg" });
  ids.dal = dal.data.id;

  assert.equal((await call("POST", "/api/items", { name: "Basmati Rice", typeId: ids.typeRice, unit: "kg" })).status, 409);
  assert.equal((await call("POST", "/api/items", { name: "", typeId: ids.typeRice, unit: "kg" })).status, 400);
  assert.equal((await call("POST", "/api/items", { name: "X", typeId: ids.typeRice, unit: "tonne" })).status, 400);
  assert.equal((await call("POST", "/api/items", { name: "X", unit: "kg" })).status, 400); // no type

  const upd = await call("PATCH", `/api/items?id=${ids.dal}`, { name: "Toor Dal", typeId: ids.typePulse, unit: "kg", details: "Grade A" });
  assert.equal(upd.data.details, "Grade A");
});

test("parties: create supplier & customer, filter by kind", async () => {
  ids.supplier = (await call("POST", "/api/parties", { name: "Ramesh Traders", kind: "SUPPLIER", phone: "9999999999" })).data.id;
  ids.customer = (await call("POST", "/api/parties", { name: "Sita Stores", kind: "CUSTOMER" })).data.id;

  const suppliers = await call("GET", "/api/parties?kind=SUPPLIER");
  assert.deepEqual(suppliers.data.map((p: { name: string }) => p.name), ["Ramesh Traders"]);
});

test("purchases: multi-item bill priced per kg", async () => {
  const res = await call("POST", "/api/transactions", {
    type: "PURCHASE",
    partyId: ids.supplier,
    date: today,
    lines: [
      { itemId: ids.rice, quantity: 50, weightPerUnitKg: 25, ratePerKg: 50 }, // 50 x 25 kg x 50/kg
      { itemId: ids.dal, quantity: 20, ratePerKg: 90 }, // 20 kg @ 90/kg
    ],
  });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  assert.equal(res.data.totalAmount, 64300);
  assert.equal(res.data.lines[0].totalCost, 62500);
  assert.equal(res.data.lines[0].weightPerUnitKg, 25);
  assert.equal(res.data.lines[0].weightKg, 1250);
  assert.equal(res.data.lines[1].totalCost, 1800);
  assert.equal(res.data.lines[1].weightPerUnitKg, null);
});

test("transactions: business-rule rejections", async () => {
  const base = { type: "PURCHASE", partyId: ids.supplier, date: today };
  // customer used on a purchase
  assert.equal((await call("POST", "/api/transactions", { ...base, partyId: ids.customer, lines: [{ itemId: ids.dal, quantity: 1, ratePerKg: 1 }] })).status, 400);
  // packet item without per-packet weight
  assert.equal((await call("POST", "/api/transactions", { ...base, lines: [{ itemId: ids.rice, quantity: 1, ratePerKg: 1 }] })).status, 400);
  // no price at all
  assert.equal((await call("POST", "/api/transactions", { ...base, lines: [{ itemId: ids.dal, quantity: 1 }] })).status, 400);
  // total cost instead of price per kg is no longer accepted
  assert.equal((await call("POST", "/api/transactions", { ...base, lines: [{ itemId: ids.dal, quantity: 1, totalCost: 100 }] })).status, 400);
  // empty bill
  assert.equal((await call("POST", "/api/transactions", { ...base, lines: [] })).status, 400);
});

test("sales: sell part of the stock, stock updates", async () => {
  const sale = await call("POST", "/api/transactions", {
    type: "SALE",
    partyId: ids.customer,
    date: today,
    lines: [{ itemId: ids.rice, quantity: 10, weightPerUnitKg: 25, ratePerKg: 60 }], // 60 x 25 x 10
  });
  assert.equal(sale.status, 201);
  assert.equal(sale.data.totalAmount, 15000);

  const items = await call("GET", "/api/items");
  const rice = items.data.find((i: { id: string }) => i.id === ids.rice);
  assert.deepEqual(rice.stock, { quantity: 40, weightKg: 1000 });
  // What was paid to suppliers (sales don't count here).
  assert.deepEqual(rice.bought, { quantity: 50, weightKg: 1250, totalCost: 62500, avgRatePerKg: 50 });
  const dal = items.data.find((i: { id: string }) => i.id === ids.dal);
  assert.deepEqual(dal.bought, { quantity: 20, weightKg: 20, totalCost: 1800, avgRatePerKg: 90 });
});

test("daily view: today's purchases summary", async () => {
  const res = await call("GET", `/api/transactions?type=PURCHASE&from=${today}&to=${today}`);
  assert.equal(res.data.summary.bills, 1);
  assert.equal(res.data.summary.totalAmount, 64300);
  assert.equal(res.data.summary.byItem.length, 2);

  const forCustomer = await call("GET", `/api/transactions?type=SALE&partyId=${ids.customer}`);
  assert.equal(forCustomer.data.transactions.length, 1);
});

test("items: same item from two suppliers at different prices", async () => {
  ids.supplier2 = (await call("POST", "/api/parties", { name: "Shyam & Co", kind: "SUPPLIER" })).data.id;
  const buy = (partyId: string, quantity: number, weightPerUnitKg: number, ratePerKg: number) =>
    call("POST", "/api/transactions", {
      type: "PURCHASE",
      partyId,
      date: today,
      lines: [{ itemId: ids.rice, quantity, weightPerUnitKg, ratePerKg }],
    });
  assert.equal((await buy(ids.supplier2, 10, 26, 44)).status, 201); // 260 kg = 11,440
  assert.equal((await buy(ids.supplier, 5, 25, 52)).status, 201); // Ramesh again, dearer: 125 kg = 6,500

  const rice = (await call("GET", "/api/items")).data.find((i: { id: string }) => i.id === ids.rice);
  // 62,500 + 11,440 + 6,500 = 80,440 for 1,250 + 260 + 125 = 1,635 kg -> 49.20/kg (weighted)
  assert.deepEqual(rice.bought, { quantity: 65, weightKg: 1635, totalCost: 80440, avgRatePerKg: 49.2 });
  assert.deepEqual(rice.suppliers, [
    // Ramesh: 69,000 / 1,375 kg = 50.18, paid 50 then 52 -> range
    { partyId: ids.supplier, partyName: "Ramesh Traders", quantity: 55, weightKg: 1375, totalCost: 69000, avgRatePerKg: 50.18, minRatePerKg: 50, maxRatePerKg: 52 },
    { partyId: ids.supplier2, partyName: "Shyam & Co", quantity: 10, weightKg: 260, totalCost: 11440, avgRatePerKg: 44, minRatePerKg: 44, maxRatePerKg: 44 },
  ]);
  assert.deepEqual(rice.stock, { quantity: 55, weightKg: 1385 }); // 65 bought - 10 sold
});

// ---- Price lots: rice is now in stock at 44, 50 and 52 rs/kg.
type Lot = { label: string; ratePerKg: number; stock: { quantity: number; weightKg: number } };
const riceLots = async (): Promise<[string, number, number][]> =>
  (await call("GET", "/api/items")).data
    .find((i: { id: string }) => i.id === ids.rice)
    .lots.map((l: Lot) => [l.label, l.stock.quantity, l.stock.weightKg]);

test("lots: one row per purchase price, each with its own stock", async () => {
  // Oldest first (all today, so in the order they were entered). The first
  // sale (10) came off the 50 lot, the only one then.
  assert.deepEqual(await riceLots(), [
    ["Basmati Rice-50rs/kg", 40, 1000],
    ["Basmati Rice-44rs/kg", 10, 260],
    ["Basmati Rice-52rs/kg", 5, 125],
  ]);
});

test("lots: a sale comes off the lot I pick, never more than it holds", async () => {
  ids.lotCustomer = (await call("POST", "/api/parties", { name: "Lot Buyer", kind: "CUSTOMER" })).data.id;
  const sell = (...lines: { quantity: number; lotRatePerKg?: number; weightPerUnitKg?: number }[]) =>
    call("POST", "/api/transactions", {
      type: "SALE",
      partyId: ids.lotCustomer,
      date: today,
      lines: lines.map((l) => ({ itemId: ids.rice, weightPerUnitKg: 25, ratePerKg: 60, ...l })),
    });

  const noLot = await sell({ quantity: 1 });
  assert.equal(noLot.status, 400);
  assert.match(noLot.data.error, /Pick which Basmati Rice: Basmati Rice-50rs\/kg or Basmati Rice-44rs\/kg or Basmati Rice-52rs\/kg/);

  const tooMany = await sell({ quantity: 6, lotRatePerKg: 52 });
  assert.equal(tooMany.status, 400);
  assert.match(tooMany.data.error, /Only 5 packets of Basmati Rice-52rs\/kg in stock/);
  assert.equal((await sell({ quantity: 3, lotRatePerKg: 52 }, { quantity: 3, lotRatePerKg: 52 })).status, 400); // 6 over two lines
  assert.equal((await sell({ quantity: 1, lotRatePerKg: 99 })).status, 400); // no such lot

  const ok = await sell({ quantity: 3, lotRatePerKg: 44, weightPerUnitKg: 26 }); // that lot's packets are 26 kg
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.equal(ok.data.lines[0].lotRatePerKg, 44);
  assert.deepEqual(await riceLots(), [
    ["Basmati Rice-50rs/kg", 40, 1000],
    ["Basmati Rice-44rs/kg", 7, 182], // only this one went down
    ["Basmati Rice-52rs/kg", 5, 125],
  ]);
});

// ---- Payments: Sita Stores owes 15,000 for the rice sale and pays in parts.
type Bill = { id: string; totalAmount: number; paid: number; due: number; settledAt: string | null };
const openSaleBills = async (): Promise<Bill[]> =>
  (await call("GET", `/api/transactions?type=SALE&partyId=${ids.customer}&status=open`)).data.transactions;
const pay = (amount: number, allocations: { transactionId: string; amount: number }[], extra: object = {}) =>
  call("POST", "/api/payments", { type: "SALE", partyId: ids.customer, date: today, amount, allocations, ...extra });

test("payments: open bills come oldest first with paid/due", async () => {
  const small = await call("POST", "/api/transactions", {
    type: "SALE",
    partyId: ids.customer,
    date: today,
    lines: [{ itemId: ids.rice, quantity: 2, weightPerUnitKg: 25, ratePerKg: 10, lotRatePerKg: 52 }], // 500
  });
  ids.smallSale = small.data.id;

  const bills = await openSaleBills();
  assert.deepEqual(bills.map((b) => [b.totalAmount, b.paid, b.due]), [
    [15000, 0, 15000], // oldest first
    [500, 0, 500],
  ]);
  ids.bigSale = bills[0].id;
});

test("payments: part payments over days reduce what is due", async () => {
  const first = await pay(2000, [{ transactionId: ids.bigSale, amount: 2000 }], { note: "cash" });
  assert.equal(first.status, 201, JSON.stringify(first.data));
  assert.deepEqual(first.data.allocations.map((a: { amount: number }) => a.amount), [2000]);
  assert.equal((await pay(1000, [{ transactionId: ids.bigSale, amount: 1000 }], { date: "2026-01-02" })).status, 201);

  const big = (await openSaleBills()).find((b) => b.id === ids.bigSale)!;
  assert.deepEqual([big.paid, big.due], [3000, 12000]);

  // Sales page summary shows it too
  const sales = await call("GET", `/api/transactions?type=SALE&partyId=${ids.customer}`);
  assert.deepEqual([sales.data.summary.totalPaid, sales.data.summary.totalDue], [3000, 12500]);
});

test("payments: one payment split across two bills", async () => {
  const res = await pay(600, [
    { transactionId: ids.smallSale, amount: 500 }, // clears the small bill
    { transactionId: ids.bigSale, amount: 100 },
  ]);
  assert.equal(res.status, 201, JSON.stringify(res.data));
  ids.splitPayment = res.data.id;
  const bills = await openSaleBills();
  assert.deepEqual(bills.map((b) => b.due), [11900, 0]);
});

test("payments: rule violations are refused", async () => {
  const big = (amount: number) => [{ transactionId: ids.bigSale, amount }];
  assert.equal((await pay(500, big(400))).status, 400); // bills don't add up to the amount
  assert.equal((await pay(20000, big(20000))).status, 400); // more than is due
  assert.equal((await pay(1, [{ transactionId: ids.smallSale, amount: 1 }])).status, 400); // nothing due
  assert.equal((await pay(2, [...big(1), ...big(1)])).status, 400); // same bill twice
  assert.equal((await pay(10, [])).status, 400); // no bills
  assert.equal((await pay(10, big(10), { partyId: ids.supplier })).status, 400); // supplier on a customer payment

  const purchase = (await call("GET", "/api/transactions?type=PURCHASE")).data.transactions[0];
  assert.equal((await pay(10, [{ transactionId: purchase.id, amount: 10 }])).status, 400); // not this person's sale bill
});

test("settle: only fully paid bills, then they leave the open list", async () => {
  const settle = (id: string, settled = true) => call("PATCH", `/api/transactions?id=${id}`, { settled });
  assert.equal((await settle(ids.bigSale)).status, 400); // 11,900 still due

  const done = await settle(ids.smallSale);
  assert.equal(done.status, 200);
  assert.ok(done.data.settledAt);
  assert.deepEqual((await openSaleBills()).map((b) => b.id), [ids.bigSale]);

  // Can't pay a settled bill, and can't delete a bill that has payments
  assert.equal((await pay(1, [{ transactionId: ids.smallSale, amount: 1 }])).status, 400);
  assert.equal((await call("DELETE", `/api/transactions?id=${ids.smallSale}`)).status, 409);
});

test("payments: deleting one re-opens the bills it paid", async () => {
  assert.equal((await call("DELETE", `/api/payments?id=${ids.splitPayment}`)).status, 200);
  const bills = await openSaleBills();
  const small = bills.find((b) => b.id === ids.smallSale)!;
  assert.deepEqual([small.settledAt, small.due], [null, 500]); // back to open and due
  assert.equal(bills.find((b) => b.id === ids.bigSale)!.due, 12000);
});

test("payments: list oldest first, filter by date and person", async () => {
  const all = await call("GET", "/api/payments?type=SALE");
  assert.deepEqual(all.data.summary, { count: 2, totalAmount: 3000 });
  assert.deepEqual(all.data.payments.map((p: { amount: number }) => p.amount), [1000, 2000]); // 2 Jan, then today
  assert.equal(all.data.payments[1].party.name, "Sita Stores");
  assert.equal(all.data.payments[1].note, "cash");

  const todayOnly = await call("GET", `/api/payments?type=SALE&from=${today}&to=${today}`);
  assert.equal(todayOnly.data.summary.count, 1);
  assert.equal((await call("GET", `/api/payments?type=SALE&partyId=${ids.supplier}`)).data.summary.count, 0);
  assert.equal((await call("GET", "/api/payments?type=PURCHASE")).data.summary.count, 0); // separate tab
});

test("payments: each bill lists its payments (date + amount), and so does the PDF", async () => {
  const big = (await openSaleBills()).find((b) => b.id === ids.bigSale) as Bill & { payments: { date: string; amount: number }[] };
  assert.deepEqual(
    big.payments.map((p) => [p.date, p.amount]),
    [
      ["2026-01-02", 1000], // oldest first
      [today, 2000],
    ]
  );

  const pdf = await call("GET", `/api/reports/pdf?type=SALE&partyId=${ids.customer}`);
  assert.equal(pdf.status, 200);
  const text = new TextDecoder("latin1").decode(pdf.data as ArrayBuffer);
  assert.ok(text.includes("Received on 02 Jan 2026"), "payment date line missing");
  assert.ok(text.includes("Rs. 1,000.00") && text.includes("Rs. 2,000.00"), "payment amounts missing");
  assert.ok(text.includes("Due Rs. 12,000.00"), "due line missing");
  assert.ok(text.includes("Nothing received yet"), "unpaid bill status missing");
});

test("pdf: downloads a real PDF", async () => {
  const res = await call("GET", `/api/reports/pdf?type=PURCHASE&from=${today}&to=${today}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "application/pdf");
  assert.match(res.headers.get("content-disposition") ?? "", /purchases-.*\.pdf/);
  const head = new TextDecoder().decode((res.data as ArrayBuffer).slice(0, 5));
  assert.equal(head, "%PDF-");
});

test("deletes: guarded while in use, then allowed", async () => {
  assert.equal((await call("DELETE", `/api/items?id=${ids.dal}`)).status, 409);
  assert.equal((await call("DELETE", `/api/parties?id=${ids.supplier}`)).status, 409);

  const purchases = await call("GET", "/api/transactions?type=PURCHASE");
  for (const tx of purchases.data.transactions) {
    assert.equal((await call("DELETE", `/api/transactions?id=${tx.id}`)).status, 200);
  }
  assert.equal((await call("DELETE", `/api/items?id=${ids.dal}`)).status, 200);
  assert.equal((await call("DELETE", `/api/parties?id=${ids.supplier}`)).status, 200);
});
