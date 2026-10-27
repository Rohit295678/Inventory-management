import { expect, test, type Page } from "@playwright/test";

// Shared by the UI specs. Screenshots land in test-results/screens.
// animations: "disabled" fast-forwards CSS transitions to their end state;
// headless Chrome otherwise captures pills mid-fade (looks washed out).
export const shot = (page: Page, name: string) =>
  page.screenshot({
    path: `test-results/screens/${test.info().project.name}-${name}.png`,
    fullPage: true,
    animations: "disabled",
  });

// The value of a headline tile by its label, e.g. tile(page, "Due").
// (Values alone can repeat: a fresh bill has Total = Due.)
export const tile = (page: Page, label: string) =>
  page.getByRole("term").filter({ hasText: new RegExp(`^${label}$`) }).locator("xpath=following-sibling::dd[1]");

// Our own error alerts. Next.js also renders a hidden role="alert" route
// announcer, so scope to the page content.
export const pageAlert = (page: Page) => page.getByRole("main").getByRole("alert");

// Fresh account per test run, signed in, landing on the Today screen.
export async function register(page: Page, label: string) {
  await page.goto("/register");
  await page.getByLabel("Your name").fill("Rohit Kirana");
  await page.getByLabel("Email").fill(`${label}-${test.info().project.name}-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("secret123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Today", exact: true })).toBeVisible();
}
