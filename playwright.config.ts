import { defineConfig, devices } from "@playwright/test";

// UI end-to-end tests. Uses the locally installed Google Chrome (channel
// "chrome") so no browser download is needed behind the corporate proxy.
// Expects the dev server to be running: `npm run dev`, then `npm run test:ui`.
export default defineConfig({
  testDir: "tests/ui",
  outputDir: "test-results",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    channel: "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    // Mobile-first: the phone layout is the primary target.
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" } },
    { name: "desktop", use: { viewport: { width: 1280, height: 860 }, channel: "chrome" } },
  ],
});
