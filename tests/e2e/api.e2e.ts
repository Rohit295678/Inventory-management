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
  assert.equal((await call("DELETE", `/api/transactions?id=${purchases.data.transactions[0].id}`)).status, 200);
  assert.equal((await call("DELETE", `/api/items?id=${ids.dal}`)).status, 200);
  assert.equal((await call("DELETE", `/api/parties?id=${ids.supplier}`)).status, 200);
});
