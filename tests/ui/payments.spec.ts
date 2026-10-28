import { expect, test, type Page } from "@playwright/test";
import { pageAlert, register, shot, tile } from "./helpers";

// Customer pays a Rs 15,000 bill in parts over days, then it gets settled.
// Setup goes through the API (same signed-in session) to keep this quick;
// the payment itself is done through the screens, like the shop owner would.

const iso = (daysAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD, local
};

async function seed(page: Page) {
  const post = async (path: string, data: object) => {
    const res = await page.request.post(path, { data });
    expect(res.status(), `${path}: ${await res.text()}`).toBe(201);
    return res.json();
  };
  const type = await post("/api/item-types", { name: "Rice" });
  const rice = await post("/api/items", { name: "Sona Rice", typeId: type.id, unit: "kg" });
  const sita = await post("/api/parties", { name: "Sita Stores", kind: "CUSTOMER" });
  const ramesh = await post("/api/parties", { name: "Ramesh Traders", kind: "SUPPLIER" });
  // Stock first: you can only sell what you have (one price lot -> picked automatically)
  await post("/api/transactions", { type: "PURCHASE", partyId: ramesh.id, date: iso(4), lines: [{ itemId: rice.id, quantity: 200, ratePerKg: 80 }] });
  const sale = (date: string, quantity: number) =>
    post("/api/transactions", { type: "SALE", partyId: sita.id, date, lines: [{ itemId: rice.id, quantity, ratePerKg: 100 }] });
  await sale(iso(3), 150); // Rs 15,000, three days ago
  await sale(iso(0), 5); // Rs 500, today
}

test("payments received: pay in parts, settle, see it on sales", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept()); // confirm() for settle
  await register(page, "pay");
  await seed(page);

  // 1st payment: Rs 2,000 on the big bill
  await page.goto("/payments/received");
  await expect(page.getByRole("heading", { name: "Payments received" })).toBeVisible();
  await page.getByRole("button", { name: "New payment" }).click();
  const form = page.getByRole("form", { name: "New payment received" });
  await form.getByLabel("Customer").selectOption({ label: "Sita Stores" });
  await form.getByLabel("Amount received (₹)").fill("2000");

  const bills = form.getByRole("group");
  await expect(bills).toHaveCount(2);
  await expect(bills.nth(0)).toContainText("Total ₹15,000.00"); // oldest first
  await expect(bills.nth(1)).toContainText("Total ₹500.00");
  await expect(bills.nth(0).locator("legend")).toHaveText(/^\d{2} \w{3} \d{4}$/); // just the date
  await expect(form.getByText("₹2,000.00 still to put on bills")).toBeVisible();

  const bigBill = bills.filter({ hasText: "Total ₹15,000.00" });
  await bigBill.getByRole("button", { name: "Pay full" }).click(); // takes what's left: 2,000 (not 15,000)
  await expect(bigBill.getByLabel("Amount for this bill")).toHaveValue("2000");
  await expect(form.getByText("Matches the amount")).toBeVisible();
  await shot(page, "07-payment-form");
  await form.getByRole("button", { name: "Save payment" }).click();
  await expect(page.getByRole("article", { name: "Sita Stores, ₹2,000.00" })).toBeVisible();

  // 2nd payment: Rs 13,500 spread oldest first -> 13,000 big bill + 500 small bill
  await page.getByRole("button", { name: "New payment" }).click();
  await form.getByLabel("Customer").selectOption({ label: "Sita Stores" });
  await expect(bigBill).toContainText("Due ₹13,000.00");
  await expect(bigBill).toContainText("Already received ₹2,000.00");
  await form.getByLabel("Amount received (₹)").fill("13500");
  await form.getByRole("button", { name: "Fill oldest bills first" }).click();
  await expect(bigBill.getByLabel("Amount for this bill")).toHaveValue("13000");
  await expect(bills.filter({ hasText: "Total ₹500.00" }).getByLabel("Amount for this bill")).toHaveValue("500");
  await form.getByRole("button", { name: "Save payment" }).click();
  await expect(page.getByRole("article", { name: "Sita Stores, ₹13,500.00" })).toBeVisible();
  await expect(tile(page, "Total received")).toHaveText("₹15,500.00"); // today's total
  await shot(page, "08-payments-list");

  // Both bills fully paid -> settle the big one; it leaves the payment screen
  await page.getByRole("button", { name: "New payment" }).click();
  await form.getByLabel("Customer").selectOption({ label: "Sita Stores" });
  await expect(bigBill).toContainText("Fully paid");
  await bigBill.getByRole("button", { name: "Mark settled" }).click();
  await expect(form.getByRole("group")).toHaveCount(1); // only the Rs 500 bill is left
  await form.getByRole("button", { name: "Cancel" }).click();

  // Filter: by customer and all dates
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.getByLabel("Customer", { exact: true }).selectOption({ label: "Sita Stores" });
  await expect(page.getByRole("article")).toHaveCount(2);

  // Sales page shows the payments under each bill
  await page.goto("/sales");
  await page.getByRole("button", { name: "All", exact: true }).click();
  const big = page.getByRole("article").filter({ hasText: "₹15,000.00" });
  await expect(big.getByText("Settled")).toBeVisible();
  await expect(big.getByRole("list", { name: "Payments" }).getByRole("listitem")).toHaveCount(2); // 2,000 then 13,000
  await expect(big.getByText("₹13,000.00")).toBeVisible();
  const small = page.getByRole("article").filter({ hasText: "₹500.00" }).first();
  await expect(small.getByText("Fully paid")).toBeVisible();
  await expect(small.getByRole("button", { name: "Mark settled" })).toBeVisible();
  await expect(tile(page, "Due")).toHaveText("₹0.00"); // nothing due
  await shot(page, "09-sales-with-payments");

  // A bill with payments can't be deleted
  await big.getByRole("button", { name: /Delete bill/ }).click();
  await expect(pageAlert(page)).toContainText("has payments");
});
