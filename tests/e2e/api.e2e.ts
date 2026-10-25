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

test("items: create, reject duplicate & invalid, update", async () => {
  const rice = await call("POST", "/api/items", { name: "Basmati Rice", category: "Rice", unit: "packet", details: "25kg bag" });
  assert.equal(rice.status, 201);
  ids.rice = rice.data.id;

  const dal = await call("POST", "/api/items", { name: "Toor Dal", category: "Pulse", unit: "kg" });
  ids.dal = dal.data.id;

  assert.equal((await call("POST", "/api/items", { name: "Basmati Rice", category: "Rice", unit: "kg" })).status, 409);
  assert.equal((await call("POST", "/api/items", { name: "", category: "Rice", unit: "kg" })).status, 400);
  assert.equal((await call("POST", "/api/items", { name: "X", category: "Rice", unit: "tonne" })).status, 400);

  const upd = await call("PATCH", `/api/items?id=${ids.dal}`, { name: "Toor Dal", category: "Pulse", unit: "kg", details: "Grade A" });
  assert.equal(upd.data.details, "Grade A");
});

test("parties: create supplier & customer, filter by kind", async () => {
  ids.supplier = (await call("POST", "/api/parties", { name: "Ramesh Traders", kind: "SUPPLIER", phone: "9999999999" })).data.id;
  ids.customer = (await call("POST", "/api/parties", { name: "Sita Stores", kind: "CUSTOMER" })).data.id;

  const suppliers = await call("GET", "/api/parties?kind=SUPPLIER");
  assert.deepEqual(suppliers.data.map((p: { name: string }) => p.name), ["Ramesh Traders"]);
});

test("purchases: multi-item bill with both price formats", async () => {
  const res = await call("POST", "/api/transactions", {
    type: "PURCHASE",
    partyId: ids.supplier,
    date: today,
    lines: [
      { itemId: ids.rice, quantity: 50, weightKg: 1250, totalCost: 62500 }, // 50 packets, total given
      { itemId: ids.dal, quantity: 20, ratePerKg: 90 }, // 20 kg @ 90/kg
    ],
  });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  assert.equal(res.data.totalAmount, 64300);
  assert.equal(res.data.lines[0].ratePerKg, 50);
  assert.equal(res.data.lines[1].totalCost, 1800);
});

test("transactions: business-rule rejections", async () => {
  const base = { type: "PURCHASE", partyId: ids.supplier, date: today };
  // customer used on a purchase
  assert.equal((await call("POST", "/api/transactions", { ...base, partyId: ids.customer, lines: [{ itemId: ids.dal, quantity: 1, ratePerKg: 1 }] })).status, 400);
  // packet item without weight
  assert.equal((await call("POST", "/api/transactions", { ...base, lines: [{ itemId: ids.rice, quantity: 1, ratePerKg: 1 }] })).status, 400);
  // no price at all
  assert.equal((await call("POST", "/api/transactions", { ...base, lines: [{ itemId: ids.dal, quantity: 1 }] })).status, 400);
  // empty bill
  assert.equal((await call("POST", "/api/transactions", { ...base, lines: [] })).status, 400);
});

test("sales: sell part of the stock, stock updates", async () => {
  const sale = await call("POST", "/api/transactions", {
    type: "SALE",
    partyId: ids.customer,
    date: today,
    lines: [{ itemId: ids.rice, quantity: 10, weightKg: 250, ratePerKg: 60 }],
  });
  assert.equal(sale.status, 201);
  assert.equal(sale.data.totalAmount, 15000);

  const items = await call("GET", "/api/items");
  const rice = items.data.find((i: { id: string }) => i.id === ids.rice);
  assert.deepEqual(rice.stock, { quantity: 40, weightKg: 1000 });
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
