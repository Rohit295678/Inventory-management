import { expect, test, type Page } from "@playwright/test";

// One realistic day in the shop: sign up, add goods and people, record a
// multi-item purchase and a sale, then check totals, stock and the PDF.
// Screenshots land in test-results/screens for a quick visual review.

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `test-results/screens/${test.info().project.name}-${name}.png`, fullPage: true });

test("full buy & sell flow", async ({ page }) => {
  await page.goto("/register");
  await shot(page, "01-register");
  await page.getByLabel("Your name").fill("Rohit Kirana");
  await page.getByLabel("Email").fill(`ui-${test.info().project.name}-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("secret123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();

  // Items
  await page.goto("/items");
  for (const [name, type, unit] of [
    ["Basmati Rice", "Rice", "packet"],
    ["Toor Dal", "Pulse", "kg"],
  ]) {
    await page.getByRole("button", { name: "New item" }).click();
    await page.getByLabel("Item name").fill(name);
    await page.getByLabel("Type of goods").fill(type);
    await page.getByLabel("Counted in").selectOption(unit);
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByText(name)).toBeVisible();
  }

  // People
  await page.goto("/parties");
  for (const [name, role] of [
    ["Ramesh Traders", "SUPPLIER"],
    ["Sita Stores", "CUSTOMER"],
  ]) {
    await page.getByRole("button", { name: "New person" }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Role").selectOption(role);
    await page.getByRole("button", { name: "Add person" }).click();
    await expect(page.getByText(name)).toBeVisible();
  }
  await shot(page, "02-people");

  // Purchase: 50 packets rice by TOTAL cost + 20 kg dal by RATE
  await page.goto("/purchases");
  await page.getByRole("button", { name: "New purchase" }).click();
  const form = page.getByRole("form", { name: "New purchase" });
  await form.getByLabel("Supplier").selectOption({ label: "Ramesh Traders" });

  const line1 = form.getByRole("group", { name: "Item 1" });
  await line1.getByLabel("Item", { exact: true }).selectOption({ label: "Basmati Rice (Rice)" });
  await line1.getByLabel("Quantity (packet)").fill("50");
  await line1.getByLabel("Total weight (kg)").fill("1250");
  await line1.getByText("Total cost").click();
  await line1.getByLabel("Total cost (₹)").fill("62500");
  await expect(line1.getByText("1,250 kg × ₹50.00/kg = ₹62,500.00")).toBeVisible();

  await form.getByRole("button", { name: "Add another item" }).click();
  const line2 = form.getByRole("group", { name: "Item 2" });
  await line2.getByLabel("Item", { exact: true }).selectOption({ label: "Toor Dal (Pulse)" });
  await line2.getByLabel("Quantity (kg)").fill("20");
  await line2.getByLabel("Price per kg (₹)").fill("90");
  await expect(form.getByText("Total: ₹64,300.00")).toBeVisible();
  await shot(page, "03-purchase-form");

  await form.getByRole("button", { name: "Save purchase" }).click();
  await expect(page.getByRole("article", { name: /Ramesh Traders/ })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "₹64,300.00" })).toBeVisible();
  await shot(page, "04-purchases-today");

  // PDF download uses the same filters
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "PDF" }).click();
  expect((await download).suggestedFilename()).toMatch(/^purchases-.*\.pdf$/);

  // Sale: 10 packets rice
  await page.goto("/sales");
  await page.getByRole("button", { name: "New sale" }).click();
  const sale = page.getByRole("form", { name: "New sale" });
  await sale.getByLabel("Customer").selectOption({ label: "Sita Stores" });
  const sl = sale.getByRole("group", { name: "Item 1" });
  await sl.getByLabel("Item", { exact: true }).selectOption({ label: "Basmati Rice (Rice)" });
  await sl.getByLabel("Quantity (packet)").fill("10");
  await sl.getByLabel("Total weight (kg)").fill("250");
  await sl.getByLabel("Price per kg (₹)").fill("60");
  await sale.getByRole("button", { name: "Save sale" }).click();
  await expect(page.getByRole("article", { name: /Sita Stores/ })).toBeVisible();

  // Stock = 50 - 10 packets
  await page.goto("/items");
  await expect(page.getByText("1,000 kg")).toBeVisible();
  await expect(page.getByText("40 packets")).toBeVisible();
  await shot(page, "05-stock");

  await page.goto("/dashboard");
  await expect(page.getByText("₹15,000.00").first()).toBeVisible();
  await shot(page, "06-dashboard");
});

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await shot(page, "00-login");
});
