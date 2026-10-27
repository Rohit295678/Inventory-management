import { expect, test, type Page } from "@playwright/test";

// One realistic day in the shop: sign up, add goods and people, record a
// multi-item purchase and a sale, then check totals, stock and the PDF.
// Screenshots land in test-results/screens for a quick visual review.
// animations: "disabled" fast-forwards CSS transitions to their end state;
// headless Chrome otherwise captures pills mid-fade (looks washed out).

const shot = (page: Page, name: string) =>
  page.screenshot({
    path: `test-results/screens/${test.info().project.name}-${name}.png`,
    fullPage: true,
    animations: "disabled",
  });

test("full buy & sell flow", async ({ page }) => {
  await page.goto("/register");
  await shot(page, "01-register");
  await page.getByLabel("Your name").fill("Rohit Kirana");
  await page.getByLabel("Email").fill(`ui-${test.info().project.name}-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("secret123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();

  // Items. A new user has no types yet, so each one is added from the dropdown.
  await page.goto("/items");
  for (const [name, type, unit] of [
    ["Basmati Rice", "Rice", "packet"],
    ["Toor Dal", "Pulse", "kg"],
  ]) {
    await page.getByRole("button", { name: "New item" }).click();
    await page.getByLabel("Item name").fill(name);
    const typeSelect = page.getByLabel("Type of goods");
    await typeSelect.selectOption({ label: "+ Add new type…" });
    await page.getByLabel("New type name").fill(type);
    await page.getByRole("button", { name: "Add type" }).click();
    await expect(typeSelect.locator("option:checked")).toHaveText(type); // auto-selected
    if (type === "Pulse") await shot(page, "01b-item-form-types");
    await page.getByLabel("Counted in").selectOption(unit);
    await page.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByText(name)).toBeVisible();
  }

  // People
  await page.goto("/parties");
  for (const [name, role] of [
    ["Ramesh Traders", "SUPPLIER"],
    ["Shyam & Co", "SUPPLIER"],
    ["Sita Stores", "CUSTOMER"],
  ]) {
    await page.getByRole("button", { name: "New person" }).click();
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Role").selectOption(role);
    await page.getByRole("button", { name: "Add person" }).click();
    await expect(page.getByText(name)).toBeVisible();
  }
  await shot(page, "02-people");

  // Purchase: 50 packets x 25 kg rice @ 50/kg + 20 kg dal @ 90/kg
  await page.goto("/purchases");
  await page.getByRole("button", { name: "New purchase" }).click();
  const form = page.getByRole("form", { name: "New purchase" });
  await form.getByLabel("Supplier").selectOption({ label: "Ramesh Traders" });

  const line1 = form.getByRole("group", { name: "Item 1" });
  await line1.getByLabel("Item", { exact: true }).selectOption({ label: "Basmati Rice (Rice)" });
  await line1.getByLabel("Quantity (packet)").fill("50");
  await line1.getByLabel("Weight per packet (kg)").fill("25");
  await expect(line1.getByText("Total cost")).toHaveCount(0); // only price per kg now
  await line1.getByLabel("Price per kg (₹)").fill("50");
  await expect(line1.getByText("50 packets × 25 kg × ₹50.00/kg = ₹62,500.00")).toBeVisible();
  await expect(line1.getByText("Total weight: 1,250 kg")).toBeVisible();

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

  // Same rice from a second supplier, cheaper: 10 packets x 26 kg @ 44/kg
  await page.getByRole("button", { name: "New purchase" }).click();
  await form.getByLabel("Supplier").selectOption({ label: "Shyam & Co" });
  const shyam = form.getByRole("group", { name: "Item 1" });
  await shyam.getByLabel("Item", { exact: true }).selectOption({ label: "Basmati Rice (Rice)" });
  await shyam.getByLabel("Quantity (packet)").fill("10");
  await shyam.getByLabel("Weight per packet (kg)").fill("26");
  await shyam.getByLabel("Price per kg (₹)").fill("44");
  await form.getByRole("button", { name: "Save purchase" }).click();
  await expect(page.getByRole("article", { name: /Shyam & Co/ })).toBeVisible();

  // Sale: 10 packets rice
  await page.goto("/sales");
  await page.getByRole("button", { name: "New sale" }).click();
  const sale = page.getByRole("form", { name: "New sale" });
  await sale.getByLabel("Customer").selectOption({ label: "Sita Stores" });
  const sl = sale.getByRole("group", { name: "Item 1" });
  await sl.getByLabel("Item", { exact: true }).selectOption({ label: "Basmati Rice (Rice)" });
  await sl.getByLabel("Quantity (packet)").fill("10");
  await sl.getByLabel("Weight per packet (kg)").fill("25");
  await sl.getByLabel("Price per kg (₹)").fill("60");
  // price per kg x weight per packet x packets = 60 x 25 x 10
  await expect(sl.getByText("10 packets × 25 kg × ₹60.00/kg = ₹15,000.00")).toBeVisible();
  await sale.getByRole("button", { name: "Save sale" }).click();
  await expect(page.getByRole("article", { name: /Sita Stores/ })).toBeVisible();
  await expect(page.getByText("10 packets × 25 kg (250 kg)")).toBeVisible();

  // Items & stock. Rice: bought 50 + 10 = 60 packets, sold 10 -> 50 in stock.
  await page.goto("/items");
  await expect(page.getByText("50 packets", { exact: true })).toBeVisible(); // stock, count first
  await expect(page.getByText("1,260 kg", { exact: true })).toBeVisible(); //   ...kg second
  // Tiles: 73,940 + 1,800 spent; packets before weight
  const tiles = page.getByRole("definition");
  await expect(tiles.filter({ hasText: "₹75,740.00" })).toBeVisible();
  await expect(page.getByText("Packets bought")).toBeVisible();
  await expect(tiles.filter({ hasText: "60 packets" })).toBeVisible();
  await expect(tiles.filter({ hasText: "1,530 kg" })).toBeVisible();
  // Highlighted total, weighted avg: 73,940 / 1,510 kg = 48.97
  await expect(page.getByText("Bought 60 packets (1,510 kg) · avg ₹48.97/kg · total ₹73,940.00")).toBeVisible();
  // ...and per supplier, at their own prices
  await expect(page.getByText("Ramesh Traders · 50 packets (1,250 kg)")).toBeVisible();
  await expect(page.getByText("₹50.00/kg · ₹62,500.00")).toBeVisible();
  await expect(page.getByText("Shyam & Co · 10 packets (260 kg)")).toBeVisible();
  await expect(page.getByText("₹44.00/kg · ₹11,440.00")).toBeVisible();
  // Dal had one supplier: just a "From ..." line
  await expect(page.getByText("Bought 20 kg · avg ₹90.00/kg · total ₹1,800.00")).toBeVisible();
  await expect(page.getByText("From Ramesh Traders")).toBeVisible();
  await shot(page, "05-stock");

  // New items default to "packet"
  await page.getByRole("button", { name: "New item" }).click();
  await expect(page.getByLabel("Counted in")).toHaveValue("packet");
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.goto("/dashboard");
  await expect(page.getByText("₹15,000.00").first()).toBeVisible();
  await shot(page, "06-dashboard");

  // Sign out must land on THIS host's /login (not NEXTAUTH_URL's localhost),
  // which matters when testing from a phone on the LAN.
  if (test.info().project.name === "mobile") await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  expect(new URL(page.url()).host).toBe(new URL(test.info().project.use.baseURL!).host);
});

test("login page renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await shot(page, "00-login");
});
