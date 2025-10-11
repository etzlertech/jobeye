/**
 * AGENT DIRECTIVE BLOCK
 *
 * file: /playwright.browserless.config.ts
 * phase: 3
 * domain: testing
 * purpose: Configure Playwright to run E2E suites locally or via Browserless.
 * spec_ref: E2E_TEST_SETUP_REQUIRED.md
 * dependencies: ['@playwright/test']
 * update_policy: Keep Browserless endpoint handling in sync with .env guidance.
 */

import { defineConfig, devices } from "@playwright/test";

const rawBrowserlessEndpoint =
  process.env.BROWSERLESS_WS_ENDPOINT ?? process.env.browserless_ws_endpoint;

const wsEndpoint = rawBrowserlessEndpoint
  ? `${rawBrowserlessEndpoint.replace(/\/+$/, "")}/chrome?blockAds=false&stealth=false`
  : undefined;

const baseURL =
  process.env.PLAYWRIGHT_TEST_BASE_URL ??
  process.env.BASE_URL ??
  "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "html",
  
  use: {
    connectOptions: wsEndpoint ? {
      wsEndpoint,
      timeout: 30000,
    } : undefined,
    baseURL,
    trace: "on",
    screenshot: "on",
    video: "on",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
