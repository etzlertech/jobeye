import { defineConfig, devices } from '@playwright/test';

const wsEndpoint = process.env.BROWSERLESS_WS_ENDPOINT;
const apiKey = process.env.BROWSERLESS_API_KEY;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://jobeye-production.up.railway.app';

if (!wsEndpoint) {
  throw new Error('BROWSERLESS_WS_ENDPOINT is required to run browserless Playwright tests.');
}

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120 * 1000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
    connectOptions: {
      wsEndpoint,
      headers: apiKey ? { 'x-api-key': apiKey } : undefined,
      timeout: 30 * 1000
    }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
